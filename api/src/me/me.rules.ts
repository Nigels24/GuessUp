/**
 * Account rules that depend on the role, for PATCH /api/me and
 * POST /api/me/password (students in the app, administrators in the panel).
 * Pure, so they are unit tested.
 */
import type { Role } from '@prisma/client';

/** Shortest new password per role. Students keep registration's 8 (also checked by the DTO). */
export const PASSWORD_MIN_LENGTH: Record<Role, number> = { STUDENT: 8, ADMIN: 10 };

export const ME_RULE_MESSAGES = {
  adminPasswordTooShort: `Administrator passwords must be at least ${PASSWORD_MIN_LENGTH.ADMIN} characters.`,
  samePassword: 'The new password must be different from the current password.',
  noYearLevel: 'Administrator accounts have no year level.',
} as const;

/** Why a profile change is not allowed for this role, or null. */
export function profileProblem(role: Role, changes: { yearLevel?: string }): string | null {
  if (role === 'ADMIN' && changes.yearLevel !== undefined) return ME_RULE_MESSAGES.noYearLevel;
  return null;
}

/** Checked before the current password: rules on the new password alone. */
export function newPasswordProblem(role: Role, newPassword: string): string | null {
  if (role === 'ADMIN' && newPassword.length < PASSWORD_MIN_LENGTH.ADMIN) {
    return ME_RULE_MESSAGES.adminPasswordTooShort;
  }
  return null;
}

/**
 * Checked after the current password was verified, so a wrong current
 * password is always reported as such. Administrators must pick a new one.
 */
export function samePasswordProblem(role: Role, currentPassword: string, newPassword: string): string | null {
  if (role === 'ADMIN' && newPassword === currentPassword) return ME_RULE_MESSAGES.samePassword;
  return null;
}
