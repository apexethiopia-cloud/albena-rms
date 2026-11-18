import { mapDbError, type DbErrorLike } from '@/lib/errors'
import { isIsoDate, type Validation } from '@/features/stock/validation'

export type ReservationDraft = {
  outletId: string
  guestName: string
  guestPhone: string
  reservedDate: string
  reservedTime: string
  partySize: string
  tableId: string
  specialRequests: string
}

export type NormalizedReservation = {
  outletId: string
  guestName: string
  guestPhone: string
  reservedDate: string
  reservedTime: string
  partySize: number
  tableId: string | null
  specialRequests: string | null
}

export type ReservationTableContext = {
  id: string
  outlet_id: string
  is_active: boolean
}

export function isTimeOfDay(value: string): boolean {
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return false
  const [hours, minutes] = value.split(':').map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

/** The HTML time input gives HH:MM; Postgres may return HH:MM:SS. */
export function normalizeTime(value: string): string {
  return value.slice(0, 5)
}

export function validateReservation(
  input: ReservationDraft,
  outletIds: string[],
  tables: ReservationTableContext[],
): Validation<NormalizedReservation> {
  const errors: Record<string, string> = {}

  if (!input.outletId) errors.outletId = 'Choose the outlet.'
  else if (!outletIds.includes(input.outletId)) errors.outletId = 'Choose an active outlet.'

  if (!input.guestName.trim()) errors.guestName = 'Enter the guest name.'
  else if (input.guestName.trim().length > 120) {
    errors.guestName = 'Use 120 characters or fewer.'
  }

  if (!input.guestPhone.trim()) errors.guestPhone = 'Enter the guest phone.'
  else if (input.guestPhone.trim().length > 40) {
    errors.guestPhone = 'Use 40 characters or fewer.'
  }

  if (!input.reservedDate) errors.reservedDate = 'Choose the reservation date.'
  else if (!isIsoDate(input.reservedDate)) errors.reservedDate = 'Use a valid date.'

  if (!input.reservedTime) errors.reservedTime = 'Choose the reservation time.'
  else if (!isTimeOfDay(normalizeTime(input.reservedTime))) {
    errors.reservedTime = 'Use a valid time.'
  }

  const partySize = Number(input.partySize)
  if (!input.partySize.trim()) errors.partySize = 'Enter the party size.'
  else if (!Number.isInteger(partySize) || partySize <= 0) {
    errors.partySize = 'The party size must be a whole number greater than zero.'
  } else if (partySize > 100) {
    errors.partySize = 'Use 100 guests or fewer.'
  }

  if (input.specialRequests.trim().length > 500) {
    errors.specialRequests = 'Use 500 characters or fewer.'
  }

  if (input.tableId) {
    const table = tables.find((candidate) => candidate.id === input.tableId)
    if (!table) errors.tableId = 'Choose a valid table.'
    else if (!table.is_active) errors.tableId = 'That table is not active.'
    else if (table.outlet_id !== input.outletId) {
      errors.tableId = 'That table belongs to another outlet.'
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, value: null, errors }
  }

  return {
    valid: true,
    errors,
    value: {
      outletId: input.outletId,
      guestName: input.guestName.trim(),
      guestPhone: input.guestPhone.trim(),
      reservedDate: input.reservedDate,
      reservedTime: normalizeTime(input.reservedTime),
      partySize,
      tableId: input.tableId || null,
      specialRequests: input.specialRequests.trim() || null,
    },
  }
}

export function describeReservationDbError(error: DbErrorLike): string {
  if (error.code === '23505') {
    if (/table_id|reserved_date|reserved_time|table_slot/i.test(error.message)) {
      return 'That table is already reserved for that exact date and time. Choose another table or slot.'
    }
    return 'That reservation number is already in use. Refresh and try again.'
  }
  if (
    error.code === '23514' &&
    /guest|party size|date|time|table|reservation|outlet/i.test(error.message)
  ) {
    return error.message
  }
  return mapDbError(error, 'reservations')
}
