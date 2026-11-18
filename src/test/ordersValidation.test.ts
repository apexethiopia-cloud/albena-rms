import { describe, expect, it } from 'vitest'
import {
  describeOrderDbError,
  validateOrder,
  type OrderDraft,
  type OrderMenuItemContext,
  type OrderTableContext,
} from '@/features/orders/validation'

const OUTLETS = ['outlet-main', 'outlet-terrace']

const TABLES: OrderTableContext[] = [
  { id: 't-1', outlet_id: 'outlet-main', is_active: true, status: 'available' },
  { id: 't-cleaning', outlet_id: 'outlet-main', is_active: true, status: 'cleaning' },
  { id: 't-old', outlet_id: 'outlet-main', is_active: false, status: 'available' },
  { id: 't-other', outlet_id: 'outlet-terrace', is_active: true, status: 'available' },
]

const MENU_ITEMS: OrderMenuItemContext[] = [
  { id: 'm-1', is_active: true },
  { id: 'm-off', is_active: false },
]

function orderDraft(overrides: Partial<OrderDraft> = {}): OrderDraft {
  return {
    outletId: 'outlet-main',
    tableId: '',
    notes: '',
    lines: [
      {
        key: 'line-1',
        menuItemId: 'm-1',
        quantity: '2',
        specialInstructions: 'No onion',
      },
    ],
    ...overrides,
  }
}

describe('validateOrder', () => {
  it('normalizes a takeaway order with trimmed instructions', () => {
    const result = validateOrder(orderDraft(), OUTLETS, TABLES, MENU_ITEMS)

    expect(result.valid).toBe(true)
    expect(result.value).toEqual({
      outletId: 'outlet-main',
      tableId: null,
      notes: null,
      lines: [{ menuItemId: 'm-1', quantity: 2, specialInstructions: 'No onion' }],
    })
  })

  it('accepts an available table in the same outlet', () => {
    const result = validateOrder(
      orderDraft({ tableId: 't-1', notes: 'Birthday' }),
      OUTLETS,
      TABLES,
      MENU_ITEMS,
    )

    expect(result.valid).toBe(true)
    expect(result.value?.tableId).toBe('t-1')
    expect(result.value?.notes).toBe('Birthday')
  })

  it('rejects a cleaning, inactive or foreign table', () => {
    for (const tableId of ['t-cleaning', 't-old', 't-other']) {
      const result = validateOrder(
        { ...orderDraft(), tableId },
        OUTLETS,
        TABLES,
        MENU_ITEMS,
      )
      expect(result.valid).toBe(false)
      expect(result.errors.tableId).toBeTruthy()
    }
  })

  it('requires at least one line', () => {
    const result = validateOrder(orderDraft({ lines: [] }), OUTLETS, TABLES, MENU_ITEMS)

    expect(result.valid).toBe(false)
    expect(result.errors.lines).toMatch(/at least one menu item/i)
  })

  it('rejects an inactive menu item and a non-positive quantity', () => {
    const inactive = validateOrder(
      orderDraft({
        lines: [
          { key: 'line-1', menuItemId: 'm-off', quantity: '1', specialInstructions: '' },
        ],
      }),
      OUTLETS,
      TABLES,
      MENU_ITEMS,
    )
    expect(inactive.valid).toBe(false)
    expect(inactive.errors['line-0-item']).toMatch(/active menu item/i)

    for (const quantity of ['0', '-1', '1.5', '', '1000']) {
      const result = validateOrder(
        orderDraft({
          lines: [
            { key: 'line-1', menuItemId: 'm-1', quantity, specialInstructions: '' },
          ],
        }),
        OUTLETS,
        TABLES,
        MENU_ITEMS,
      )
      expect(result.valid).toBe(false)
      expect(result.errors['line-0-quantity']).toBeTruthy()
    }
  })

  it('rejects an overlong note or instruction', () => {
    const result = validateOrder(
      orderDraft({
        notes: 'N'.repeat(501),
        lines: [
          {
            key: 'line-1',
            menuItemId: 'm-1',
            quantity: '1',
            specialInstructions: 'I'.repeat(501),
          },
        ],
      }),
      OUTLETS,
      TABLES,
      MENU_ITEMS,
    )

    expect(result.valid).toBe(false)
    expect(result.errors.notes).toMatch(/500 characters/i)
    expect(result.errors['line-0-instructions']).toMatch(/500 characters/i)
  })
})

describe('describeOrderDbError', () => {
  it('explains a concurrent edit', () => {
    expect(
      describeOrderDbError({
        code: '40001',
        message: 'This order was changed by someone else. Refresh and try again.',
      }),
    ).toMatch(/changed by someone else/i)
  })

  it('explains a table that already has an open order', () => {
    expect(
      describeOrderDbError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "orders_one_open_per_table"',
      }),
    ).toMatch(/already has an open order/i)
  })

  it('passes through order rule violations', () => {
    expect(
      describeOrderDbError({
        code: '23514',
        message: 'Leave at least one line on the original order',
      }),
    ).toBe('Leave at least one line on the original order')
  })

  it('maps permission errors', () => {
    expect(
      describeOrderDbError({ code: '42501', message: 'denied' }),
    ).toMatch(/do not have permission/i)
  })
})
