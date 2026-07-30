import type { OEMAdapterRegistry } from './types';
import type { BlockIMEIParams, BlockIMEIResult, IMEIStatusResult } from './types';

/**
 * OEM service — bridges the subsidy settlement engine with OEM adapters.
 * Depends on OEMAdapterRegistry interface, not concrete adapters (dependency inversion).
 *
 * When a brand-subsidized order requires IMEI blocking, this service
 * looks up the correct OEM adapter by brand name and delegates the block call.
 *
 * If no adapter is registered for the brand, returns an error (feature-flag behavior —
 * only brands with configured adapters can be blocked).
 */
export class OEMService {
  constructor(private registry: OEMAdapterRegistry) {}

  /**
   * Blocks an IMEI using the appropriate OEM adapter for the brand.
   *
   * @param brand - Brand name (e.g., "Samsung", "Apple")
   * @param params - IMEI block parameters
   * @returns Block result from the OEM adapter, or error if no adapter configured
   */
  async blockIMEI(brand: string, params: BlockIMEIParams): Promise<BlockIMEIResult> {
    const adapter = this.registry.getAdapter(brand);
    if (!adapter) {
      return {
        success: false,
        blocked: false,
        unblockDate: null,
        oemReferenceId: null,
        error: `No OEM adapter configured for brand: ${brand}`,
      };
    }

    return adapter.blockIMEI(params);
  }

  /**
   * Checks IMEI block status for a brand.
   */
  async getIMEIStatus(brand: string, imei: string): Promise<IMEIStatusResult | null> {
    const adapter = this.registry.getAdapter(brand);
    if (!adapter) {
      return null;
    }
    return adapter.getIMEIStatus(imei);
  }

  /**
   * Unblocks an IMEI for a brand.
   */
  async unblockIMEI(brand: string, imei: string): Promise<{ success: boolean; error?: string }> {
    const adapter = this.registry.getAdapter(brand);
    if (!adapter) {
      return { success: false, error: `No OEM adapter configured for brand: ${brand}` };
    }
    return adapter.unblockIMEI(imei);
  }

  /**
   * Checks if an OEM adapter is configured for a brand.
   */
  isBrandSupported(brand: string): boolean {
    return this.registry.hasAdapter(brand);
  }

  /**
   * Lists all configured OEM brands.
   */
  getSupportedBrands(): string[] {
    return this.registry.listBrands();
  }
}
