import { describe, expect, it } from 'vitest'
import { describeUserDbError, validateRoleSelection } from '@/features/users/validation'

const AVAILABLE = ['system_admin', 'general_manager', 'waiter']
const ASSIGNED = ['waiter']

describe('User role validation', () => {
  it('requires a role to be chosen', () => {
    expect(validateRoleSelection('', AVAILABLE, ASSIGNED)).toEqual({
      valid: false,
      error: 'Choose a role to assign.',
    })
  })

  it('rejects a role outside the catalogue', () => {
    expect(validateRoleSelection('chef', AVAILABLE, ASSIGNED)).toEqual({
      valid: false,
      error: 'That role is not in the role catalogue.',
    })
  })

  it('rejects a role that is already assigned', () => {
    expect(validateRoleSelection('waiter', AVAILABLE, ASSIGNED)).toEqual({
      valid: false,
      error: 'That role is already assigned.',
    })
  })

  it('accepts a new role from the catalogue', () => {
    expect(validateRoleSelection('general_manager', AVAILABLE, ASSIGNED)).toEqual({
      valid: true,
      error: null,
    })
  })

  it('maps database permission errors to a readable message', () => {
    expect(describeUserDbError({ message: 'nope', code: '42501' })).toBe(
      'You do not have permission to change user accounts.',
    )
  })

  it('maps a missing record to a refresh message', () => {
    expect(describeUserDbError({ message: 'not found', code: 'P0002' })).toBe(
      'That record no longer exists. Refresh and try again.',
    )
  })
})
