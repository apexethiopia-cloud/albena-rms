import { describe, expect, it } from 'vitest'
import { hasRole } from '@/features/auth/auth-context'

describe('hasRole', () => {
  const roles = ['system_admin', 'general_manager']

  it('matches an assigned role', () => {
    expect(hasRole(roles, 'system_admin')).toBe(true)
  })

  it('rejects a role the user does not hold', () => {
    expect(hasRole(roles, 'waiter')).toBe(false)
  })

  it('treats an empty role list as no access', () => {
    expect(hasRole([], 'general_manager')).toBe(false)
  })
})
