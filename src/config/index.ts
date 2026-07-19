/**
 * Application configuration loaded from environment variables.
 * Brand name is configurable — never hardcode it elsewhere.
 */
export const config = {
  brandName: process.env.BRAND_NAME ?? 'OfferForge',
  brandLogoUrl: process.env.BRAND_LOGO_URL ?? '',
  brandPrimaryColor: process.env.BRAND_PRIMARY_COLOR ?? '#4F46E5',
  brandSupportEmail: process.env.BRAND_SUPPORT_EMAIL ?? 'support@offerforge.io',
  brandDomain: process.env.BRAND_DOMAIN ?? 'offerforge.io',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
} as const;
