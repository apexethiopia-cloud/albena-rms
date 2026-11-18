import { mapDbError, type DbErrorLike } from '@/lib/errors'

export type UserStatus = 'active' | 'disabled'

export type RoleRef = { code: string; name: string }

export type RoleSelection = { valid: boolean; error: string | null }

/**
 * Client-side guard for the assign-role control. The database still decides
 * whether the assignment is allowed (ADR-003).
 */
export function validateRoleSelection(
  roleCode: string,
  available: readonly string[],
  assigned: readonly string[],
): RoleSelection {
  if (!roleCode) {
    return { valid: false, error: 'Choose a role to assign.' }
  }

  if (!available.includes(roleCode)) {
    return { valid: false, error: 'That role is not in the role catalogue.' }
  }

  if (assigned.includes(roleCode)) {
    return { valid: false, error: 'That role is already assigned.' }
  }

  return { valid: true, error: null }
}

export function describeUserDbError(error: DbErrorLike): string {
  return mapDbError(error, 'user accounts')
}
