import { mapDbError, type DbErrorLike } from '@/lib/errors'
import {
  isIsoDate,
  parsePositiveNumber,
  resolveUnitFactor,
  type StockContext,
  type Validation,
} from '@/features/stock/validation'

export type ProductionInputDraft = {
  key: string
  itemId: string
  unitId: string
  quantity: string
}

export type ProductionDraft = {
  orderNumber: string
  productionDate: string
  locationId: string
  outputItemId: string
  outputUnitId: string
  outputQuantity: string
  expectedOutputQuantity: string
  responsibleName: string
  notes: string
  inputs: ProductionInputDraft[]
}

export type NormalizedProductionInput = {
  itemId: string
  unitId: string
  quantity: number
}

export type NormalizedProduction = {
  orderNumber: string
  productionDate: string
  locationId: string
  outputItemId: string
  outputUnitId: string
  outputQuantity: number
  expectedOutputQuantity: number | null
  responsibleName: string
  notes: string | null
  inputs: NormalizedProductionInput[]
}

export function validateProduction(
  input: ProductionDraft,
  context: StockContext,
): Validation<NormalizedProduction> {
  const errors: Record<string, string> = {}

  if (!input.orderNumber.trim()) errors.orderNumber = 'Enter a production number.'
  else if (input.orderNumber.trim().length > 40) {
    errors.orderNumber = 'Use 40 characters or fewer.'
  }

  if (!input.productionDate) errors.productionDate = 'Choose the production date.'
  else if (!isIsoDate(input.productionDate)) errors.productionDate = 'Use a valid date.'

  if (!input.locationId) errors.locationId = 'Choose the stock location.'
  if (!input.responsibleName.trim()) errors.responsibleName = 'Enter the responsible user.'
  else if (input.responsibleName.trim().length > 120) {
    errors.responsibleName = 'Use 120 characters or fewer.'
  }
  if (input.notes.trim().length > 500) errors.notes = 'Use 500 characters or fewer.'

  if (!input.outputItemId) {
    errors.outputItemId = 'Choose the output item.'
  } else if (
    !context.items.some((item) => item.id === input.outputItemId && item.is_active)
  ) {
    errors.outputItemId = 'Choose an active output item.'
  }

  const outputQuantity = parsePositiveNumber(input.outputQuantity)
  if (outputQuantity === null) {
    errors.outputQuantity = 'Enter an output quantity greater than zero.'
  }

  if (!input.outputUnitId) {
    errors.outputUnitId = 'Choose the output unit.'
  } else if (input.outputItemId) {
    const resolved = resolveUnitFactor(input.outputItemId, input.outputUnitId, context)
    if (resolved.error) errors.outputUnitId = resolved.error
  }

  const expectedRaw = input.expectedOutputQuantity.trim()
  const expected = expectedRaw ? parsePositiveNumber(expectedRaw) : null
  if (expectedRaw && expected === null) {
    errors.expectedOutputQuantity = 'Enter an expected output greater than zero, or leave it blank.'
  }

  const normalizedInputs: NormalizedProductionInput[] = []
  const seen = new Set<string>()

  if (input.inputs.length === 0) {
    errors.inputs = 'Add at least one input.'
  }

  input.inputs.forEach((line, index) => {
    const prefix = `input-${index}`
    let lineValid = true

    if (!line.itemId) {
      errors[`${prefix}-item`] = 'Choose an input item.'
      lineValid = false
    } else if (!context.items.some((item) => item.id === line.itemId && item.is_active)) {
      errors[`${prefix}-item`] = 'Choose an active input item.'
      lineValid = false
    } else if (seen.has(line.itemId)) {
      errors[`${prefix}-item`] = 'Each input item can appear only once.'
      lineValid = false
    } else {
      seen.add(line.itemId)
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
      normalizedInputs.push({ itemId: line.itemId, unitId: line.unitId, quantity })
    }
  })

  if (Object.keys(errors).length > 0) {
    return { valid: false, value: null, errors }
  }

  return {
    valid: true,
    errors,
    value: {
      orderNumber: input.orderNumber.trim().toUpperCase(),
      productionDate: input.productionDate,
      locationId: input.locationId,
      outputItemId: input.outputItemId,
      outputUnitId: input.outputUnitId,
      outputQuantity: outputQuantity as number,
      expectedOutputQuantity: expected,
      responsibleName: input.responsibleName.trim(),
      notes: input.notes.trim() || null,
      inputs: normalizedInputs,
    },
  }
}

export function describeProductionDbError(error: DbErrorLike): string {
  if (error.code === '23505') {
    if (/already posted/i.test(error.message)) {
      return 'That production order is already posted. Refresh and try again.'
    }
    return 'That production number is already in use. Choose a different number.'
  }
  if (error.code === '23514' && /insufficient stock/i.test(error.message)) {
    return error.message
  }
  if (
    error.code === '23514' &&
    /needs at least one input|needs a quantity greater than zero|can only appear once|choose an active|output quantity|expected output|unit|conversion|dimension/i.test(
      error.message,
    )
  ) {
    return error.message
  }
  return mapDbError(error, 'production')
}
