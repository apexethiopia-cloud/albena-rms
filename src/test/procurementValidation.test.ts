import { describe, expect, it } from 'vitest'
import {
  describeProcurementDbError,
  validatePurchaseOrder,
  validatePurchaseRequest,
  type PurchaseOrderDraft,
  type PurchaseRequestDraft,
} from '@/features/procurement/validation'
import type { StockContext } from '@/features/stock/validation'

const CONTEXT: StockContext = {
  items: [
    {
      id: 'i-tomato',
      code: 'TOMATO',
      name: 'Tomato, fresh',
      base_unit_id: 'u-g',
      is_active: true,
    },
    {
      id: 'i-egg',
      code: 'EGG',
      name: 'Egg',
      base_unit_id: 'u-piece',
      is_active: true,
    },
  ],
  units: [
    { id: 'u-g', code: 'g', name: 'Gram', dimension: 'mass', is_base: true, base_factor: 1 },
    { id: 'u-kg', code: 'kg', name: 'Kilogram', dimension: 'mass', is_base: false, base_factor: 1000 },
    { id: 'u-piece', code: 'piece', name: 'Piece', dimension: 'count', is_base: true, base_factor: 1 },
    { id: 'u-box', code: 'box', name: 'Box', dimension: 'count', is_base: false, base_factor: null },
    { id: 'u-carton', code: 'carton', name: 'Carton', dimension: 'count', is_base: false, base_factor: null },
  ],
  conversions: [{ item_id: 'i-egg', unit_id: 'u-box', base_factor: 30 }],
}

function request(overrides: Partial<PurchaseRequestDraft> = {}): PurchaseRequestDraft {
  return {
    prNumber: 'pr-0001',
    requestDate: '2026-11-18',
    notes: '',
    lines: [{ key: 'a', itemId: 'i-tomato', unitId: 'u-kg', quantity: '2', unitCost: '' }],
    ...overrides,
  }
}

function order(overrides: Partial<PurchaseOrderDraft> = {}): PurchaseOrderDraft {
  return {
    poNumber: 'po-0001',
    supplierId: 's1',
    prId: '',
    orderDate: '2026-11-18',
    expectedDate: '',
    notes: '',
    lines: [
      { key: 'a', itemId: 'i-tomato', unitId: 'u-kg', quantity: '2', unitCost: '120' },
    ],
    ...overrides,
  }
}

describe('purchase request validation', () => {
  it('normalizes a valid request and drops the unused cost field', () => {
    const result = validatePurchaseRequest(request(), CONTEXT)

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.value.prNumber).toBe('PR-0001')
    expect(result.value.notes).toBeNull()
    expect(result.value.lines).toEqual([{ itemId: 'i-tomato', unitId: 'u-kg', quantity: 2 }])
  })

  it('requires a number, a date and at least one usable line', () => {
    const result = validatePurchaseRequest(
      request({
        prNumber: '',
        requestDate: '',
        lines: [{ key: 'a', itemId: '', unitId: '', quantity: '', unitCost: '' }],
      }),
      CONTEXT,
    )

    expect(result.valid).toBe(false)
    expect(result.errors.prNumber).toMatch(/request number/i)
    expect(result.errors.requestDate).toMatch(/request date/i)
    expect(result.errors['line-0-item']).toMatch(/choose an item/i)
    expect(result.errors['line-0-quantity']).toMatch(/quantity greater than zero/i)
  })

  it('rejects a unit with no conversion to the item base unit', () => {
    const result = validatePurchaseRequest(
      request({
        lines: [{ key: 'a', itemId: 'i-egg', unitId: 'u-carton', quantity: '1', unitCost: '' }],
      }),
      CONTEXT,
    )

    expect(result.valid).toBe(false)
    expect(result.errors['line-0-unit']).toMatch(/no conversion/i)
  })

  it('accepts a per-item conversion such as eggs by box', () => {
    const result = validatePurchaseRequest(
      request({
        lines: [{ key: 'a', itemId: 'i-egg', unitId: 'u-box', quantity: '2', unitCost: '' }],
      }),
      CONTEXT,
    )

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.value.lines[0].quantity).toBe(2)
  })

  it('rejects an unsupported request number length', () => {
    const result = validatePurchaseRequest(request({ prNumber: 'x'.repeat(41) }), CONTEXT)
    expect(result.valid).toBe(false)
    expect(result.errors.prNumber).toMatch(/40 characters/i)
  })
})

describe('purchase order validation', () => {
  it('normalizes a valid order with costs and an optional source request', () => {
    const result = validatePurchaseOrder(order({ prId: 'pr-1' }), CONTEXT)

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.value.poNumber).toBe('PO-0001')
    expect(result.value.prId).toBe('pr-1')
    expect(result.value.expectedDate).toBeNull()
    expect(result.value.lines).toEqual([
      { itemId: 'i-tomato', unitId: 'u-kg', quantity: 2, unitCost: 120 },
    ])
  })

  it('requires a supplier and a positive unit cost', () => {
    const result = validatePurchaseOrder(
      order({
        supplierId: '',
        lines: [
          { key: 'a', itemId: 'i-tomato', unitId: 'u-kg', quantity: '2', unitCost: '0' },
        ],
      }),
      CONTEXT,
    )

    expect(result.valid).toBe(false)
    expect(result.errors.supplierId).toMatch(/choose a supplier/i)
    expect(result.errors['line-0-cost']).toMatch(/unit cost greater than zero/i)
  })

  it('rejects an expected date before the order date', () => {
    const result = validatePurchaseOrder(
      order({ expectedDate: '2026-11-17' }),
      CONTEXT,
    )

    expect(result.valid).toBe(false)
    expect(result.errors.expectedDate).toMatch(/cannot be before/i)
  })

  it('rejects a unit with no conversion to the item base unit', () => {
    const result = validatePurchaseOrder(
      order({
        lines: [
          { key: 'a', itemId: 'i-egg', unitId: 'u-carton', quantity: '1', unitCost: '10' },
        ],
      }),
      CONTEXT,
    )

    expect(result.valid).toBe(false)
    expect(result.errors['line-0-unit']).toMatch(/no conversion/i)
  })
})

describe('procurement database errors', () => {
  it('keeps the duplicate-request message from the database', () => {
    expect(
      describeProcurementDbError({
        code: '23505',
        message: 'That purchase request already has a purchase order',
      }),
    ).toMatch(/already has a purchase order/i)
  })

  it('explains a duplicate document number', () => {
    expect(
      describeProcurementDbError({ code: '23505', message: 'duplicate key value' }),
    ).toMatch(/already in use/i)
  })

  it('passes actionable rule and permission messages through', () => {
    expect(
      describeProcurementDbError({
        code: '23514',
        message: 'Only a submitted purchase request can be approved or rejected',
      }),
    ).toMatch(/only a submitted/i)
    expect(
      describeProcurementDbError({
        code: '42501',
        message: 'You do not have permission to approve purchase orders',
      }),
    ).toMatch(/permission/i)
  })

  it('points at the pending migration when the table is missing', () => {
    expect(
      describeProcurementDbError({ code: 'PGRST205', message: 'Could not find the table' }),
    ).toMatch(/apply the pending supabase migration/i)
  })
})
