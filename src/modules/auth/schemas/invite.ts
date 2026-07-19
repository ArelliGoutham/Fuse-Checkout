import { z } from 'zod';

/**
 * Role enum and type for the merchant team.
 */
export const ROLES = ['owner', 'admin', 'offer_manager', 'analytics_viewer'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Role hierarchy levels for permission checks.
 * Higher number = more permissions.
 */
export const ROLE_LEVELS: Record<Role, number> = {
  owner: 4,
  admin: 3,
  offer_manager: 2,
  analytics_viewer: 1,
};

/**
 * Checks if a user with inviterRole can invite someone to targetRole.
 * A role can only invite users with lower or equal role level.
 * @param inviterRole - The role of the person inviting
 * @param targetRole - The role being invited to
 * @returns true if the invitation is allowed
 */
export function canInvite(inviterRole: Role, targetRole: Role): boolean {
  return ROLE_LEVELS[inviterRole] > ROLE_LEVELS[targetRole];
}

/**
 * Schema for a merchant user record in the database.
 */
export const MerchantUserSchema = z.object({
  _id: z.string(),
  merchant_id: z.string(),
  email: z.string().email(),
  user_id: z.string().nullable(),
  role: z.enum(ROLES),
  status: z.enum(['pending', 'active', 'removed', 'expired']),
  invite_code: z.string(),
  invited_by: z.string(),
  invited_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  accepted_at: z.string().datetime().nullable(),
});

/**
 * Schema for creating an invite (inviter provides email and role).
 * Note: Only admin roles can be invited, not owner.
 */
export const CreateInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'offer_manager', 'analytics_viewer']),
});

/**
 * Schema for accepting an invite.
 */
export const AcceptInviteSchema = z.object({
  invite_code: z.string().min(6).max(6),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export type MerchantUser = z.infer<typeof MerchantUserSchema>;
export type CreateInviteInput = z.infer<typeof CreateInviteSchema>;
export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>;
