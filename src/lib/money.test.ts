import { roundToRupee, formatRupee, min } from './money';

describe('roundToRupee', () => {
  it('rounds 4166.666 to 4167', () => {
    expect(roundToRupee(4166.666)).toBe(4167);
  });
  it('rounds 4166.4 to 4166', () => {
    expect(roundToRupee(4166.4)).toBe(4166);
  });
  it('rounds 0.5 to 1 (round half up)', () => {
    expect(roundToRupee(0.5)).toBe(1);
  });
  it('rounds 0.4 to 0', () => {
    expect(roundToRupee(0.4)).toBe(0);
  });
  it('handles zero', () => {
    expect(roundToRupee(0)).toBe(0);
  });
});

describe('formatRupee', () => {
  it('formats 50000 as ₹50,000', () => {
    expect(formatRupee(50000)).toBe('₹50,000');
  });
  it('formats 0 as ₹0', () => {
    expect(formatRupee(0)).toBe('₹0');
  });
  it('formats 999 as ₹999', () => {
    expect(formatRupee(999)).toBe('₹999');
  });
});

describe('min', () => {
  it('returns the smaller of two numbers', () => {
    expect(min(10, 20)).toBe(10);
  });
  it('handles equal values', () => {
    expect(min(50, 50)).toBe(50);
  });
});
