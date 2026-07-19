/**
 * Character set for invite codes: A-Z except I/O, digits 2-9 (no 0/1).
 * This avoids ambiguous characters that can be confused with each other.
 */
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 6;

/**
 * Generates a random 6-character invite code.
 * Uses base32-like character set (A-Z except I/O, digits 2-9).
 * @returns A 6-character invite code
 */
export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * INVITE_CODE_CHARS.length);
    code += INVITE_CODE_CHARS[randomIndex];
  }
  return code;
}
