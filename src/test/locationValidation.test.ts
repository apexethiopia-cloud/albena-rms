import { describe, expect, it } from 'vitest'
import { describeLocationDbError, validateLocation } from '@/features/locations/validation'

describe('validateLocation', () => {
  it('accepts and normalizes a valid location', () => {
    const result = validateLocation({ code: ' BAR ', name: '  Bar Store  ' })

    expect(result.valid).toBe(true)
    expect(result.normalized).toEqual({ code: 'BAR', name: 'Bar Store' })
  })

  it('accepts a blank code but still requires a name', () => {
    const blankCode = validateLocation({ code: '   ', name: 'Bar Store' })

    expect(blankCode.valid).toBe(true)
    expect(blankCode.errors.code).toBeUndefined()
    expect(blankCode.normalized).toEqual({ code: '', name: 'Bar Store' })

    const result = validateLocation({ code: '', name: '' })

    expect(result.valid).toBe(false)
    expect(result.errors.code).toBeUndefined()
    expect(result.errors.name).toBeDefined()
  })

  it('rejects codes that are too long and names that are too long', () => {
    expect(validateLocation({ code: 'ABCDEFGHIJKLM', name: 'Bar Store' }).errors.code).toBeDefined()
    expect(validateLocation({ code: 'BAR', name: 'x'.repeat(81) }).errors.name).toBeDefined()
  })
})

describe('describeLocationDbError', () => {
  it('names stock locations in the permission message', () => {
    expect(describeLocationDbError({ code: '42501', message: 'denied' })).toMatch(/stock locations/i)
  })

  it('falls back to the database message', () => {
    expect(describeLocationDbError({ code: 'XX000', message: 'unexpected' })).toBe('unexpected')
  })
})
