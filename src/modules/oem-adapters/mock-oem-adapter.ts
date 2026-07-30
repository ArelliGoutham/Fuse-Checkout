import { OEMAdapter, BlockIMEIParams, BlockIMEIResult, IMEIStatusResult } from './types';
import { validateIMEI } from '../../lib/imei';

/**
 * Mock OEM adapter for development and testing.
 * Simulates IMEI blocking in memory — no real OEM API calls.
 *
 * In production, replace with SamsungAdapter, AppleAdapter, etc.
 * Each implements the same OEMAdapter interface — no consumer changes needed.
 */
export class MockOEMAdapter implements OEMAdapter {
  private blockedIMEIs = new Map<string, { blockedAt: string; unblockDate: string; oemRef: string; campaign: string }>();

  getName(): string {
    return 'mock-oem';
  }

  async blockIMEI(params: BlockIMEIParams): Promise<BlockIMEIResult> {
    const validation = validateIMEI(params.imei);
    if (!validation.valid) {
      return {
        success: false,
        blocked: false,
        unblockDate: null,
        oemReferenceId: null,
        error: validation.error || 'Invalid IMEI',
      };
    }

    const imei = validation.sanitized;
    const now = new Date();
    const unblockDate = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 180 days
    const oemRef = `oem_block_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    this.blockedIMEIs.set(imei, {
      blockedAt: now.toISOString(),
      unblockDate: unblockDate.toISOString(),
      oemRef,
      campaign: params.campaignCode,
    });

    return {
      success: true,
      blocked: true,
      unblockDate: unblockDate.toISOString(),
      oemReferenceId: oemRef,
    };
  }

  async getIMEIStatus(imei: string): Promise<IMEIStatusResult> {
    const record = this.blockedIMEIs.get(imei);
    if (!record) {
      return {
        imei,
        blocked: false,
        blockedAt: null,
        unblockDate: null,
        oemReferenceId: null,
      };
    }

    return {
      imei,
      blocked: true,
      blockedAt: record.blockedAt,
      unblockDate: record.unblockDate,
      oemReferenceId: record.oemRef,
    };
  }

  async unblockIMEI(imei: string): Promise<{ success: boolean; error?: string }> {
    if (!this.blockedIMEIs.has(imei)) {
      return { success: false, error: 'IMEI not found in blocked list' };
    }
    this.blockedIMEIs.delete(imei);
    return { success: true };
  }
}
