import { describe, expect, it } from 'vitest'
import {
  describeStockDbError,
  isIsoDate,
  previewLine,
  resolveUnitFactor,
  validateGrn,
  validateInventoryAdjustment,
  validateInventoryCount,
  validateSiv,
  type AdjustmentDraft,
  type CountDraft,
  type GrnDraft,
  type SivDraft,
  type StockContext,
} from '@/features/stock/validation'

const UNITS = [
  { id: 'g', code: 'g', name: 'Gram', dimension: 'mass' as const, is_base: true, base_factor: 1 },
  { id: 'kg', code: 'kg', name: 'Kilogram', dimension: 'mass' as const, is_base: false, base_factor: 1000 },
  { id: 'piece', code: 'piece', name: 'Piece', dimension: 'count' as const, is_base: true, base_factor: 1 },
  { id: 'box', code: 'box', name: 'Box', dimension: 'count' as const, is_base: false, base_factor: null },
  { id: 'carton', code: 'carton', name: 'Carton', dimension: 'count' as const, is_base: false, base_factor: null },
  { id: 'litre', code: 'L', name: 'Litre', dimension: 'volume' as const, is_base: false, base_factor: 1000 },
]

const ITEMS = [
  {
    id: 'tomato',
    code: 'TOMATO',
    name: 'Tomato, fresh',
    base_unit_id: 'g',
    is_active: true,
  },
  {
    id: 'egg',
    code: 'EGG',
    name: 'Egg',
    base_unit_id: 'piece',
    is_active: true,
  },
]

const CONTEXT: StockContext = {
  items: ITEMS,
  units: UNITS,
  conversions: [{ item_id: 'egg', unit_id: 'box', base_factor: 12 }],
}

function grn(overrides: Partial<GrnDraft> = {}): GrnDraft {
  return {
    supplierId: 'supplier-1',
    invoiceNumber: 'INV-77',
    receivedDate: '2026-11-18',
    locationId: 'location-1',
    notes: 'Delivery',
    poId: '',
    lines: [
      { key: 'a', itemId: 'egg', quantity: '2', unitId: 'box', unitCost: '120.00' },
    ],
    ...overrides,
  }
}

function siv(overrides: Partial<SivDraft> = {}): SivDraft {
  return {
    issueDate: '2026-11-18',
    sourceLocationId: 'main-store',
    destinationLocationId: 'kitchen-store',
    notes: '',
    lines: [
      { key: 'a', itemId: 'tomato', quantity: '2', unitId: 'kg', unitCost: '' },
    ],
    ...overrides,
  }
}

describe('Stock unit conversion', () => {
  it('returns 1 for the item base unit', () => {
    expect(resolveUnitFactor('tomato', 'g', CONTEXT)).toEqual({ factor: 1, error: null })
  })

  it('uses the global factor for fixed units', () => {
    expect(resolveUnitFactor('tomato', 'kg', CONTEXT)).toEqual({ factor: 1000, error: null })
  })

  it('uses the per-item factor for boxes and cartons', () => {
    expect(resolveUnitFactor('egg', 'box', CONTEXT)).toEqual({ factor: 12, error: null })
  })

  it('refuses a unit with no configured factor', () => {
    expect(resolveUnitFactor('egg', 'carton', CONTEXT).factor).toBeNull()
    expect(resolveUnitFactor('egg', 'carton', CONTEXT).error).toMatch(/No conversion/i)
  })

  it('refuses a unit from the wrong dimension', () => {
    expect(resolveUnitFactor('tomato', 'litre', CONTEXT).error).toMatch(/mass unit/i)
  })

  it('previews the base quantity and line total', () => {
    expect(
      previewLine(
        { key: 'a', itemId: 'egg', quantity: '2', unitId: 'box', unitCost: '120.00' },
        CONTEXT,
      ),
    ).toEqual({ factor: 12, baseQuantity: 24, lineTotal: 240, error: null })
  })
})

describe('GRN validation', () => {
  it('normalizes a valid GRN and its lines', () => {
    const result = validateGrn(grn(), CONTEXT)

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.value).not.toHaveProperty('grnNumber')
    expect(result.value.notes).toBe('Delivery')
    expect(result.value.poId).toBeNull()
    expect(result.value.lines).toEqual([
      { itemId: 'egg', unitId: 'box', quantity: 2, unitCost: 120, poLineId: null },
    ])
  })

  it('keeps the purchase order and line links on a linked receipt', () => {
    const result = validateGrn(
      grn({
        poId: 'po-1',
        lines: [
          {
            key: 'a',
            itemId: 'egg',
            quantity: '2',
            unitId: 'box',
            unitCost: '120.00',
            poLineId: 'pol-1',
          },
        ],
      }),
      CONTEXT,
    )

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.value.poId).toBe('po-1')
    expect(result.value.lines[0]?.poLineId).toBe('pol-1')
  })

  it('rejects a unit without a conversion', () => {
    const result = validateGrn(
      grn({
        lines: [
          { key: 'a', itemId: 'egg', quantity: '2', unitId: 'carton', unitCost: '10' },
        ],
      }),
      CONTEXT,
    )

    expect(result.valid).toBe(false)
    expect(result.errors['line-0-unit']).toMatch(/No conversion/i)
  })

  it('rejects missing header fields and zero quantities', () => {
    const result = validateGrn(
      grn({
        supplierId: '',
        invoiceNumber: '',
        receivedDate: '',
        locationId: '',
        lines: [
          { key: 'a', itemId: '', quantity: '0', unitId: '', unitCost: '0' },
        ],
      }),
      CONTEXT,
    )

    expect(result.valid).toBe(false)
    expect(result.errors.supplierId).toBeTruthy()
    expect(result.errors.invoiceNumber).toBeTruthy()
    expect(result.errors.receivedDate).toBeTruthy()
    expect(result.errors.locationId).toBeTruthy()
    expect(result.errors['line-0-quantity']).toBeTruthy()
    expect(result.errors['line-0-cost']).toBeTruthy()
  })

  it('requires at least one line', () => {
    const result = validateGrn(grn({ lines: [] }), CONTEXT)
    expect(result.valid).toBe(false)
    expect(result.errors.lines).toMatch(/at least one line/i)
  })

  it('accepts only real ISO dates', () => {
    expect(isIsoDate('2026-11-18')).toBe(true)
    expect(isIsoDate('2026-02-31')).toBe(false)
    expect(isIsoDate('18/11/2026')).toBe(false)
  })
})

describe('SIV validation', () => {
  it('normalizes a valid transfer', () => {
    const result = validateSiv(siv(), CONTEXT)

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.value).not.toHaveProperty('sivNumber')
    expect(result.value.notes).toBeNull()
    expect(result.value.lines).toEqual([
      { itemId: 'tomato', unitId: 'kg', quantity: 2 },
    ])
  })

  it('rejects the same source and destination', () => {
    const result = validateSiv(siv({ destinationLocationId: 'main-store' }), CONTEXT)

    expect(result.valid).toBe(false)
    expect(result.errors.destinationLocationId).toMatch(/different/i)
  })

  it('does not require a unit cost on an issue', () => {
    const result = validateSiv(siv(), CONTEXT)
    expect(result.valid).toBe(true)
  })
})

function adjustment(overrides: Partial<AdjustmentDraft> = {}): AdjustmentDraft {
  return {
    kind: 'adjustment',
    adjustmentDate: '2026-11-18',
    locationId: 'location-1',
    reason: 'damage',
    notes: 'Dropped crate',
    lines: [
      { key: 'a', itemId: 'tomato', direction: 'out', quantity: '1.5', unitId: 'kg', unitCost: '' },
    ],
    ...overrides,
  }
}

function count(overrides: Partial<CountDraft> = {}): CountDraft {
  return {
    countDate: '2026-11-18',
    locationId: 'location-1',
    counterName: '  Selam ',
    notes: '',
    lines: [{ key: 'a', itemId: 'tomato', physicalQuantity: '0' }],
    ...overrides,
  }
}

describe('Adjustment and waste validation', () => {
  it('normalizes a valid decrease and ignores the cost', () => {
    const result = validateInventoryAdjustment(adjustment(), CONTEXT)

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.value.kind).toBe('adjustment')
    expect(result.value).not.toHaveProperty('adjustmentNumber')
    expect(result.value.notes).toBe('Dropped crate')
    expect(result.value.lines).toEqual([
      { itemId: 'tomato', unitId: 'kg', direction: 'out', quantity: 1.5, unitCost: null },
    ])
  })

  it('requires a unit cost on an increase and keeps it after normalization', () => {
    const missing = validateInventoryAdjustment(
      adjustment({
        lines: [
          { key: 'a', itemId: 'tomato', direction: 'in', quantity: '1', unitId: 'kg', unitCost: '' },
        ],
      }),
      CONTEXT,
    )
    expect(missing.valid).toBe(false)
    expect(missing.errors['line-0-cost']).toMatch(/unit cost/i)

    const priced = validateInventoryAdjustment(
      adjustment({
        lines: [
          {
            key: 'a',
            itemId: 'tomato',
            direction: 'in',
            quantity: '1',
            unitId: 'kg',
            unitCost: '80',
          },
        ],
      }),
      CONTEXT,
    )
    expect(priced.valid).toBe(true)
    if (!priced.valid) return
    expect(priced.value.lines[0]).toEqual({
      itemId: 'tomato',
      unitId: 'kg',
      direction: 'in',
      quantity: 1,
      unitCost: 80,
    })
  })

  it('only allows waste to decrease stock and only accepts waste reasons', () => {
    const direction = validateInventoryAdjustment(
      adjustment({
        kind: 'waste',
        reason: 'kitchen_waste',
        lines: [
          { key: 'a', itemId: 'tomato', direction: 'in', quantity: '1', unitId: 'kg', unitCost: '5' },
        ],
      }),
      CONTEXT,
    )
    expect(direction.valid).toBe(false)
    expect(direction.errors['line-0-direction']).toMatch(/decrease/i)

    const reason = validateInventoryAdjustment(
      adjustment({ kind: 'waste', reason: 'operational_loss' }),
      CONTEXT,
    )
    expect(reason.valid).toBe(false)
    expect(reason.errors.reason).toMatch(/waste reason/i)
  })

  it('rejects a unit with no conversion and the missing header fields', () => {
    const result = validateInventoryAdjustment(
      adjustment({
        adjustmentDate: '',
        locationId: '',
        reason: 'not-a-reason',
        lines: [
          { key: 'a', itemId: 'egg', direction: 'out', quantity: '', unitId: 'carton', unitCost: '' },
        ],
      }),
      CONTEXT,
    )

    expect(result.valid).toBe(false)
    expect(result.errors.adjustmentDate).toBeTruthy()
    expect(result.errors.locationId).toBeTruthy()
    expect(result.errors.reason).toBeTruthy()
    expect(result.errors['line-0-quantity']).toBeTruthy()
    expect(result.errors['line-0-unit']).toMatch(/No conversion/i)
  })
})

describe('Count validation', () => {
  it('accepts a zero physical quantity and trims the counter', () => {
    const result = validateInventoryCount(count(), { items: ITEMS })

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.value).not.toHaveProperty('countNumber')
    expect(result.value.counterName).toBe('Selam')
    expect(result.value.notes).toBeNull()
    expect(result.value.lines).toEqual([{ itemId: 'tomato', physicalQuantity: 0 }])
  })

  it('rejects a negative or missing physical quantity', () => {
    const negative = validateInventoryCount(
      count({ lines: [{ key: 'a', itemId: 'tomato', physicalQuantity: '-1' }] }),
      { items: ITEMS },
    )
    expect(negative.valid).toBe(false)
    expect(negative.errors['line-0-physical']).toMatch(/zero or more/i)

    const missing = validateInventoryCount(
      count({ lines: [{ key: 'a', itemId: 'tomato', physicalQuantity: '' }] }),
      { items: ITEMS },
    )
    expect(missing.valid).toBe(false)
    expect(missing.errors['line-0-physical']).toBeTruthy()
  })

  it('rejects the same item twice', () => {
    const result = validateInventoryCount(
      count({
        lines: [
          { key: 'a', itemId: 'tomato', physicalQuantity: '1' },
          { key: 'b', itemId: 'tomato', physicalQuantity: '2' },
        ],
      }),
      { items: ITEMS },
    )

    expect(result.valid).toBe(false)
    expect(result.errors['line-1-item']).toMatch(/only once/i)
  })

  it('requires a count date, location, counter and a line', () => {
    const result = validateInventoryCount(
      count({
        countDate: '',
        locationId: '',
        counterName: '   ',
        lines: [],
      }),
      { items: ITEMS },
    )

    expect(result.valid).toBe(false)
    expect(result.errors.countDate).toBeTruthy()
    expect(result.errors.locationId).toBeTruthy()
    expect(result.errors.counterName).toBeTruthy()
    expect(result.errors.lines).toMatch(/at least one line/i)
  })
})

describe('Stock error mapping', () => {
  it('keeps the database negative-stock explanation', () => {
    const message =
      'Insufficient stock for item x at location y: requested 10 base units, available 4 base units'
    expect(describeStockDbError({ code: '23514', message })).toBe(message)
  })

  it('explains a duplicate posting', () => {
    expect(describeStockDbError({ code: '23505', message: 'GRN GRN-1 is already posted' })).toBe(
      'That document is already posted. Refresh and try again.',
    )
  })

  it('explains a duplicate document number', () => {
    expect(describeStockDbError({ code: '23505', message: 'duplicate key' })).toBe(
      'That document number is already in use. Choose a different number.',
    )
  })
})
