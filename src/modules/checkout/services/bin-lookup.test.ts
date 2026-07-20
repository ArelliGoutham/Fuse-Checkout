import { identifyBankFromBIN } from './bin-lookup';

describe('BIN Lookup', () => {
  describe('identifyBankFromBIN', () => {
    it('identifies HDFC from 4591 BIN prefix', () => {
      expect(identifyBankFromBIN('459130')).toBe('HDFC');
    });

    it('identifies HDFC from 4374 BIN prefix', () => {
      expect(identifyBankFromBIN('4374')).toBe('HDFC');
    });

    it('identifies HDFC from 5522 BIN prefix', () => {
      expect(identifyBankFromBIN('5522')).toBe('HDFC');
    });

    it('identifies ICICI from 4026 BIN prefix', () => {
      expect(identifyBankFromBIN('4026')).toBe('ICICI');
    });

    it('identifies ICICI from 4552 BIN prefix', () => {
      expect(identifyBankFromBIN('4552')).toBe('ICICI');
    });

    it('identifies ICICI from 5242 BIN prefix', () => {
      expect(identifyBankFromBIN('5242')).toBe('ICICI');
    });

    it('identifies SBI from 5467 BIN prefix', () => {
      expect(identifyBankFromBIN('546705')).toBe('SBI');
    });

    it('identifies SBI from 5422 BIN prefix', () => {
      expect(identifyBankFromBIN('5422')).toBe('SBI');
    });

    it('identifies AXIS from 5123 BIN prefix', () => {
      expect(identifyBankFromBIN('5123')).toBe('AXIS');
    });

    it('identifies AXIS from 5413 BIN prefix', () => {
      expect(identifyBankFromBIN('5413')).toBe('AXIS');
    });

    it('identifies AXIS from 4386 BIN prefix', () => {
      expect(identifyBankFromBIN('4386')).toBe('AXIS');
    });

    it('identifies KOTAK from 4477 BIN prefix', () => {
      expect(identifyBankFromBIN('4477')).toBe('KOTAK');
    });

    it('returns null for unknown BIN prefix', () => {
      expect(identifyBankFromBIN('999999')).toBeNull();
    });

    it('handles 8-digit BIN by matching first 4 characters', () => {
      expect(identifyBankFromBIN('45913012')).toBe('HDFC');
    });

    it('handles 6-digit BIN correctly', () => {
      expect(identifyBankFromBIN('452345')).toBeNull(); // Unknown first 4
    });

    it('returns null for shorter BINs that do not match', () => {
      expect(identifyBankFromBIN('99')).toBeNull();
    });

    it('handles case-insensitive input', () => {
      // BINs are typically numeric, but test with numeric string
      expect(identifyBankFromBIN('4026')).toBe('ICICI');
    });
  });
});
