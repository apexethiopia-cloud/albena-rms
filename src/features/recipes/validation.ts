import { mapDbError, type DbErrorLike } from '@/lib/errors'
import {
  parseNonNegativeNumber,
  parsePositiveNumber,
  resolveUnitFactor,
  type StockContext,
  type Validation,
} from '@/features/stock/validation'

export type RecipeLineDraft = {
  key: string
  itemId: string
  unitId: string
  quantity: string
}

export type RecipeDraft = {
  name: string
  menuItemName: string
  notes: string
  yieldQuantity: string
  sellingPrice: string
  lines: RecipeLineDraft[]
}

export type RecipeVersionDraft = {
  notes: string
  yieldQuantity: string
  sellingPrice: string
  lines: RecipeLineDraft[]
}

export type NormalizedRecipeLine = {
  itemId: string
  unitId: string
  quantity: number
}

export type NormalizedRecipe = {
  name: string
  menuItemName: string | null
  notes: string | null
  yieldQuantity: number
  sellingPrice: number
  lines: NormalizedRecipeLine[]
}

export type NormalizedRecipeVersion = {
  notes: string | null
  yieldQuantity: number
  sellingPrice: number
  lines: NormalizedRecipeLine[]
}

export type RecipeHeaderDraft = {
  name: string
  menuItemName: string
  notes: string
}

type NormalizedRecipeHeader = RecipeHeaderDraft

/** Validates the editable recipe header fields; the code and versions stay immutable. */
export function validateRecipeHeader(input: RecipeHeaderDraft): Validation<NormalizedRecipeHeader> {
  const errors: Record<string, string> = {}

  if (!input.name.trim()) errors.name = 'Enter a recipe name.'
  else if (input.name.trim().length > 120) errors.name = 'Use 120 characters or fewer.'
  if (input.menuItemName.trim().length > 120) {
    errors.menuItemName = 'Use 120 characters or fewer.'
  }
  if (input.notes.trim().length > 500) errors.notes = 'Use 500 characters or fewer.'

  if (Object.keys(errors).length > 0) {
    return { valid: false, value: null, errors }
  }

  return {
    valid: true,
    errors,
    value: {
      name: input.name.trim(),
      menuItemName: input.menuItemName.trim(),
      notes: input.notes.trim(),
    },
  }
}

function normalizeLines(
  lines: readonly RecipeLineDraft[],
  context: StockContext,
  errors: Record<string, string>,
): NormalizedRecipeLine[] {
  const normalized: NormalizedRecipeLine[] = []

  if (lines.length === 0) {
    errors.lines = 'Add at least one ingredient.'
  }

  lines.forEach((line, index) => {
    const prefix = `line-${index}`
    let lineValid = true

    if (!line.itemId) {
      errors[`${prefix}-item`] = 'Choose an ingredient.'
      lineValid = false
    } else if (!context.items.some((item) => item.id === line.itemId && item.is_active)) {
      errors[`${prefix}-item`] = 'Choose an active ingredient.'
      lineValid = false
    }

    const quantity = parsePositiveNumber(line.quantity)
    if (quantity === null) {
      errors[`${prefix}-quantity`] = 'Enter a quantity greater than zero.'
      lineValid = false
    }

    if (!line.unitId) {
      errors[`${prefix}-unit`] = 'Choose a unit.'
      lineValid = false
    } else if (line.itemId) {
      const resolved = resolveUnitFactor(line.itemId, line.unitId, context)
      if (resolved.error) errors[`${prefix}-unit`] = resolved.error
      else if (resolved.factor === null) lineValid = false
    }

    if (lineValid && line.itemId && line.unitId && quantity !== null) {
      normalized.push({ itemId: line.itemId, unitId: line.unitId, quantity })
    }
  })

  return normalized
}

function validateHeader(
  yieldQuantity: string,
  sellingPrice: string,
  errors: Record<string, string>,
): { yieldQuantity: number | null; sellingPrice: number | null } {
  const yieldValue = parsePositiveNumber(yieldQuantity)
  if (yieldValue === null) {
    errors.yieldQuantity = 'Enter how many portions this version yields.'
  }

  const price = parseNonNegativeNumber(sellingPrice)
  if (price === null) {
    errors.sellingPrice = 'Enter a selling price of zero or more.'
  }

  return { yieldQuantity: yieldValue, sellingPrice: price }
}

export function validateRecipe(
  input: RecipeDraft,
  context: StockContext,
): Validation<NormalizedRecipe> {
  const errors: Record<string, string> = {}

  if (!input.name.trim()) errors.name = 'Enter a recipe name.'
  else if (input.name.trim().length > 120) errors.name = 'Use 120 characters or fewer.'

  if (input.menuItemName.trim().length > 120) {
    errors.menuItemName = 'Use 120 characters or fewer.'
  }
  if (input.notes.trim().length > 500) errors.notes = 'Use 500 characters or fewer.'

  const header = validateHeader(input.yieldQuantity, input.sellingPrice, errors)
  const lines = normalizeLines(input.lines, context, errors)

  if (Object.keys(errors).length > 0) {
    return { valid: false, value: null, errors }
  }

  return {
    valid: true,
    errors,
    value: {
      name: input.name.trim(),
      menuItemName: input.menuItemName.trim() || null,
      notes: input.notes.trim() || null,
      yieldQuantity: header.yieldQuantity as number,
      sellingPrice: header.sellingPrice as number,
      lines,
    },
  }
}

export function validateRecipeVersion(
  input: RecipeVersionDraft,
  context: StockContext,
): Validation<NormalizedRecipeVersion> {
  const errors: Record<string, string> = {}

  if (input.notes.trim().length > 500) errors.notes = 'Use 500 characters or fewer.'

  const header = validateHeader(input.yieldQuantity, input.sellingPrice, errors)
  const lines = normalizeLines(input.lines, context, errors)

  if (Object.keys(errors).length > 0) {
    return { valid: false, value: null, errors }
  }

  return {
    valid: true,
    errors,
    value: {
      notes: input.notes.trim() || null,
      yieldQuantity: header.yieldQuantity as number,
      sellingPrice: header.sellingPrice as number,
      lines,
    },
  }
}

export function describeRecipeDbError(error: DbErrorLike): string {
  if (error.code === '23505') {
    return 'That recipe conflicts with an existing record. Refresh and try again.'
  }
  if (error.code === '23514' && /only a draft version can be published/i.test(error.message)) {
    return error.message
  }
  return mapDbError(error, 'recipes')
}
