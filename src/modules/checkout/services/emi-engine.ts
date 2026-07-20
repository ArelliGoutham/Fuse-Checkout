import { EMICalculation } from '../schemas/emi-calculation';

/**
 * Calculates EMI using the reducing balance formula.
 * EMI = P * r * (1+r)^n / ((1+r)^n - 1)
 * where r = annual_rate / 12 / 100
 * All values rounded to whole rupees.
 *
 * @param principal - Loan amount in rupees
 * @param annualRate - Annual interest rate as percentage (e.g., 15 for 15%)
 * @param tenureMonths - Loan tenure in months
 * @returns Object with monthly_emi, total_payment, and total_interest (all in whole rupees)
 */
export function calculateStandardEMI(
  principal: number,
  annualRate: number,
  tenureMonths: number
): { monthly_emi: number; total_payment: number; total_interest: number } {
  if (annualRate === 0) {
    const emi = Math.round(principal / tenureMonths);
    return {
      monthly_emi: emi,
      total_payment: principal,
      total_interest: 0,
    };
  }

  // Convert annual rate to monthly rate (0-1 scale)
  const monthlyRate = annualRate / 12 / 100;

  // Reducing balance formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
  const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths);
  const denominator = Math.pow(1 + monthlyRate, tenureMonths) - 1;
  const monthlyEMI = Math.round(numerator / denominator);

  const totalPayment = monthlyEMI * tenureMonths;
  const totalInterest = totalPayment - principal;

  return {
    monthly_emi: monthlyEMI,
    total_payment: totalPayment,
    total_interest: Math.max(0, totalInterest), // Ensure non-negative due to rounding
  };
}

interface BankRateInput {
  bank_name: string;
  interest_rate: number;
  processing_fee: number | null;
}

interface CalculateEMIParams {
  principal: number;
  bankRate: BankRateInput;
  tenure: number;
  emiType: 'standard' | 'no_cost' | 'low_cost';
  subsidyAmount: number | 'full' | null;
}

/**
 * Calculates EMI with support for standard, no-cost, and low-cost types with subsidies.
 * - standard: customer pays full interest, no subsidy
 * - no_cost (or low_cost + 'full'): customer pays 0 interest, subsidy covers all interest
 * - low_cost + number: customer pays (total_interest - subsidy), subsidy is capped at total_interest
 * All values rounded to whole rupees.
 *
 * @param params - Calculation parameters including principal, bank rate, tenure, EMI type, and subsidy
 * @returns EMICalculation object with all details
 */
export function calculateEMI(params: CalculateEMIParams): EMICalculation {
  const { principal, bankRate, tenure, emiType, subsidyAmount } = params;

  // Calculate base EMI using standard formula
  const standardEMI = calculateStandardEMI(
    principal,
    bankRate.interest_rate,
    tenure
  );

  let customerInterest = standardEMI.total_interest;
  let subsidyAmt = 0;

  if (emiType === 'standard') {
    // Customer pays full interest, no subsidy
    subsidyAmt = 0;
    customerInterest = standardEMI.total_interest;
  } else if (emiType === 'no_cost') {
    // No-cost EMI: customer pays 0 interest, full subsidy
    subsidyAmt = standardEMI.total_interest;
    customerInterest = 0;
  } else if (emiType === 'low_cost') {
    // Low-cost EMI: partial subsidy
    if (subsidyAmount === 'full') {
      subsidyAmt = standardEMI.total_interest;
      customerInterest = 0;
    } else if (typeof subsidyAmount === 'number' && subsidyAmount > 0) {
      // Cap subsidy at total interest
      subsidyAmt = Math.min(subsidyAmount, standardEMI.total_interest);
      customerInterest = standardEMI.total_interest - subsidyAmt;
    } else {
      // No subsidy or null
      subsidyAmt = 0;
      customerInterest = standardEMI.total_interest;
    }
  }

  // Calculate customer EMI: (principal + customer_interest) / tenure
  const customerEMI = Math.round(
    (principal + customerInterest) / tenure
  );

  const customerTotal = principal + customerInterest;

  return {
    principal,
    tenure_months: tenure,
    interest_rate: bankRate.interest_rate,
    monthly_emi: standardEMI.monthly_emi,
    total_payment: standardEMI.total_payment,
    total_interest: standardEMI.total_interest,
    customer_emi: customerEMI,
    customer_interest: customerInterest,
    customer_total: customerTotal,
    subsidy_amount: subsidyAmt,
    emi_type: emiType,
    bank: bankRate.bank_name,
    processing_fee: bankRate.processing_fee,
  };
}
