/**
 * Maps BIN prefixes (first 4 digits) to bank names.
 * Supports both 6-digit and 8-digit BINs by matching the first 4 characters.
 */
const BIN_TO_BANK_MAP: Record<string, string> = {
  '4591': 'HDFC',
  '4374': 'HDFC',
  '5522': 'HDFC',
  '4026': 'ICICI',
  '4552': 'ICICI',
  '5242': 'ICICI',
  '5467': 'SBI',
  '5422': 'SBI',
  '5123': 'AXIS',
  '5413': 'AXIS',
  '4386': 'AXIS',
  '4477': 'KOTAK',
};

/**
 * Identifies the bank name from a BIN (Bank Identification Number).
 * Matches against the first 4 digits of the BIN.
 * Supports both 6-digit and 8-digit BINs.
 *
 * @param bin - The BIN string (minimum 4 characters)
 * @returns Bank name (e.g., 'HDFC', 'ICICI', 'SBI', 'AXIS', 'KOTAK') or null if unknown
 *
 * @example
 * identifyBankFromBIN('459130') // returns 'HDFC'
 * identifyBankFromBIN('4026') // returns 'ICICI'
 * identifyBankFromBIN('999999') // returns null
 */
export function identifyBankFromBIN(bin: string): string | null {
  if (!bin || bin.length < 4) {
    return null;
  }

  const prefix = bin.substring(0, 4);
  return BIN_TO_BANK_MAP[prefix] || null;
}
