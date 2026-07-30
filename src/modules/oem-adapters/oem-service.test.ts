import { OEMAdapterRegistry } from './types';
import { OEMService } from './oem-service';
import { MockOEMAdapter } from './mock-oem-adapter';

const VALID_IMEI = '352099001761481';

describe('OEM Service', () => {
  let registry: OEMAdapterRegistry;
  let service: OEMService;

  beforeEach(() => {
    registry = new OEMAdapterRegistry();
    registry.register('samsung', new MockOEMAdapter());
    service = new OEMService(registry);
  });

  describe('blockIMEI', () => {
    it('blocks IMEI when adapter is configured for brand', async () => {
      const result = await service.blockIMEI('Samsung', {
        imei: VALID_IMEI,
        campaignId: 'camp_1',
        campaignCode: 'SAMSUNG-S24',
        orderId: 'FUSE-260730-000001',
        merchantId: 'merch_demo',
      });

      expect(result.success).toBe(true);
      expect(result.blocked).toBe(true);
      expect(result.oemReferenceId).not.toBeNull();
      expect(result.unblockDate).not.toBeNull();
    });

    it('returns error when no adapter configured for brand', async () => {
      const result = await service.blockIMEI('Xiaomi', {
        imei: VALID_IMEI,
        campaignId: 'camp_1',
        campaignCode: 'XIAOMI-OFFER',
        orderId: 'FUSE-260730-000001',
        merchantId: 'merch_demo',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No OEM adapter configured');
    });

    it('rejects invalid IMEI', async () => {
      const result = await service.blockIMEI('Samsung', {
        imei: '12345',
        campaignId: 'camp_1',
        campaignCode: 'SAMSUNG-S24',
        orderId: 'FUSE-260730-000001',
        merchantId: 'merch_demo',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('IMEI');
    });

    it('is case-insensitive for brand lookup', async () => {
      const result = await service.blockIMEI('SAMSUNG', {
        imei: VALID_IMEI,
        campaignId: 'camp_1',
        campaignCode: 'SAMSUNG-S24',
        orderId: 'FUSE-260730-000001',
        merchantId: 'merch_demo',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('getIMEIStatus', () => {
    it('returns blocked status after blocking', async () => {
      await service.blockIMEI('Samsung', {
        imei: VALID_IMEI,
        campaignId: 'camp_1',
        campaignCode: 'SAMSUNG-S24',
        orderId: 'FUSE-260730-000001',
        merchantId: 'merch_demo',
      });

      const status = await service.getIMEIStatus('Samsung', VALID_IMEI);
      expect(status).not.toBeNull();
      expect(status!.blocked).toBe(true);
      expect(status!.blockedAt).not.toBeNull();
    });

    it('returns null when no adapter configured', async () => {
      const status = await service.getIMEIStatus('UnknownBrand', VALID_IMEI);
      expect(status).toBeNull();
    });
  });

  describe('unblockIMEI', () => {
    it('unblocks a previously blocked IMEI', async () => {
      await service.blockIMEI('Samsung', {
        imei: VALID_IMEI,
        campaignId: 'camp_1',
        campaignCode: 'SAMSUNG-S24',
        orderId: 'FUSE-260730-000001',
        merchantId: 'merch_demo',
      });

      const result = await service.unblockIMEI('Samsung', VALID_IMEI);
      expect(result.success).toBe(true);

      const status = await service.getIMEIStatus('Samsung', VALID_IMEI);
      expect(status!.blocked).toBe(false);
    });
  });

  describe('isBrandSupported', () => {
    it('returns true for configured brands', () => {
      expect(service.isBrandSupported('Samsung')).toBe(true);
      expect(service.isBrandSupported('samsung')).toBe(true);
    });

    it('returns false for unconfigured brands', () => {
      expect(service.isBrandSupported('Apple')).toBe(false);
    });
  });

  describe('getSupportedBrands', () => {
    it('lists all configured brands', () => {
      const brands = service.getSupportedBrands();
      expect(brands).toContain('samsung');
    });
  });
});
