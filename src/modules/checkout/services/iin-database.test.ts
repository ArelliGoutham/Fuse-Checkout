import { IINLookupService } from './iin-database';
import { IINRange } from '../schemas/iin-range';

describe('IINLookupService', () => {
  const sampleRanges: IINRange[] = [
    { prefix: '459130', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'credit', card_tier: 'platinum', card_network: 'visa', status: 'active' },
    { prefix: '459131', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'credit', card_tier: 'signature', card_network: 'visa', status: 'active' },
    { prefix: '437450', bank_code: 'HDFC', bank_name: 'HDFC Bank', card_type: 'debit', card_tier: 'platinum', card_network: 'visa', status: 'active' },
    { prefix: '402602', bank_code: 'ICICI', bank_name: 'ICICI Bank', card_type: 'credit', card_tier: 'coral', card_network: 'visa', status: 'active' },
    { prefix: '546700', bank_code: 'SBI', bank_name: 'State Bank of India', card_type: 'credit', card_tier: 'elite', card_network: 'mastercard', status: 'active' },
    { prefix: '512300', bank_code: 'AXIS', bank_name: 'Axis Bank', card_type: 'credit', card_tier: 'magnus', card_network: 'mastercard', status: 'active' },
    { prefix: '541301', bank_code: 'AXIS', bank_name: 'Axis Bank', card_type: 'credit', card_tier: 'standard', card_network: 'mastercard', status: 'inactive' },
  ];

  let service: IINLookupService;

  beforeEach(() => {
    service = new IINLookupService();
    service.loadRanges(sampleRanges);
  });

  describe('lookup', () => {
    it('returns the range matching a 6-digit BIN by prefix', () => {
      const result = service.lookup('459130');
      expect(result).not.toBeNull();
      expect(result!.prefix).toBe('459130');
      expect(result!.bank_code).toBe('HDFC');
      expect(result!.card_tier).toBe('platinum');
    });

    it('matches longer BINs by extracting the first 6 digits', () => {
      const result = service.lookup('4591306742');
      expect(result).not.toBeNull();
      expect(result!.prefix).toBe('459130');
    });

    it('returns null for unknown IIN prefixes', () => {
      expect(service.lookup('999999')).toBeNull();
    });

    it('returns null for null or short BINs', () => {
      expect(service.lookup('')).toBeNull();
      expect(service.lookup('12345')).toBeNull();
    });
  });

  describe('findByBank', () => {
    it('finds all active ranges for a given bank code', () => {
      const results = service.findByBank('HDFC');
      expect(results).toHaveLength(3);
    });

    it('filters inactive IIN ranges', () => {
      const results = service.findByBank('AXIS');
      expect(results).toHaveLength(1);
      expect(results[0].card_tier).toBe('magnus');
    });

    it('finds ranges for bank code with optional tier filter', () => {
      const results = service.findByBank('HDFC', 'platinum');
      expect(results).toHaveLength(2);
    });

    it('returns empty array for unknown bank code', () => {
      expect(service.findByBank('NONEXISTENT')).toHaveLength(0);
    });
  });

  describe('all', () => {
    it('returns all loaded ranges', () => {
      expect(service.all()).toHaveLength(sampleRanges.length);
    });
  });
});
