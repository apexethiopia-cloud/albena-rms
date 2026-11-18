import { mapDbError, type DbErrorLike } from '@/lib/errors'

export type ItemInput = {
  code: string
  name: string
  categoryId: string
  baseUnitId: string
  purchaseUnitId: string
  reorderLevel: string
}

export type NormalizedItem = {
  code: string
  name: string
  categoryId: string | null
  baseUnitId: string
  purchaseUnitId: string | null
  reorderLevel: number
}

export type ItemValidation = {
  valid: boolean
  errors: Record<string, string>
  normalized: NormalizedItem
}

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,19}$/
const DECIMAL_PATTERN = /^\d+(\.\d{1,6})?$/

export function validateItem(input: ItemInput): ItemValidation {
  const errors: Record<string, string> = {}
  const code = input.code.trim().toUpperCase()
  const name = input.name.trim()
  const reorderLevel = input.reorderLevel.trim()

  if (!code) {
    errors.code = 'Code is required.'
  } else if (!CODE_PATTERN.test(code)) {
    errors.code = 'Use 2–20 characters: letters, digits, hyphen or underscore.'
  }

  if (!name) {
    errors.name = 'Item name is required.'
  } else if (name.length > 120) {
    errors.name = 'Keep the name under 120 characters.'
  }

  if (!input.baseUnitId) {
    errors.baseUnitId = 'Choose the base unit stock is counted in.'
  }

  if (!reorderLevel) {
    errors.reorderLevel = 'Enter 0 if there is no reorder level.'
  } else if (!DECIMAL_PATTERN.test(reorderLevel)) {
    errors.reorderLevel = 'Use a non-negative number with up to 6 decimals.'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalized: {
      code,
      name,
      categoryId: input.categoryId || null,
      baseUnitId: input.baseUnitId,
      purchaseUnitId: input.purchaseUnitId || null,
      reorderLevel: Number(reorderLevel || '0'),
    },
  }
}

export function describeItemDbError(error: DbErrorLike): string {
  return mapDbError(error, 'items')
}
