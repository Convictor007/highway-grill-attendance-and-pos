/** System Admin — platform settings, compliance, staff logins (HG_web admin portal). */
export const ADMIN_ROLE_SLUG = 'admin' as const

/** Super Admin — security monitoring only (logs, threats, employee map). */
export const SUPER_ADMIN_ROLE_SLUG = 'super_admin' as const

/** Accounts excluded from Staff logins management. */
export const PLATFORM_OWNER_ROLE_SLUGS = [ADMIN_ROLE_SLUG, SUPER_ADMIN_ROLE_SLUG] as const

export type AdminRoleSlug = typeof ADMIN_ROLE_SLUG
export type SuperAdminRoleSlug = typeof SUPER_ADMIN_ROLE_SLUG

export function isSystemAdminRoleSlug(slug?: string | null): slug is AdminRoleSlug {
  return slug === ADMIN_ROLE_SLUG
}

export function isSuperAdminRoleSlug(slug?: string | null): slug is SuperAdminRoleSlug {
  return slug === SUPER_ADMIN_ROLE_SLUG
}

export function isPlatformOwnerRoleSlug(slug?: string | null): boolean {
  return slug != null && (PLATFORM_OWNER_ROLE_SLUGS as readonly string[]).includes(slug)
}
