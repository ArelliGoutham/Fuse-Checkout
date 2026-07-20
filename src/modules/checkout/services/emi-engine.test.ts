import { calculateStandardEMI, calculateEMI } from './emi-engine';

describe('EMI Engine', () => {
  describe('calculateStandardEMI', () => {
    it('calculates EMI for 6 months at 18% on ₹1,29,999', () => {
      const result = calculateStandardEMI(129999, 18, 6);
      // Monthly rate = 18/12/100 = 0.015
      // EMI = P * r * (1+r)^n / ((1+r)^n - 1)
      // Expected: 21000-23000 range
      expect(result.monthly_emi).toBeGreaterThanOrEqual(21000);
      expect(result.monthly_emi).toBeLessThanOrEqual(23000);
      expect(result.total_payment).toBeCloseTo(result.monthly_emi * 6, -1);
      expect(result.total_interest).toBeGreaterThan(0);
    });

    it('calculates EMI for 12 months at 15% on ₹50,000', () => {
      const result = calculateStandardEMI(50000, 15, 12);
      // Expected: 4500-5000 range
      expect(result.monthly_emi).toBeGreaterThanOrEqual(4500);
      expect(result.monthly_emi).toBeLessThanOrEqual(5000);
      expect(result.total_payment).toBeCloseTo(result.monthly_emi * 12, -1);
      expect(result.total_interest).toBeGreaterThan(0);
    });

    it('returns rounded values to whole rupees', () => {
      const result = calculateStandardEMI(50000, 15, 12);
      expect(Number.isInteger(result.monthly_emi)).toBe(true);
      expect(Number.isInteger(result.total_payment)).toBe(true);
      expect(Number.isInteger(result.total_interest)).toBe(true);
    });

    it('handles 0% interest rate', () => {
      const result = calculateStandardEMI(60000, 0, 12);
      expect(result.monthly_emi).toBe(5000); // 60000 / 12
      expect(result.total_interest).toBe(0);
      expect(result.total_payment).toBe(60000);
    });
  });

  describe('calculateEMI', () => {
    const bankRate = {
      bank_name: 'HDFC',
      interest_rate: 15,
      processing_fee: 500,
    };

    it('calculates standard EMI where customer pays full interest and subsidy is 0', () => {
      const result = calculateEMI({
        principal: 50000,
        bankRate,
        tenure: 12,
        emiType: 'standard',
        subsidyAmount: null,
      });

      expect(result.emi_type).toBe('standard');
      expect(result.subsidy_amount).toBe(0);
      expect(result.customer_interest).toBe(result.total_interest);
      expect(result.customer_emi).toBe(result.monthly_emi);
      expect(result.customer_total).toBe(result.total_payment);
    });

    it('calculates no_cost EMI where customer pays 0 interest with full subsidy', () => {
      const result = calculateEMI({
        principal: 50000,
        bankRate,
        tenure: 12,
        emiType: 'no_cost',
        subsidyAmount: 'full',
      });

      expect(result.emi_type).toBe('no_cost');
      expect(result.customer_interest).toBe(0);
      expect(result.customer_emi).toBe(Math.round(50000 / 12));
      expect(result.subsidy_amount).toBe(result.total_interest);
      expect(result.customer_total).toBe(result.principal);
    });

    it('calculates low_cost EMI with fixed subsidy amount', () => {
      const subsidyAmount = 2000;
      const result = calculateEMI({
        principal: 50000,
        bankRate,
        tenure: 12,
        emiType: 'low_cost',
        subsidyAmount,
      });

      expect(result.emi_type).toBe('low_cost');
      expect(result.subsidy_amount).toBe(subsidyAmount);
      expect(result.customer_interest).toBe(result.total_interest - subsidyAmount);
      const expectedCustomerEMI = Math.round(
        (result.principal + result.customer_interest) / result.tenure_months
      );
      expect(result.customer_emi).toBe(expectedCustomerEMI);
    });

    it('caps subsidy to total_interest when subsidy exceeds it', () => {
      const subsidyAmount = 999999; // Exceeds total interest
      const result = calculateEMI({
        principal: 50000,
        bankRate,
        tenure: 12,
        emiType: 'low_cost',
        subsidyAmount,
      });

      expect(result.subsidy_amount).toBe(result.total_interest);
      expect(result.customer_interest).toBe(0);
    });

    it('handles low_cost with full subsidy string', () => {
      const result = calculateEMI({
        principal: 50000,
        bankRate,
        tenure: 12,
        emiType: 'low_cost',
        subsidyAmount: 'full',
      });

      expect(result.customer_interest).toBe(0);
      expect(result.subsidy_amount).toBe(result.total_interest);
    });

    it('rounds all values to whole rupees', () => {
      const result = calculateEMI({
        principal: 129999,
        bankRate,
        tenure: 6,
        emiType: 'standard',
        subsidyAmount: null,
      });

      expect(Number.isInteger(result.monthly_emi)).toBe(true);
      expect(Number.isInteger(result.total_payment)).toBe(true);
      expect(Number.isInteger(result.customer_emi)).toBe(true);
      expect(Number.isInteger(result.customer_total)).toBe(true);
    });

    it('includes bank name and processing fee in result', () => {
      const result = calculateEMI({
        principal: 50000,
        bankRate,
        tenure: 12,
        emiType: 'standard',
        subsidyAmount: null,
      });

      expect(result.bank).toBe('HDFC');
      expect(result.processing_fee).toBe(500);
    });
  });
});
