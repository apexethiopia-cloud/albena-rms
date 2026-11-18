import { describe, expect, it } from 'vitest'
import {
  describeStockDbError,
  isIsoDate,
  previewLine,
  resolveUnitFactor,
  validateGrn,
  validateSiv,
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
    grnNumber: ' grn-0001 ',
    supplierId: 'supplier-1',
    invoiceNumber: 'INV-77',
    receivedDate: '2026-11-18',
    locationId: 'location-1',
    notes: 'Delivery',
    lines: [
      { key: 'a', itemId: 'egg', quantity: '2', unitId: 'box', unitCost: '120.00' },
    ],
    ...overrides,
  }
}

function siv(overrides: Partial<SivDraft> = {}): SivDraft {
  return {
    sivNumber: 'siv-0001',
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
    expect(result.value.grnNumber).toBe('GRN-0001')
    expect(result.value.notes).toBe('Delivery')
    expect(result.value.lines).toEqual([
      { itemId: 'egg', unitId: 'box', quantity: 2, unitCost: 120 },
    ])
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
        grnNumber: '',
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
    expect(result.errors.grnNumber).toBeTruthy()
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
    expect(result.value.sivNumber).toBe('SIV-0001')
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
