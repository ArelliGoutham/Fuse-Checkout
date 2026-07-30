/**
 * Result of IMEI validation.
 */
export interface IMEIValidationResult {
  valid: boolean;
  error: string | null;
  sanitized: string;
}

/**
 * Removes all non-digit characters from the input string.
 * Useful for normalizing IMEIs entered with hyphens, spaces, or other separators.
 *
 * @param input - Raw IMEI string possibly containing separators
 * @returns Digits-only string
 *
 * @example
 * sanitizeIMEI('35-209900-176148-1'); // '352099001761481'
 */
export function sanitizeIMEI(input: string): string {
  return input.replace(/[^0-9]/g, '');
}

/**
 * Validates an IMEI number using the Luhn checksum algorithm.
 * Input is sanitized (non-digit characters removed) before validation.
 *
 * @param input - Raw IMEI string possibly containing separators
 * @returns Validation result with `valid` flag, `error` message (if invalid), and `sanitized` digits
 *
 * @example
 * const result = validateIMEI('352099001761481');
 * if (result.valid) console.log('OK', result.sanitized);
 */
export function validateIMEI(input: string): IMEIValidationResult {
  const sanitized = sanitizeIMEI(input);

  if (!sanitized) {
    return { valid: false, error: 'IMEI is empty', sanitized: '' };
  }

  if (sanitized.length !== 15) {
    return {
      valid: false,
      error: `IMEI must be 15 digits in length, got ${sanitized.length}`,
      sanitized,
    };
  }

  if (!/^\d{15}$/.test(sanitized)) {
    return {
      valid: false,
      error: 'IMEI contains non-numeric characters',
      sanitized,
    };
  }

  if (!luhnCheck(sanitized)) {
    return {
      valid: false,
      error: 'IMEI checksum verification failed',
      sanitized,
    };
  }

  return { valid: true, error: null, sanitized };
}

/**
 * Luhn algorithm checksum for IMEI.
 * Starting from the rightmost digit, double every second digit.
 * If doubling results in a two-digit number, sum the digits (equivalently subtract 9).
 * Total sum must be divisible by 10.
 *
 * @param imei - 15-digit numeric string
 * @returns true if the Luhn checksum is valid
 */
function luhnCheck(imei: string): boolean {
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(imei[14 - i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}
