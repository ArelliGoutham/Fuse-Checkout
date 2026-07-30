import { encrypt, decrypt } from './encryption';

describe('encryption utility', () => {
  const testKey = 'fuse-encryption-key-32-bytes!!!'; // 32 bytes for AES-256

  it('encrypt returns ciphertext different from plaintext', () => {
    const result = encrypt('sk_live_abc123', testKey);
    expect(result).not.toBe('sk_live_abc123');
    expect(result).toContain(':'); // format: iv:ciphertext
  });

  it('decrypt(encrypt(x)) returns original plaintext', () => {
    const original = 'rzp_live_secret_key_12345';
    const encrypted = encrypt(original, testKey);
    const decrypted = decrypt(encrypted, testKey);
    expect(decrypted).toBe(original);
  });

  it('encrypt produces different output for same input (random IV)', () => {
    const a = encrypt('same_input', testKey);
    const b = encrypt('same_input', testKey);
    expect(a).not.toBe(b); // different IV = different ciphertext
  });

  it('decrypt with wrong key throws error', () => {
    const encrypted = encrypt('secret', testKey);
    expect(() => decrypt(encrypted, 'wrong-key-32-bytes-wrong!!!!')).toThrow();
  });

  it('encrypt handles empty string', () => {
    const encrypted = encrypt('', testKey);
    expect(decrypt(encrypted, testKey)).toBe('');
  });

  it('encrypt handles long strings', () => {
    const long = 'x'.repeat(500);
    const encrypted = encrypt(long, testKey);
    expect(decrypt(encrypted, testKey)).toBe(long);
  });
});
