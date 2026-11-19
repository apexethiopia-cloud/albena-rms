import { describe, expect, it } from 'vitest'
import {
  describeItemDbError,
  validateItem,
  type ItemInput,
} from '@/features/items/validation'

const VALID: ItemInput = {
  code: ' tomato-01 ',
  name: ' Tomato, fresh ',
  categoryId: 'cat-veg',
  baseUnitId: 'unit-g',
  purchaseUnitId: 'unit-box',
  reorderLevel: '5000',
}

describe('validateItem', () => {
  it('accepts a complete item and normalizes values', () => {
    const result = validateItem(VALID)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
    expect(result.normalized).toEqual({
      code: 'TOMATO-01',
      name: 'Tomato, fresh',
      categoryId: 'cat-veg',
      baseUnitId: 'unit-g',
      purchaseUnitId: 'unit-box',
      reorderLevel: 5000,
    })
  })

  it('treats category and purchase unit as optional', () => {
    const result = validateItem({
      ...VALID,
      categoryId: '',
      purchaseUnitId: '',
    })

    expect(result.valid).toBe(true)
    expect(result.normalized.categoryId).toBeNull()
    expect(result.normalized.purchaseUnitId).toBeNull()
  })

  it('accepts a blank code but still requires a name and base unit', () => {
    const blankCode = validateItem({ ...VALID, code: '   ' })

    expect(blankCode.valid).toBe(true)
    expect(blankCode.errors.code).toBeUndefined()
    expect(blankCode.normalized.code).toBe('')

    const result = validateItem({ ...VALID, code: ' ', name: '', baseUnitId: '' })

    expect(result.errors.code).toBeUndefined()
    expect(result.errors.name).toMatch(/required/i)
    expect(result.errors.baseUnitId).toMatch(/base unit/i)
  })

  it('rejects an invalid code and an over-long name', () => {
    expect(validateItem({ ...VALID, code: 'A' }).errors.code).toBeDefined()
    expect(validateItem({ ...VALID, code: 'has space' }).errors.code).toBeDefined()
    expect(validateItem({ ...VALID, name: 'x'.repeat(121) }).errors.name).toMatch(/120/)
  })

  it('requires a reorder level, accepting 0 and up to 6 decimals', () => {
    expect(validateItem({ ...VALID, reorderLevel: '' }).errors.reorderLevel).toBeDefined()
    expect(validateItem({ ...VALID, reorderLevel: '0' }).valid).toBe(true)
    expect(validateItem({ ...VALID, reorderLevel: '12.345678' }).valid).toBe(true)
  })

  it('rejects negative, non-numeric and over-precise reorder levels', () => {
    expect(validateItem({ ...VALID, reorderLevel: '-1' }).errors.reorderLevel).toBeDefined()
    expect(validateItem({ ...VALID, reorderLevel: 'abc' }).errors.reorderLevel).toBeDefined()
    expect(validateItem({ ...VALID, reorderLevel: '1.1234567' }).errors.reorderLevel).toBeDefined()
  })
})

describe('describeItemDbError', () => {
  it('names items in the permission message', () => {
    expect(describeItemDbError({ code: '42501', message: 'denied' })).toMatch(/items/i)
  })

  it('explains a duplicate code', () => {
    expect(describeItemDbError({ code: '23505', message: 'dup' })).toMatch(/already in use/i)
  })

  it('falls back to the database message', () => {
    expect(describeItemDbError({ code: 'XX000', message: 'unexpected' })).toBe('unexpected')
  })
})
