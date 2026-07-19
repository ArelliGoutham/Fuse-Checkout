import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using bcryptjs with 10 salt rounds.
 * @param plaintext - The plaintext password to hash
 * @returns A promise resolving to the hashed password
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a bcrypt hash.
 * @param plaintext - The plaintext password to verify
 * @param hash - The bcrypt hash to compare against
 * @returns A promise resolving to true if passwords match, false otherwise
 */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
