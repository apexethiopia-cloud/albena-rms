import { describe, expect, it } from 'vitest'
import {
  describeRecipeDbError,
  validateRecipe,
  validateRecipeHeader,
  validateRecipeVersion,
  type RecipeDraft,
  type RecipeVersionDraft,
} from '@/features/recipes/validation'
import {
  describeProductionDbError,
  validateProduction,
  type ProductionDraft,
} from '@/features/production/validation'
import type { StockContext } from '@/features/stock/validation'

const UNITS = [
  { id: 'g', code: 'g', name: 'Gram', dimension: 'mass' as const, is_base: true, base_factor: 1 },
  {
    id: 'kg',
    code: 'kg',
    name: 'Kilogram',
    dimension: 'mass' as const,
    is_base: false,
    base_factor: 1000,
  },
  {
    id: 'piece',
    code: 'piece',
    name: 'Piece',
    dimension: 'count' as const,
    is_base: true,
    base_factor: 1,
  },
  {
    id: 'box',
    code: 'box',
    name: 'Box',
    dimension: 'count' as const,
    is_base: false,
    base_factor: null,
  },
  {
    id: 'sack',
    code: 'sack',
    name: 'Sack',
    dimension: 'mass' as const,
    is_base: false,
    base_factor: null,
  },
]

const ITEMS = [
  { id: 'tomato', code: 'TOMATO', name: 'Tomato, fresh', base_unit_id: 'g', is_active: true },
  { id: 'egg', code: 'EGG', name: 'Egg', base_unit_id: 'piece', is_active: true },
  { id: 'old', code: 'OLD', name: 'Retired item', base_unit_id: 'g', is_active: false },
]

const CONTEXT: StockContext = {
  items: ITEMS,
  units: UNITS,
  conversions: [{ item_id: 'egg', unit_id: 'box', base_factor: 12 }],
}

function recipe(overrides: Partial<RecipeDraft> = {}): RecipeDraft {
  return {
    name: '  Omelette  ',
    menuItemName: '  Cheese omelette ',
    notes: '',
    yieldQuantity: '1',
    sellingPrice: '180.00',
    lines: [{ key: 'a', itemId: 'egg', unitId: 'box', quantity: '2' }],
    ...overrides,
  }
}

function version(overrides: Partial<RecipeVersionDraft> = {}): RecipeVersionDraft {
  return {
    notes: '  Larger portion ',
    yieldQuantity: '2',
    sellingPrice: '220',
    lines: [{ key: 'a', itemId: 'tomato', unitId: 'kg', quantity: '1' }],
    ...overrides,
  }
}

function production(overrides: Partial<ProductionDraft> = {}): ProductionDraft {
  return {
    productionDate: '2026-11-18',
    locationId: 'l-main',
    outputItemId: 'egg',
    outputUnitId: 'piece',
    outputQuantity: '12',
    expectedOutputQuantity: '12',
    responsibleName: '  Chef Selam ',
    notes: '',
    inputs: [{ key: 'a', itemId: 'tomato', unitId: 'kg', quantity: '1' }],
    ...overrides,
  }
}

describe('Recipe validation', () => {
  it('normalizes a valid recipe', () => {
    const result = validateRecipe(recipe(), CONTEXT)

    expect(result.valid).toBe(true)
    expect(result.value).toEqual({
      name: 'Omelette',
      menuItemName: 'Cheese omelette',
      notes: null,
      yieldQuantity: 1,
      sellingPrice: 180,
      lines: [{ itemId: 'egg', unitId: 'box', quantity: 2 }],
    })
  })

  it('requires a name, a positive yield and a non-negative price', () => {
    const result = validateRecipe(
      recipe({ name: '', yieldQuantity: '0', sellingPrice: '-1' }),
      CONTEXT,
    )

    expect(result.valid).toBe(false)
    expect(result.errors.name).toMatch(/recipe name/i)
    expect(result.errors.yieldQuantity).toMatch(/portions/i)
    expect(result.errors.sellingPrice).toMatch(/zero or more/i)
  })

  it('rejects a zero selling price only when it is not a number', () => {
    const free = validateRecipe(recipe({ sellingPrice: '0' }), CONTEXT)
    expect(free.valid).toBe(true)
    expect(free.value?.sellingPrice).toBe(0)

    const blank = validateRecipe(recipe({ sellingPrice: '' }), CONTEXT)
    expect(blank.valid).toBe(false)
    expect(blank.errors.sellingPrice).toBeDefined()
  })

  it('requires at least one valid ingredient line', () => {
    const result = validateRecipe(recipe({ lines: [] }), CONTEXT)

    expect(result.valid).toBe(false)
    expect(result.errors.lines).toMatch(/at least one ingredient/i)
  })

  it('rejects a missing, inactive or unconvertible ingredient unit', () => {
    const missingItem = validateRecipe(
      recipe({ lines: [{ key: 'a', itemId: '', unitId: '', quantity: '' }] }),
      CONTEXT,
    )
    expect(missingItem.errors['line-0-item']).toMatch(/choose an ingredient/i)
    expect(missingItem.errors['line-0-quantity']).toMatch(/greater than zero/i)
    expect(missingItem.errors['line-0-unit']).toMatch(/choose a unit/i)

    const inactive = validateRecipe(
      recipe({ lines: [{ key: 'a', itemId: 'old', unitId: 'g', quantity: '1' }] }),
      CONTEXT,
    )
    expect(inactive.errors['line-0-item']).toMatch(/active ingredient/i)

    const wrongDimension = validateRecipe(
      recipe({ lines: [{ key: 'a', itemId: 'tomato', unitId: 'piece', quantity: '1' }] }),
      CONTEXT,
    )
    expect(wrongDimension.errors['line-0-unit']).toMatch(/choose a mass unit/i)

    const noFactor = validateRecipe(
      recipe({ lines: [{ key: 'a', itemId: 'tomato', unitId: 'sack', quantity: '1' }] }),
      CONTEXT,
    )
    expect(noFactor.errors['line-0-unit']).toMatch(/conversion/i)
  })

  it('checks field lengths', () => {
    const result = validateRecipe(
      recipe({
        name: 'N'.repeat(121),
        menuItemName: 'M'.repeat(121),
        notes: 'O'.repeat(501),
      }),
      CONTEXT,
    )

    expect(result.errors.name).toMatch(/120 characters/i)
    expect(result.errors.menuItemName).toMatch(/120 characters/i)
    expect(result.errors.notes).toMatch(/500 characters/i)
  })

  it('validates the recipe header fields edited without creating a version', () => {
    const result = validateRecipeHeader({
      name: '  Updated omelette  ',
      menuItemName: '  Cheese omelette ',
      notes: '  Extra cheese  ',
    })

    expect(result.valid).toBe(true)
    expect(result.value).toEqual({
      name: 'Updated omelette',
      menuItemName: 'Cheese omelette',
      notes: 'Extra cheese',
    })

    const invalid = validateRecipeHeader({
      name: '',
      menuItemName: 'M'.repeat(121),
      notes: 'O'.repeat(501),
    })
    expect(invalid.errors.name).toMatch(/recipe name/i)
    expect(invalid.errors.menuItemName).toMatch(/120 characters/i)
    expect(invalid.errors.notes).toMatch(/500 characters/i)
  })

  it('validates a new version independently of the recipe header', () => {
    const result = validateRecipeVersion(version(), CONTEXT)

    expect(result.valid).toBe(true)
    expect(result.value).toEqual({
      notes: 'Larger portion',
      yieldQuantity: 2,
      sellingPrice: 220,
      lines: [{ itemId: 'tomato', unitId: 'kg', quantity: 1 }],
    })
  })

  it('rejects an empty version line set', () => {
    const result = validateRecipeVersion(version({ lines: [], yieldQuantity: '' }), CONTEXT)

    expect(result.valid).toBe(false)
    expect(result.errors.lines).toMatch(/at least one ingredient/i)
    expect(result.errors.yieldQuantity).toMatch(/portions/i)
  })
})

describe('Production validation', () => {
  it('normalizes a valid production order', () => {
    const result = validateProduction(production(), CONTEXT)

    expect(result.valid).toBe(true)
    expect(result.value).toEqual({
      productionDate: '2026-11-18',
      locationId: 'l-main',
      outputItemId: 'egg',
      outputUnitId: 'piece',
      outputQuantity: 12,
      expectedOutputQuantity: 12,
      responsibleName: 'Chef Selam',
      notes: null,
      inputs: [{ itemId: 'tomato', unitId: 'kg', quantity: 1 }],
    })
  })

  it('requires a valid date, a location and a responsible user', () => {
    const result = validateProduction(
      production({
        productionDate: '2026-02-30',
        locationId: '',
        responsibleName: '',
      }),
      CONTEXT,
    )

    expect(result.valid).toBe(false)
    expect(result.errors.productionDate).toMatch(/valid date/i)
    expect(result.errors.locationId).toMatch(/stock location/i)
    expect(result.errors.responsibleName).toMatch(/responsible user/i)
  })

  it('requires an active output item and a unit that converts to its base unit', () => {
    const missing = validateProduction(production({ outputItemId: '', outputUnitId: '' }), CONTEXT)
    expect(missing.errors.outputItemId).toMatch(/output item/i)
    expect(missing.errors.outputUnitId).toMatch(/output unit/i)

    const inactive = validateProduction(
      production({ outputItemId: 'old', outputUnitId: 'g' }),
      CONTEXT,
    )
    expect(inactive.errors.outputItemId).toMatch(/active output item/i)

    const wrongDimension = validateProduction(
      production({ outputItemId: 'egg', outputUnitId: 'kg' }),
      CONTEXT,
    )
    expect(wrongDimension.errors.outputUnitId).toMatch(/choose a count unit/i)
  })

  it('rejects a zero output, an unusable expected output and duplicate inputs', () => {
    const result = validateProduction(
      production({
        outputQuantity: '0',
        expectedOutputQuantity: 'zero',
        inputs: [
          { key: 'a', itemId: 'tomato', unitId: 'kg', quantity: '1' },
          { key: 'b', itemId: 'tomato', unitId: 'kg', quantity: '2' },
        ],
      }),
      CONTEXT,
    )

    expect(result.valid).toBe(false)
    expect(result.errors.outputQuantity).toMatch(/greater than zero/i)
    expect(result.errors.expectedOutputQuantity).toMatch(/expected output/i)
    expect(result.errors['input-1-item']).toMatch(/only once/i)
  })

  it('allows a blank expected output but rejects an empty input list', () => {
    const blankExpected = validateProduction(
      production({ expectedOutputQuantity: '   ' }),
      CONTEXT,
    )
    expect(blankExpected.valid).toBe(true)
    expect(blankExpected.value?.expectedOutputQuantity).toBeNull()

    const noInputs = validateProduction(production({ inputs: [] }), CONTEXT)
    expect(noInputs.valid).toBe(false)
    expect(noInputs.errors.inputs).toMatch(/at least one input/i)
  })

  it('validates each input line', () => {
    const result = validateProduction(
      production({ inputs: [{ key: 'a', itemId: '', unitId: '', quantity: '' }] }),
      CONTEXT,
    )

    expect(result.errors['input-0-item']).toMatch(/input item/i)
    expect(result.errors['input-0-quantity']).toMatch(/greater than zero/i)
    expect(result.errors['input-0-unit']).toMatch(/choose a unit/i)
  })
})

describe('Recipes and production database errors', () => {
  it('explains duplicate recipe codes and publish conflicts', () => {
    expect(describeRecipeDbError({ code: '23505', message: 'duplicate key' })).toMatch(
      /conflicts with an existing record/i,
    )
    expect(
      describeRecipeDbError({ code: '23514', message: 'Only a draft version can be published' }),
    ).toMatch(/only a draft version can be published/i)
    expect(describeRecipeDbError({ code: '42501', message: 'denied' })).toMatch(
      /do not have permission/i,
    )
  })

  it('explains conflict, posted and shortage production errors', () => {
    expect(
      describeProductionDbError({ code: '23505', message: 'duplicate key value' }),
    ).toMatch(/conflicts with an existing record/i)
    expect(
      describeProductionDbError({
        code: '23505',
        message: 'Production order PROD-1 is already posted',
      }),
    ).toMatch(/already posted/i)
    expect(
      describeProductionDbError({ code: '23514', message: 'Insufficient stock for item TOMATO' }),
    ).toMatch(/insufficient stock/i)
    expect(
      describeProductionDbError({
        code: '23514',
        message: 'A production order needs at least one input',
      }),
    ).toMatch(/at least one input/i)
    expect(
      describeProductionDbError({
        code: '23514',
        message: 'Only a draft production order can be edited',
      }),
    ).toMatch(/only a draft production order/i)
    expect(describeProductionDbError({ code: 'P0002', message: 'missing' })).toMatch(
      /no longer exists/i,
    )
  })
})
