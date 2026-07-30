import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Encrypts plaintext using AES-256-CBC with a random IV.
 * Output format: "iv_hex:ciphertext_hex"
 *
 * @param plaintext - The string to encrypt
 * @param key - 32-byte encryption key (from ENCRYPTION_KEY env var)
 * @returns Encrypted string in "iv:ciphertext" format
 */
export function encrypt(plaintext: string, key: string): string {
  const keyBuffer = Buffer.from(key.padEnd(32).slice(0, 32), 'utf8');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a string in "iv:ciphertext" format using AES-256-CBC.
 *
 * @param encryptedData - String in "iv_hex:ciphertext_hex" format
 * @param key - 32-byte encryption key (must match the one used for encryption)
 * @returns Decrypted plaintext
 * @throws Error if decryption fails (wrong key, corrupted data)
 */
export function decrypt(encryptedData: string, key: string): string {
  const [ivHex, ciphertextHex] = encryptedData.split(':');
  if (!ivHex || !ciphertextHex) {
    throw new Error('Invalid encrypted data format');
  }
  const keyBuffer = Buffer.from(key.padEnd(32).slice(0, 32), 'utf8');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
