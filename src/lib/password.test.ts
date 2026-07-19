import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('hashPassword returns a hash', async () => {
    const hash = await hashPassword('myPassword123');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
    expect(hash).not.toBe('myPassword123');
  });

  it('verifyPassword returns true for correct password', async () => {
    const plaintext = 'correctPassword456';
    const hash = await hashPassword(plaintext);
    const result = await verifyPassword(plaintext, hash);
    expect(result).toBe(true);
  });

  it('verifyPassword returns false for incorrect password', async () => {
    const plaintext = 'correctPassword456';
    const hash = await hashPassword(plaintext);
    const result = await verifyPassword('wrongPassword', hash);
    expect(result).toBe(false);
  });

  it('different passwords produce different hashes', async () => {
    const hash1 = await hashPassword('password1');
    const hash2 = await hashPassword('password2');
    expect(hash1).not.toBe(hash2);
  });

  it('same password produces different hashes (salt rounds)', async () => {
    const hash1 = await hashPassword('samePassword');
    const hash2 = await hashPassword('samePassword');
    expect(hash1).not.toBe(hash2);
  });
});
