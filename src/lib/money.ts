/** Rounds a number to the nearest whole rupee (round half up). */
export function roundToRupee(amount: number): number {
  return Math.round(amount);
}

/** Formats a rupee amount with the ₹ symbol and Indian-style comma grouping. */
export function formatRupee(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/** Returns the minimum of two numbers. */
export function min(a: number, b: number): number {
  return a <= b ? a : b;
}
