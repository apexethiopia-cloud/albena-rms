import { mapDbError, type DbErrorLike } from '@/lib/errors'
import {
  isIsoDate,
  parseMoney,
  parsePositiveNumber,
  resolveUnitFactor,
  type StockContext,
  type Validation,
} from '@/features/stock/validation'

export type PurchaseLineDraft = {
  key: string
  itemId: string
  unitId: string
  quantity: string
  unitCost: string
}

export type PurchaseRequestDraft = {
  requestDate: string
  notes: string
  lines: PurchaseLineDraft[]
}

export type PurchaseOrderDraft = {
  supplierId: string
  prId: string
  orderDate: string
  expectedDate: string
  notes: string
  lines: PurchaseLineDraft[]
}

export type NormalizedPurchaseLine = {
  itemId: string
  unitId: string
  quantity: number
  unitCost: number
}

export type NormalizedPurchaseRequest = {
  requestDate: string
  notes: string | null
  lines: Array<Omit<NormalizedPurchaseLine, 'unitCost'>>
}

export type NormalizedPurchaseOrder = {
  supplierId: string
  prId: string | null
  orderDate: string
  expectedDate: string | null
  notes: string | null
  lines: NormalizedPurchaseLine[]
}

export type PurchaseRequestStatus = 'draft' | 'submitted' | 'approved' | 'rejected'
export type PurchaseOrderStatus = 'draft' | 'approved' | 'ordered' | 'closed'

export const REQUEST_STATUS_LABELS: Record<PurchaseRequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  approved: 'Approved',
  ordered: 'Ordered',
  closed: 'Closed',
}

export function validatePurchaseRequest(
  input: PurchaseRequestDraft,
  context: StockContext,
): Validation<NormalizedPurchaseRequest> {
  const errors: Record<string, string> = {}

  if (!input.requestDate) errors.requestDate = 'Choose the request date.'
  else if (!isIsoDate(input.requestDate)) errors.requestDate = 'Use a valid date.'

  if (input.notes.trim().length > 500) errors.notes = 'Use 500 characters or fewer.'

  const lines = validateLines(input.lines, context, { requireCost: false })
  Object.assign(errors, lines.errors)

  if (Object.keys(errors).length > 0) {
    return { valid: false, value: null, errors }
  }

  return {
    valid: true,
    errors,
    value: {
      requestDate: input.requestDate,
      notes: input.notes.trim() || null,
      lines: lines.normalized.map((line) => ({
        itemId: line.itemId,
        unitId: line.unitId,
        quantity: line.quantity,
      })),
    },
  }
}

export function validatePurchaseOrder(
  input: PurchaseOrderDraft,
  context: StockContext,
): Validation<NormalizedPurchaseOrder> {
  const errors: Record<string, string> = {}

  if (!input.supplierId) errors.supplierId = 'Choose a supplier.'

  if (!input.orderDate) errors.orderDate = 'Choose the order date.'
  else if (!isIsoDate(input.orderDate)) errors.orderDate = 'Use a valid date.'

  if (input.expectedDate) {
    if (!isIsoDate(input.expectedDate)) errors.expectedDate = 'Use a valid date.'
    else if (input.orderDate && input.expectedDate < input.orderDate) {
      errors.expectedDate = 'The expected date cannot be before the order date.'
    }
  }

  if (input.notes.trim().length > 500) errors.notes = 'Use 500 characters or fewer.'

  const lines = validateLines(input.lines, context, { requireCost: true })
  Object.assign(errors, lines.errors)

  if (Object.keys(errors).length > 0) {
    return { valid: false, value: null, errors }
  }

  return {
    valid: true,
    errors,
    value: {
      supplierId: input.supplierId,
      prId: input.prId || null,
      orderDate: input.orderDate,
      expectedDate: input.expectedDate || null,
      notes: input.notes.trim() || null,
      lines: lines.normalized,
    },
  }
}

function validateLines(
  lines: readonly PurchaseLineDraft[],
  context: StockContext,
  options: { requireCost: boolean },
): { errors: Record<string, string>; normalized: NormalizedPurchaseLine[] } {
  const errors: Record<string, string> = {}
  const normalized: NormalizedPurchaseLine[] = []

  if (lines.length === 0) {
    errors.lines = 'Add at least one line.'
    return { errors, normalized }
  }

  lines.forEach((line, index) => {
    const prefix = `line-${index}`

    if (!line.itemId) errors[`${prefix}-item`] = 'Choose an item.'
    if (!line.unitId) errors[`${prefix}-unit`] = 'Choose a unit.'

    const quantity = parsePositiveNumber(line.quantity)
    if (quantity === null) {
      errors[`${prefix}-quantity`] = 'Enter a quantity greater than zero.'
    }

    let unitCost = 0
    if (options.requireCost) {
      const cost = parseMoney(line.unitCost)
      if (cost === null) {
        errors[`${prefix}-cost`] = 'Enter a unit cost greater than zero.'
      } else {
        unitCost = cost
      }
    }

    if (line.itemId && line.unitId) {
      const resolved = resolveUnitFactor(line.itemId, line.unitId, context)
      if (resolved.error) errors[`${prefix}-unit`] = resolved.error
    }

    if (
      line.itemId &&
      line.unitId &&
      quantity !== null &&
      (!options.requireCost || parseMoney(line.unitCost) !== null)
    ) {
      normalized.push({
        itemId: line.itemId,
        unitId: line.unitId,
        quantity,
        unitCost,
      })
    }
  })

  return { errors, normalized }
}

export function describeProcurementDbError(error: DbErrorLike): string {
  if (error.code === '23505') {
    if (/already has a purchase order/i.test(error.message)) return error.message
    return 'That document number is already in use. Choose a different number.'
  }

  if (error.code === '23514' || error.code === '42501') {
    return error.message
  }

  return mapDbError(error, 'procurement documents')
}
