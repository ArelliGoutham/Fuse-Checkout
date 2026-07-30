/**
 * OEM (Original Equipment Manufacturer) adapter interface.
 * Implementations handle IMEI blocking with device manufacturers
 * (Samsung, Apple, OnePlus, etc.) for brand subsidy validation.
 *
 * Brand campaigns that require IMEI blocking use this interface
 * to verify the device was sold to an end customer and cannot
 * be resold as new within the campaign window.
 *
 * New OEMs are added by implementing this interface and registering
 * at the composition root — no changes to existing code (Open/Closed).
 */
export interface OEMAdapter {
  /**
   * Returns the OEM name (e.g., "samsung", "apple", "oneplus").
   */
  getName(): string;

  /**
   * Blocks an IMEI in the OEM's system.
   * This prevents the device from being registered as "new"
   * and starts the warranty clock from the block date.
   *
   * @param params - IMEI, campaign reference, order ID
   * @returns Block result with unblock date and status
   */
  blockIMEI(params: BlockIMEIParams): Promise<BlockIMEIResult>;

  /**
   * Checks the current block status of an IMEI.
   *
   * @param imei - The 15-digit IMEI number
   * @returns Current block status
   */
  getIMEIStatus(imei: string): Promise<IMEIStatusResult>;

  /**
   * Unblocks an IMEI (e.g., after campaign window expires or order cancelled).
   *
   * @param imei - The 15-digit IMEI number
   * @returns Unblock result
   */
  unblockIMEI(imei: string): Promise<{ success: boolean; error?: string }>;
}

export interface BlockIMEIParams {
  imei: string;
  campaignId: string;
  campaignCode: string;
  orderId: string;
  merchantId: string;
  brand?: string;
}

export interface BlockIMEIResult {
  success: boolean;
  blocked: boolean;
  unblockDate: string | null;
  oemReferenceId: string | null;
  error?: string;
}

export interface IMEIStatusResult {
  imei: string;
  blocked: boolean;
  blockedAt: string | null;
  unblockDate: string | null;
  oemReferenceId: string | null;
}

/**
 * Registry for OEM adapters.
 * Looks up the correct adapter by brand name at runtime.
 * New OEMs are registered at the composition root.
 */
export class OEMAdapterRegistry {
  private adapters = new Map<string, OEMAdapter>();

  register(brand: string, adapter: OEMAdapter): void {
    this.adapters.set(brand.toLowerCase(), adapter);
  }

  getAdapter(brand: string): OEMAdapter | null {
    return this.adapters.get(brand.toLowerCase()) || null;
  }

  hasAdapter(brand: string): boolean {
    return this.adapters.has(brand.toLowerCase());
  }

  listBrands(): string[] {
    return Array.from(this.adapters.keys());
  }
}
