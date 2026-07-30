import type { Db } from 'mongodb';
import { sanitizeIMEI, validateIMEI } from '../../../lib/imei';
import type { SubsidyLedger } from '../schemas/subsidy-ledger';
import type { OEMService } from '../../oem-adapters/oem-service';

/**
 * Manages brand subsidy settlement lifecycle.
 * Tracks "brand owes merchant ₹X" across orders with IMEI blocking status.
 *
 * Settlement states: pending → imei_blocked → settled → paid
 *
 * OEM integration is optional — if an OEMService is injected, IMEI blocking
 * is delegated to the OEM adapter. If no OEMService is provided, IMEI is
 * recorded but not blocked (feature-flag behavior for brands without OEM APIs).
 */
export class SubsidySettlementEngine {
  constructor(
    private db: Db,
    private oemService?: OEMService
  ) {}

  /**
   * Creates a subsidy ledger entry when a brand-subsidized EMI campaign is used.
   */
  async createLedgerEntry(params: {
    orderId: string;
    merchantId: string;
    campaignId: string;
    campaignCode: string;
    brand: string | null;
    amount: number;
    emiType: 'no_cost' | 'low_cost';
    requiresImei: boolean;
  }): Promise<SubsidyLedger> {
    const now = new Date().toISOString();
    const entry: SubsidyLedger = {
      _id: `subsidy_${params.orderId}`,
      order_id: params.orderId,
      merchant_id: params.merchantId,
      campaign_id: params.campaignId,
      campaign_code: params.campaignCode,
      brand: params.brand,
      amount: params.amount,
      emi_type: params.emiType,
      imei: null,
      imei_blocked: !params.requiresImei,
      imei_blocked_at: params.requiresImei ? null : now,
      settlement_status: params.requiresImei ? 'pending' : 'imei_blocked',
      settlement_ref: null,
      settled_at: null,
      created_at: now,
      updated_at: now,
    };

    await this.db.collection('subsidy_ledger').insertOne(entry as any);
    return entry;
  }

  /**
   * Captures and validates IMEI for a subsidy ledger entry.
   * If IMEI is valid, marks as imei_blocked (ready for brand settlement).
   */
  async captureIMEI(orderId: string, merchantId: string, imeiInput: string): Promise<{
    success: boolean;
    error?: string;
    oemReferenceId?: string | null;
    entry?: SubsidyLedger;
  }> {
    const validation = validateIMEI(imeiInput);
    if (!validation.valid) {
      return { success: false, error: validation.error || 'Invalid IMEI' };
    }

    const sanitizedIMEI = sanitizeIMEI(imeiInput);

    // Find the ledger entry with tenant isolation
    const existing = await this.db.collection('subsidy_ledger').findOne({
      order_id: orderId,
      merchant_id: merchantId,
    });
    if (!existing) {
      return { success: false, error: 'Subsidy ledger entry not found for this order' };
    }

    // Call OEM adapter to block IMEI (if service + adapter configured for this brand)
    let oemReferenceId: string | null = null;
    if (this.oemService && existing.brand) {
      const blockResult = await this.oemService.blockIMEI(existing.brand as string, {
        imei: sanitizedIMEI,
        campaignId: existing.campaign_id as string,
        campaignCode: existing.campaign_code as string,
        orderId,
        merchantId: existing.merchant_id as string,
        brand: existing.brand as string,
      });

      if (!blockResult.success) {
        return { success: false, error: `OEM block failed: ${blockResult.error}` };
      }

      oemReferenceId = blockResult.oemReferenceId;
    }

    const now = new Date().toISOString();

    const result = await this.db.collection('subsidy_ledger').findOneAndUpdate(
      { order_id: orderId, merchant_id: merchantId },
      {
        $set: {
          imei: sanitizedIMEI,
          imei_blocked: true,
          imei_blocked_at: now,
          settlement_status: 'imei_blocked',
          updated_at: now,
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return { success: false, error: 'Subsidy ledger entry not found for this order' };
    }

    return { success: true, entry: result as unknown as SubsidyLedger, oemReferenceId };
  }

  /**
   * Marks a ledger entry as settled (brand has transferred the money).
   */
  async markSettled(orderId: string, merchantId: string, settlementRef: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const now = new Date().toISOString();
    const result = await this.db.collection('subsidy_ledger').updateOne(
      { order_id: orderId, merchant_id: merchantId, settlement_status: 'imei_blocked' },
      {
        $set: {
          settlement_status: 'settled',
          settlement_ref: settlementRef,
          settled_at: now,
          updated_at: now,
        },
      }
    );

    if (result.matchedCount === 0) {
      return { success: false, error: 'Ledger entry not found or not in imei_blocked state' };
    }

    return { success: true };
  }

  /**
   * Marks a settled entry as paid (merchant has received the money).
   */
  async markPaid(orderId: string, merchantId: string): Promise<{ success: boolean; error?: string }> {
    const now = new Date().toISOString();
    const result = await this.db.collection('subsidy_ledger').updateOne(
      { order_id: orderId, merchant_id: merchantId, settlement_status: 'settled' },
      {
        $set: {
          settlement_status: 'paid',
          updated_at: now,
        },
      }
    );

    if (result.matchedCount === 0) {
      return { success: false, error: 'Ledger entry not found or not in settled state' };
    }

    return { success: true };
  }

  /**
   * Lists ledger entries for a merchant, optionally filtered by status.
   */
  async listByMerchant(
    merchantId: string,
    status?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ entries: SubsidyLedger[]; total: number }> {
    const filter: Record<string, unknown> = { merchant_id: merchantId };
    if (status) filter.settlement_status = status;

    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      this.db.collection('subsidy_ledger')
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      this.db.collection('subsidy_ledger').countDocuments(filter),
    ]);

    return { entries: docs as unknown as SubsidyLedger[], total };
  }

  /**
   * Generates a reconciliation summary for a merchant.
   * "Samsung owes you ₹45,000 across 9 orders"
   */
  async getReconciliationSummary(merchantId: string): Promise<{
    by_brand: Array<{
      brand: string;
      total_amount: number;
      entry_count: number;
      pending: number;
      imei_blocked: number;
      settled: number;
      paid: number;
    }>;
    total_pending: number;
    total_amount: number;
  }> {
    const pipeline = [
      { $match: { merchant_id: merchantId } },
      {
        $group: {
          _id: '$brand',
          total_amount: { $sum: '$amount' },
          entry_count: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$settlement_status', 'pending'] }, 1, 0] } },
          imei_blocked: { $sum: { $cond: [{ $eq: ['$settlement_status', 'imei_blocked'] }, 1, 0] } },
          settled: { $sum: { $cond: [{ $eq: ['$settlement_status', 'settled'] }, 1, 0] } },
          paid: { $sum: { $cond: [{ $eq: ['$settlement_status', 'paid'] }, 1, 0] } },
        },
      },
      { $sort: { total_amount: -1 } },
    ];

    const results = await this.db.collection('subsidy_ledger').aggregate(pipeline).toArray();

    const byBrand = results.map((r: any) => ({
      brand: r._id || 'Unknown',
      total_amount: r.total_amount,
      entry_count: r.entry_count,
      pending: r.pending,
      imei_blocked: r.imei_blocked,
      settled: r.settled,
      paid: r.paid,
    }));

    const totalPending = byBrand.reduce((sum, b) => sum + b.pending + b.imei_blocked, 0);
    const totalAmount = byBrand.reduce((sum, b) => sum + b.total_amount, 0);

    return { by_brand: byBrand, total_pending: totalPending, total_amount: totalAmount };
  }
}
