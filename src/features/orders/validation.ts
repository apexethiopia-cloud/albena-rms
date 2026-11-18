import { mapDbError, type DbErrorLike } from '@/lib/errors'
import type { Validation } from '@/features/stock/validation'

export type OrderLineDraft = {
  key: string
  menuItemId: string
  quantity: string
  specialInstructions: string
}

export type OrderDraft = {
  outletId: string
  tableId: string
  notes: string
  lines: OrderLineDraft[]
}

export type NormalizedOrderLine = {
  menuItemId: string
  quantity: number
  specialInstructions: string | null
}

export type NormalizedOrder = {
  outletId: string
  tableId: string | null
  notes: string | null
  lines: NormalizedOrderLine[]
}

export type OrderTableContext = {
  id: string
  outlet_id: string
  is_active: boolean
  status: string
}

export type OrderMenuItemContext = {
  id: string
  is_active: boolean
}

export function validateOrder(
  input: OrderDraft,
  outletIds: string[],
  tables: OrderTableContext[],
  menuItems: OrderMenuItemContext[],
): Validation<NormalizedOrder> {
  const errors: Record<string, string> = {}

  if (!input.outletId) errors.outletId = 'Choose the outlet.'
  else if (!outletIds.includes(input.outletId)) errors.outletId = 'Choose an active outlet.'

  if (input.notes.trim().length > 500) errors.notes = 'Use 500 characters or fewer.'

  if (input.tableId) {
    const table = tables.find((candidate) => candidate.id === input.tableId)
    if (!table) errors.tableId = 'Choose a valid table.'
    else if (!table.is_active) errors.tableId = 'That table is not active.'
    else if (table.outlet_id !== input.outletId) {
      errors.tableId = 'That table belongs to another outlet.'
    } else if (table.status === 'cleaning' || table.status === 'closed') {
      errors.tableId = 'That table is cleaning or closed. Choose another table.'
    }
  }

  const normalizedLines: NormalizedOrderLine[] = []

  if (input.lines.length === 0) errors.lines = 'Add at least one menu item.'

  input.lines.forEach((line, index) => {
    const prefix = `line-${index}`
    let lineValid = true

    if (!line.menuItemId) {
      errors[`${prefix}-item`] = 'Choose a menu item.'
      lineValid = false
    } else if (
      !menuItems.some((item) => item.id === line.menuItemId && item.is_active)
    ) {
      errors[`${prefix}-item`] = 'Choose an active menu item.'
      lineValid = false
    }

    const quantity = Number(line.quantity)
    if (!line.quantity.trim()) {
      errors[`${prefix}-quantity`] = 'Enter a quantity.'
      lineValid = false
    } else if (!Number.isInteger(quantity) || quantity <= 0) {
      errors[`${prefix}-quantity`] = 'Quantity must be a whole number greater than zero.'
      lineValid = false
    } else if (quantity > 999) {
      errors[`${prefix}-quantity`] = 'Use 999 or fewer per line.'
      lineValid = false
    }

    if (line.specialInstructions.trim().length > 500) {
      errors[`${prefix}-instructions`] = 'Use 500 characters or fewer.'
      lineValid = false
    }

    if (lineValid && line.menuItemId) {
      normalizedLines.push({
        menuItemId: line.menuItemId,
        quantity,
        specialInstructions: line.specialInstructions.trim() || null,
      })
    }
  })

  if (Object.keys(errors).length > 0) {
    return { valid: false, value: null, errors }
  }

  return {
    valid: true,
    errors,
    value: {
      outletId: input.outletId,
      tableId: input.tableId || null,
      notes: input.notes.trim() || null,
      lines: normalizedLines,
    },
  }
}

export function describeOrderDbError(error: DbErrorLike): string {
  if (error.code === '40001') {
    return error.message || 'This order was changed by someone else. Refresh and try again.'
  }
  if (error.code === '23505' && /open order|one_open_per_table/i.test(error.message)) {
    return 'That table already has an open order. Transfer the existing order or choose another table.'
  }
  if (
    error.code === '23514' &&
    /order|line|menu item|quantity|table|split|merge|served|cancel/i.test(error.message)
  ) {
    return error.message
  }
  return mapDbError(error, 'orders')
}
