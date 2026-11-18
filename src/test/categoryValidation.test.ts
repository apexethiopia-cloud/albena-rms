import { describe, expect, it } from 'vitest'
import { describeCategoryDbError, validateCategory } from '@/features/categories/validation'

describe('Category validation', () => {
  it('requires a name', () => {
    const result = validateCategory({ name: '   ', sortOrder: '0' })

    expect(result.valid).toBe(false)
    expect(result.errors.name).toBe('Category name is required.')
  })

  it('rejects names longer than 80 characters', () => {
    const result = validateCategory({ name: 'a'.repeat(81), sortOrder: '0' })

    expect(result.valid).toBe(false)
    expect(result.errors.name).toBe('Keep the name under 80 characters.')
  })

  it('normalizes the name and defaults the sort order', () => {
    const result = validateCategory({ name: '  Meat  ', sortOrder: '3' })

    expect(result.valid).toBe(true)
    expect(result.normalized).toEqual({ name: 'Meat', sortOrder: '3' })
  })

  it('defaults a missing sort order to zero', () => {
    const result = validateCategory({ name: 'Meat', sortOrder: '' })

    expect(result.valid).toBe(true)
    expect(result.normalized.sortOrder).toBe('0')
  })

  it('rejects a fractional or negative sort order', () => {
    expect(validateCategory({ name: 'Meat', sortOrder: '-1' }).errors.sortOrder).toBeDefined()
    expect(validateCategory({ name: 'Meat', sortOrder: '1.5' }).errors.sortOrder).toBeDefined()
  })

  it('maps database permission errors to a readable message', () => {
    expect(describeCategoryDbError({ message: 'nope', code: '42501' })).toBe(
      'You do not have permission to change categories.',
    )
  })
})
