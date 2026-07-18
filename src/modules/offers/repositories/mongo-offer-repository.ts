import type { Db, Document } from 'mongodb';
import type { Offer, OfferRepository } from '../types';

/**
 * MongoDB implementation of OfferRepository.
 * All queries are scoped by merchant_id for tenant isolation.
 *
 * @implements {OfferRepository}
 */
export class MongoOfferRepository implements OfferRepository {
  /**
   * Creates a new MongoOfferRepository instance.
   *
   * @param db - MongoDB Db instance
   */
  constructor(private readonly db: Db) {}

  /**
   * Finds an offer by ID and merchant ID.
   *
   * @param id - The offer ID
   * @param merchantId - The merchant ID (for tenant isolation)
   * @returns The offer or null if not found
   */
  async findById(id: string, merchantId: string): Promise<Offer | null> {
    return (await (this.db.collection('offers') as unknown as Document).findOne({
      _id: id,
      merchant_id: merchantId,
    })) as Offer | null;
  }

  /**
   * Finds an offer by code and merchant ID.
   *
   * @param code - The offer code
   * @param merchantId - The merchant ID (for tenant isolation)
   * @returns The offer or null if not found
   */
  async findByCode(code: string, merchantId: string): Promise<Offer | null> {
    return (await (this.db.collection('offers') as unknown as Document).findOne({
      code,
      merchant_id: merchantId,
    })) as Offer | null;
  }

  /**
   * Lists all offers for a merchant.
   *
   * @param merchantId - The merchant ID
   * @returns Array of offers for the merchant (empty if none exist)
   */
  async findByMerchant(merchantId: string): Promise<Offer[]> {
    return (await (this.db.collection('offers') as unknown as Document)
      .find({ merchant_id: merchantId })
      .toArray()) as unknown as Offer[];
  }

  /**
   * Saves an offer (upsert).
   *
   * @param offer - The offer to save
   * @returns The saved offer
   */
  async save(offer: Offer): Promise<Offer> {
    await (this.db.collection('offers') as unknown as Document).replaceOne(
      { _id: offer._id, merchant_id: offer.merchant_id },
      offer,
      { upsert: true },
    );
    return offer;
  }

  /**
   * Deletes an offer by ID and merchant ID.
   *
   * @param id - The offer ID
   * @param merchantId - The merchant ID (for tenant isolation)
   * @returns true if deleted, false if not found
   */
  async delete(id: string, merchantId: string): Promise<boolean> {
    const result = await (this.db.collection('offers') as unknown as Document).deleteOne({
      _id: id,
      merchant_id: merchantId,
    });
    return result.deletedCount > 0;
  }
}
