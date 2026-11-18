import { mapDbError, type DbErrorLike } from '@/lib/errors'
import type { Item, Unit } from '@/features/items/api'

export type Conversion = { item_id: string; unit_id: string; base_factor: number }

export type StockContext = {
  items: readonly Pick<Item, 'id' | 'code' | 'name' | 'base_unit_id' | 'is_active'>[]
  units: readonly Unit[]
  conversions: readonly Conversion[]
}

export type StockLineDraft = {
  key: string
  itemId: string
  quantity: string
  unitId: string
  unitCost: string
  /** Receipt only: the purchase order line this line fulfils (GRN-04). */
  poLineId?: string
}

export type GrnDraft = {
  grnNumber: string
  supplierId: string
  invoiceNumber: string
  receivedDate: string
  locationId: string
  notes: string
  /** Receipt only: optional purchase order this delivery fulfils (GRN-04). */
  poId: string
  lines: StockLineDraft[]
}

export type SivDraft = {
  sivNumber: string
  issueDate: string
  sourceLocationId: string
  destinationLocationId: string
  notes: string
  lines: StockLineDraft[]
}

export type NormalizedGrnLine = {
  itemId: string
  unitId: string
  quantity: number
  unitCost: number
  poLineId: string | null
}

export type NormalizedSivLine = {
  itemId: string
  unitId: string
  quantity: number
}

export type NormalizedGrn = {
  grnNumber: string
  supplierId: string
  invoiceNumber: string
  receivedDate: string
  locationId: string
  notes: string | null
  poId: string | null
  lines: NormalizedGrnLine[]
}

export type NormalizedSiv = {
  sivNumber: string
  issueDate: string
  sourceLocationId: string
  destinationLocationId: string
  notes: string | null
  lines: NormalizedSivLine[]
}

export type AdjustmentKind = 'adjustment' | 'waste'
export type AdjustmentDirection = 'in' | 'out'

export type AdjustmentReason = {
  value: string
  label: string
}

/** ADJ-01 reasons. Count variances are posted by the count itself, not here. */
export const ADJUSTMENT_REASONS: readonly AdjustmentReason[] = [
  { value: 'damage', label: 'Damage' },
  { value: 'spoilage', label: 'Spoilage' },
  { value: 'theft', label: 'Theft' },
  { value: 'expired', label: 'Expired' },
  { value: 'operational_loss', label: 'Operational loss' },
]

/** WST-02 reasons. */
export const WASTE_REASONS: readonly AdjustmentReason[] = [
  { value: 'kitchen_waste', label: 'Kitchen waste' },
  { value: 'burnt_food', label: 'Burnt food' },
  { value: 'returned_food', label: 'Returned food' },
  { value: 'expired', label: 'Expired products' },
  { value: 'spoilage', label: 'Spoilage' },
]

export type AdjustmentLineDraft = {
  key: string
  itemId: string
  direction: AdjustmentDirection
  quantity: string
  unitId: string
  unitCost: string
}

export type AdjustmentDraft = {
  kind: AdjustmentKind
  adjustmentNumber: string
  adjustmentDate: string
  locationId: string
  reason: string
  notes: string
  lines: AdjustmentLineDraft[]
}

export type NormalizedAdjustmentLine = {
  itemId: string
  unitId: string
  direction: AdjustmentDirection
  quantity: number
  unitCost: number | null
}

export type NormalizedAdjustment = {
  kind: AdjustmentKind
  adjustmentNumber: string
  adjustmentDate: string
  locationId: string
  reason: string
  notes: string | null
  lines: NormalizedAdjustmentLine[]
}

export type CountLineDraft = {
  key: string
  itemId: string
  physicalQuantity: string
}

export type CountDraft = {
  countNumber: string
  countDate: string
  locationId: string
  counterName: string
  notes: string
  lines: CountLineDraft[]
}

export type NormalizedCountLine = {
  itemId: string
  physicalQuantity: number
}

export type NormalizedCount = {
  countNumber: string
  countDate: string
  locationId: string
  counterName: string
  notes: string | null
  lines: NormalizedCountLine[]
}

export type Validation<T> =
  | { valid: true; value: T; errors: Record<string, string> }
  | { valid: false; value: null; errors: Record<string, string> }

export type UnitFactor =
  | { factor: number; error: null }
  | { factor: null; error: string }

export type LinePreview = {
  factor: number | null
  baseQuantity: number | null
  lineTotal: number | null
  error: string | null
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function parsePositiveNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function parseMoney(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** Physical counts may legitimately be zero (the item is absent). */
export function parseNonNegativeNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

/**
 * Mirrors the database's stock_unit_factor() so the form can show the base
 * quantity and reject obviously unusable units before a round trip. The
 * database still resolves the factor again when a document is created.
 */
export function resolveUnitFactor(
  itemId: string,
  unitId: string,
  context: StockContext,
): UnitFactor {
  const item = context.items.find((candidate) => candidate.id === itemId)
  if (!item) return { factor: null, error: 'Choose an item.' }

  const unit = context.units.find((candidate) => candidate.id === unitId)
  if (!unit) return { factor: null, error: 'Choose a unit.' }

  const baseUnit = context.units.find((candidate) => candidate.id === item.base_unit_id)
  if (!baseUnit) return { factor: null, error: 'This item has no base unit configured.' }

  if (unit.dimension !== baseUnit.dimension) {
    return {
      factor: null,
      error: `Choose a ${baseUnit.dimension} unit for this item.`,
    }
  }

  if (unit.id === baseUnit.id) {
    return { factor: 1, error: null }
  }

  if (unit.base_factor !== null) {
    return unit.base_factor > 0
      ? { factor: unit.base_factor, error: null }
      : { factor: null, error: 'That unit has an invalid conversion factor.' }
  }

  const conversion = context.conversions.find(
    (candidate) => candidate.item_id === itemId && candidate.unit_id === unitId,
  )

  if (!conversion || conversion.base_factor <= 0) {
    return {
      factor: null,
      error: 'No conversion is configured for this unit and item. Add the factor on the item first.',
    }
  }

  return { factor: conversion.base_factor, error: null }
}

export function previewLine(line: StockLineDraft, context: StockContext): LinePreview {
  const resolved = resolveUnitFactor(line.itemId, line.unitId, context)
  const quantity = parsePositiveNumber(line.quantity)
  const cost = parseMoney(line.unitCost)

  return {
    factor: resolved.factor,
    baseQuantity:
      resolved.factor !== null && quantity !== null
        ? Math.round(quantity * resolved.factor * 1_000_000) / 1_000_000
        : null,
    lineTotal:
      quantity !== null && cost !== null
        ? Math.round(quantity * cost * 100) / 100
        : null,
    error: resolved.error,
  }
}

function validateLines(
  lines: readonly StockLineDraft[],
  context: StockContext,
  options: { requireCost: boolean },
): { errors: Record<string, string>; normalized: NormalizedGrnLine[] } {
  const errors: Record<string, string> = {}
  const normalized: NormalizedGrnLine[] = []

  if (lines.length === 0) {
    errors.lines = 'Add at least one line.'
    return { errors, normalized }
  }

  lines.forEach((line, index) => {
    const prefix = `line-${index}`
    if (!line.itemId) {
      errors[`${prefix}-item`] = 'Choose an item.'
    }

    if (!line.unitId) {
      errors[`${prefix}-unit`] = 'Choose a unit.'
    }

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
        poLineId: line.poLineId ?? null,
      })
    }
  })

  return { errors, normalized }
}

export function validateGrn(input: GrnDraft, context: StockContext): Validation<NormalizedGrn> {
  const errors: Record<string, string> = {}

  if (!input.grnNumber.trim()) errors.grnNumber = 'Enter a GRN number.'
  else if (input.grnNumber.trim().length > 40) errors.grnNumber = 'Use 40 characters or fewer.'

  if (!input.supplierId) errors.supplierId = 'Choose a supplier.'
  if (!input.invoiceNumber.trim()) errors.invoiceNumber = 'Enter the supplier invoice number.'
  else if (input.invoiceNumber.trim().length > 80) {
    errors.invoiceNumber = 'Use 80 characters or fewer.'
  }

  if (!input.receivedDate) errors.receivedDate = 'Choose the received date.'
  else if (!isIsoDate(input.receivedDate)) errors.receivedDate = 'Use a valid date.'

  if (!input.locationId) errors.locationId = 'Choose the receiving location.'
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
      grnNumber: input.grnNumber.trim().toUpperCase(),
      supplierId: input.supplierId,
      invoiceNumber: input.invoiceNumber.trim(),
      receivedDate: input.receivedDate,
      locationId: input.locationId,
      notes: input.notes.trim() || null,
      poId: input.poId || null,
      lines: lines.normalized,
    },
  }
}

export function validateSiv(input: SivDraft, context: StockContext): Validation<NormalizedSiv> {
  const errors: Record<string, string> = {}

  if (!input.sivNumber.trim()) errors.sivNumber = 'Enter a SIV number.'
  else if (input.sivNumber.trim().length > 40) errors.sivNumber = 'Use 40 characters or fewer.'

  if (!input.issueDate) errors.issueDate = 'Choose the issue date.'
  else if (!isIsoDate(input.issueDate)) errors.issueDate = 'Use a valid date.'

  if (!input.sourceLocationId) errors.sourceLocationId = 'Choose the source location.'
  if (!input.destinationLocationId) {
    errors.destinationLocationId = 'Choose the destination location.'
  } else if (input.sourceLocationId === input.destinationLocationId) {
    errors.destinationLocationId = 'Source and destination must be different.'
  }

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
      sivNumber: input.sivNumber.trim().toUpperCase(),
      issueDate: input.issueDate,
      sourceLocationId: input.sourceLocationId,
      destinationLocationId: input.destinationLocationId,
      notes: input.notes.trim() || null,
      lines: lines.normalized.map((line) => ({
        itemId: line.itemId,
        unitId: line.unitId,
        quantity: line.quantity,
      })),
    },
  }
}

export function validateInventoryAdjustment(
  input: AdjustmentDraft,
  context: StockContext,
): Validation<NormalizedAdjustment> {
  const errors: Record<string, string> = {}
  const reasons = input.kind === 'waste' ? WASTE_REASONS : ADJUSTMENT_REASONS

  if (!input.adjustmentNumber.trim()) {
    errors.adjustmentNumber = 'Enter a document number.'
  } else if (input.adjustmentNumber.trim().length > 40) {
    errors.adjustmentNumber = 'Use 40 characters or fewer.'
  }

  if (!input.adjustmentDate) errors.adjustmentDate = 'Choose the document date.'
  else if (!isIsoDate(input.adjustmentDate)) errors.adjustmentDate = 'Use a valid date.'

  if (!input.locationId) errors.locationId = 'Choose the stock location.'
  if (!reasons.some((reason) => reason.value === input.reason)) {
    errors.reason = input.kind === 'waste' ? 'Choose a waste reason.' : 'Choose an adjustment reason.'
  }
  if (input.notes.trim().length > 500) errors.notes = 'Use 500 characters or fewer.'

  const normalized: NormalizedAdjustmentLine[] = []

  if (input.lines.length === 0) {
    errors.lines = 'Add at least one line.'
  }

  input.lines.forEach((line, index) => {
    const prefix = `line-${index}`
    if (!line.itemId) errors[`${prefix}-item`] = 'Choose an item.'
    if (!line.unitId) errors[`${prefix}-unit`] = 'Choose a unit.'
    if (input.kind === 'waste' && line.direction !== 'out') {
      errors[`${prefix}-direction`] = 'Waste can only decrease stock.'
    }

    const quantity = parsePositiveNumber(line.quantity)
    if (quantity === null) {
      errors[`${prefix}-quantity`] = 'Enter a quantity greater than zero.'
    }

    let unitCost: number | null = null
    if (line.direction === 'in') {
      unitCost = parseMoney(line.unitCost)
      if (unitCost === null) {
        errors[`${prefix}-cost`] = 'Enter a unit cost greater than zero.'
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
      (line.direction === 'out' || unitCost !== null)
    ) {
      normalized.push({
        itemId: line.itemId,
        unitId: line.unitId,
        direction: line.direction,
        quantity,
        unitCost: line.direction === 'in' ? unitCost : null,
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
      kind: input.kind,
      adjustmentNumber: input.adjustmentNumber.trim().toUpperCase(),
      adjustmentDate: input.adjustmentDate,
      locationId: input.locationId,
      reason: input.reason,
      notes: input.notes.trim() || null,
      lines: normalized,
    },
  }
}

export function validateInventoryCount(
  input: CountDraft,
  context: Pick<StockContext, 'items'>,
): Validation<NormalizedCount> {
  const errors: Record<string, string> = {}

  if (!input.countNumber.trim()) errors.countNumber = 'Enter a count number.'
  else if (input.countNumber.trim().length > 40) {
    errors.countNumber = 'Use 40 characters or fewer.'
  }

  if (!input.countDate) errors.countDate = 'Choose the count date.'
  else if (!isIsoDate(input.countDate)) errors.countDate = 'Use a valid date.'

  if (!input.locationId) errors.locationId = 'Choose the stock location.'
  if (!input.counterName.trim()) errors.counterName = 'Enter the counter name.'
  else if (input.counterName.trim().length > 120) {
    errors.counterName = 'Use 120 characters or fewer.'
  }
  if (input.notes.trim().length > 500) errors.notes = 'Use 500 characters or fewer.'

  const normalized: NormalizedCountLine[] = []
  const seen = new Set<string>()

  if (input.lines.length === 0) {
    errors.lines = 'Add at least one line.'
  }

  input.lines.forEach((line, index) => {
    const prefix = `line-${index}`
    let lineValid = true

    if (!line.itemId) {
      errors[`${prefix}-item`] = 'Choose an item.'
      lineValid = false
    } else if (seen.has(line.itemId)) {
      errors[`${prefix}-item`] = 'Each item can appear only once.'
      lineValid = false
    } else if (!context.items.some((item) => item.id === line.itemId && item.is_active)) {
      errors[`${prefix}-item`] = 'Choose an active item.'
      lineValid = false
    } else {
      seen.add(line.itemId)
    }

    const physical = parseNonNegativeNumber(line.physicalQuantity)
    if (physical === null) {
      errors[`${prefix}-physical`] = 'Enter a quantity of zero or more.'
      lineValid = false
    }

    if (lineValid && line.itemId && physical !== null) {
      normalized.push({ itemId: line.itemId, physicalQuantity: physical })
    }
  })

  if (Object.keys(errors).length > 0) {
    return { valid: false, value: null, errors }
  }

  return {
    valid: true,
    errors,
    value: {
      countNumber: input.countNumber.trim().toUpperCase(),
      countDate: input.countDate,
      locationId: input.locationId,
      counterName: input.counterName.trim(),
      notes: input.notes.trim() || null,
      lines: normalized,
    },
  }
}

export function describeStockDbError(error: DbErrorLike): string {
  if (error.code === '23505') {
    if (/already posted/i.test(error.message)) {
      return 'That document is already posted. Refresh and try again.'
    }
    return 'That document number is already in use. Choose a different number.'
  }

  if (error.code === '23514') {
    if (/insufficient stock/i.test(error.message)) return error.message
    if (/conversion/i.test(error.message)) return error.message
    if (/dimension/i.test(error.message)) return error.message
    if (
      /only an approved|only a draft|only a submitted|each item can appear|choose an adjustment reason|choose a waste reason|waste can only decrease|needs a quantity greater than zero|needs a unit cost|needs at least one line|needs a physical quantity|choose an active|already posted/i.test(
        error.message,
      )
    ) {
      return error.message
    }
  }

  return mapDbError(error, 'stock postings')
}
