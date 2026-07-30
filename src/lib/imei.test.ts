import { validateIMEI, sanitizeIMEI } from './imei';

describe('IMEI validation', () => {
  it('valid 15-digit IMEI passes', () => {
    const result = validateIMEI('352099001761481');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('invalid checksum fails', () => {
    const result = validateIMEI('352099001761482');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('checksum');
  });

  it('too short (14 digits) fails', () => {
    const result = validateIMEI('35209900176148');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('length');
  });

  it('too long (16 digits) fails', () => {
    const result = validateIMEI('3520990017614812');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('length');
  });

  it('non-numeric characters fail', () => {
    const result = validateIMEI('35209900176148X');
    expect(result.valid).toBe(false);
  });

  it('empty string fails', () => {
    const result = validateIMEI('');
    expect(result.valid).toBe(false);
  });

  it('sanitizes input (removes hyphens and spaces)', () => {
    const result = validateIMEI('35-209900-176148-1');
    expect(result.valid).toBe(true);
  });

  it('sanitizeIMEI returns digits only', () => {
    expect(sanitizeIMEI('35-209900-176148-1')).toBe('352099001761481');
    expect(sanitizeIMEI('35 2099 0017 614 81')).toBe('352099001761481');
  });
});
