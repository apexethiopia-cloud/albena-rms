import { mapDbError, type DbErrorLike } from '@/lib/errors'
import {
  parseNonNegativeNumber,
  type Validation,
} from '@/features/stock/validation'

export type MenuItemDraft = {
  code: string
  name: string
  categoryId: string
  sellingPrice: string
  recipeId: string
}

export type NormalizedMenuItem = {
  code: string
  name: string
  categoryId: string
  sellingPrice: number
  recipeId: string | null
}

export function validateMenuItem(
  input: MenuItemDraft,
  categoryIds: string[],
): Validation<NormalizedMenuItem> {
  const errors: Record<string, string> = {}
  // A blank code is valid: the database trigger generates the master code.
  const code = input.code.trim().toUpperCase()

  if (code.length > 40) errors.code = 'Use 40 characters or fewer.'

  if (!input.name.trim()) errors.name = 'Enter a menu item name.'
  else if (input.name.trim().length > 120) errors.name = 'Use 120 characters or fewer.'

  if (!input.categoryId) errors.categoryId = 'Choose a menu category.'
  else if (!categoryIds.includes(input.categoryId)) {
    errors.categoryId = 'Choose an active menu category.'
  }

  const price = parseNonNegativeNumber(input.sellingPrice)
  if (price === null) {
    errors.sellingPrice = 'Enter a selling price of zero or more.'
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, value: null, errors }
  }

  return {
    valid: true,
    errors,
    value: {
      code,
      name: input.name.trim(),
      categoryId: input.categoryId,
      sellingPrice: price as number,
      recipeId: input.recipeId || null,
    },
  }
}

export function describeMenuDbError(error: DbErrorLike): string {
  if (error.code === '23505') {
    return 'That menu code is already in use. Choose a different code.'
  }
  if (error.code === '23514' && /code|name|price/i.test(error.message)) {
    return error.message
  }
  return mapDbError(error, 'menu items')
}
