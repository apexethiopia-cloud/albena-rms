import { describe, expect, it } from 'vitest'
import { describeDbError, toMessage, validateOutlet } from '@/features/outlets/validation'

describe('validateOutlet', () => {
  it('accepts and normalizes a valid outlet', () => {
    const result = validateOutlet({ code: ' terrace ', name: '  Terrace Restaurant  ' })

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
    expect(result.normalized).toEqual({ code: 'TERRACE', name: 'Terrace Restaurant' })
  })

  it('requires a code', () => {
    const result = validateOutlet({ code: '', name: 'Terrace' })

    expect(result.valid).toBe(false)
    expect(result.errors.code).toMatch(/required/i)
  })

  it('rejects codes that are too short or contain spaces', () => {
    expect(validateOutlet({ code: 'A', name: 'A' }).errors.code).toBeDefined()
    expect(validateOutlet({ code: 'POOL BAR', name: 'Pool Bar' }).errors.code).toBeDefined()
  })

  it('requires a name', () => {
    const result = validateOutlet({ code: 'POOL', name: '   ' })

    expect(result.valid).toBe(false)
    expect(result.errors.name).toMatch(/required/i)
  })

  it('rejects names longer than 80 characters', () => {
    const result = validateOutlet({ code: 'POOL', name: 'x'.repeat(81) })

    expect(result.valid).toBe(false)
    expect(result.errors.name).toMatch(/80 characters/i)
  })

  it('accepts digits, hyphens and underscores in the code', () => {
    expect(validateOutlet({ code: 'BAR-2_NORTH', name: 'Bar 2' }).valid).toBe(true)
  })
})

describe('describeDbError', () => {
  it('explains a duplicate code', () => {
    expect(describeDbError({ code: '23505', message: 'duplicate key' })).toMatch(/already in use/i)
  })

  it('explains a permission failure', () => {
    expect(describeDbError({ code: '42501', message: 'denied' })).toMatch(/permission/i)
  })

  it('falls back to the database message for unknown codes', () => {
    expect(describeDbError({ code: 'XX000', message: 'unexpected' })).toBe('unexpected')
  })
})

describe('toMessage', () => {
  it('unwraps an Error', () => {
    expect(toMessage(new Error('boom'))).toBe('boom')
  })

  it('has a friendly fallback for non-errors', () => {
    expect(toMessage('boom')).toMatch(/something went wrong/i)
  })
})
