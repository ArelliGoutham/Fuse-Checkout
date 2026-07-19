import jwt from 'jsonwebtoken';

/**
 * JWT token payload interface.
 */
export interface TokenPayload {
  user_id: string;
  merchant_id: string;
  role: string;
}

// Get JWT secret from environment or use dev default
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const TOKEN_EXPIRY = '7d';

/**
 * Generates a JWT token with the given payload.
 * Token expires in 7 days.
 * @param payload - The token payload containing user_id, merchant_id, and role
 * @returns The signed JWT token
 */
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verifies and decodes a JWT token.
 * @param token - The JWT token to verify
 * @returns The decoded token payload including exp claim
 * @throws If token is invalid or expired
 */
export function verifyToken(token: string): TokenPayload & { exp: number; iat: number } {
  return jwt.verify(token, JWT_SECRET) as TokenPayload & { exp: number; iat: number };
}
