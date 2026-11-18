import { describe, expect, it } from 'vitest'
import {
  describeMenuDbError,
  validateMenuItem,
  type MenuItemDraft,
} from '@/features/menu/validation'

const CATEGORIES = ['cat-main', 'cat-drinks']

function draft(overrides: Partial<MenuItemDraft> = {}): MenuItemDraft {
  return {
    code: 'OM-01',
    name: 'Cheese omelette',
    categoryId: 'cat-main',
    sellingPrice: '180.50',
    recipeId: '',
    ...overrides,
  }
}

describe('validateMenuItem', () => {
  it('normalizes the code, trims the name and parses the price', () => {
    const result = validateMenuItem(
      draft({ code: ' om-01 ', name: '  Cheese omelette  ' }),
      CATEGORIES,
    )

    expect(result.valid).toBe(true)
    expect(result.value).toEqual({
      code: 'OM-01',
      name: 'Cheese omelette',
      categoryId: 'cat-main',
      sellingPrice: 180.5,
      recipeId: null,
    })
  })

  it('keeps a linked recipe', () => {
    const result = validateMenuItem(draft({ recipeId: 'recipe-1' }), CATEGORIES)

    expect(result.valid).toBe(true)
    expect(result.value?.recipeId).toBe('recipe-1')
  })

  it('rejects a blank code, name or category', () => {
    const result = validateMenuItem(
      draft({ code: '  ', name: '  ', categoryId: '' }),
      CATEGORIES,
    )

    expect(result.valid).toBe(false)
    expect(result.errors.code).toMatch(/menu code/i)
    expect(result.errors.name).toMatch(/menu item name/i)
    expect(result.errors.categoryId).toMatch(/menu category/i)
  })

  it('rejects a category that is not active', () => {
    const result = validateMenuItem(draft({ categoryId: 'cat-old' }), CATEGORIES)

    expect(result.valid).toBe(false)
    expect(result.errors.categoryId).toMatch(/active menu category/i)
  })

  it('accepts a zero price but rejects negative or non-numeric prices', () => {
    expect(validateMenuItem(draft({ sellingPrice: '0' }), CATEGORIES).valid).toBe(true)

    for (const sellingPrice of ['-1', 'abc', '']) {
      const result = validateMenuItem(draft({ sellingPrice }), CATEGORIES)
      expect(result.valid).toBe(false)
      expect(result.errors.sellingPrice).toMatch(/zero or more/i)
    }
  })

  it('rejects an overlong code or name', () => {
    const result = validateMenuItem(
      draft({ code: 'C'.repeat(41), name: 'N'.repeat(121) }),
      CATEGORIES,
    )

    expect(result.valid).toBe(false)
    expect(result.errors.code).toMatch(/40 characters/i)
    expect(result.errors.name).toMatch(/120 characters/i)
  })
})

describe('describeMenuDbError', () => {
  it('explains a duplicate menu code', () => {
    expect(describeMenuDbError({ code: '23505', message: 'duplicate key' })).toMatch(
      /already in use/i,
    )
  })

  it('passes through menu rule violations', () => {
    expect(
      describeMenuDbError({ code: '23514', message: 'A menu code is required' }),
    ).toBe('A menu code is required')
  })

  it('maps permission errors', () => {
    expect(describeMenuDbError({ code: '42501', message: 'denied' })).toMatch(
      /do not have permission/i,
    )
  })
})
