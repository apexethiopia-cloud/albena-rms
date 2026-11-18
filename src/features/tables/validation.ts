import { mapDbError, type DbErrorLike } from '@/lib/errors'
import type { Validation } from '@/features/stock/validation'

export type TableDraft = {
  outletId: string
  code: string
  name: string
  capacity: string
}

export type NormalizedTable = {
  outletId: string
  code: string
  name: string
  capacity: number
}

export function validateTable(
  input: TableDraft,
  outletIds: string[],
): Validation<NormalizedTable> {
  const errors: Record<string, string> = {}

  if (!input.outletId) errors.outletId = 'Choose the outlet.'
  else if (!outletIds.includes(input.outletId)) errors.outletId = 'Choose an active outlet.'

  if (!input.code.trim()) errors.code = 'Enter a table code.'
  else if (input.code.trim().length > 20) errors.code = 'Use 20 characters or fewer.'

  if (!input.name.trim()) errors.name = 'Enter a table name.'
  else if (input.name.trim().length > 60) errors.name = 'Use 60 characters or fewer.'

  const capacity = Number(input.capacity)
  if (!input.capacity.trim()) errors.capacity = 'Enter the number of seats.'
  else if (!Number.isInteger(capacity) || capacity <= 0) {
    errors.capacity = 'Seats must be a whole number greater than zero.'
  } else if (capacity > 100) {
    errors.capacity = 'Use 100 seats or fewer.'
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, value: null, errors }
  }

  return {
    valid: true,
    errors,
    value: {
      outletId: input.outletId,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      capacity,
    },
  }
}

export function describeTableDbError(error: DbErrorLike): string {
  if (error.code === '23505') {
    return 'That table code is already used in this outlet. Choose a different code.'
  }
  if (
    error.code === '23514' &&
    /still has an open order|code|name|capacity|seats/i.test(error.message)
  ) {
    return error.message
  }
  return mapDbError(error, 'tables')
}
