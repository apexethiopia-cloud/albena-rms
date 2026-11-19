import { describe, expect, it } from 'vitest'
import {
  describeTableDbError,
  validateTable,
  type TableDraft,
} from '@/features/tables/validation'
import {
  describeReservationDbError,
  isTimeOfDay,
  normalizeTime,
  validateReservation,
  type ReservationDraft,
  type ReservationTableContext,
} from '@/features/reservations/validation'

const OUTLETS = ['outlet-main', 'outlet-terrace']

const TABLES: ReservationTableContext[] = [
  { id: 'table-1', outlet_id: 'outlet-main', is_active: true },
  { id: 'table-old', outlet_id: 'outlet-main', is_active: false },
  { id: 'table-other', outlet_id: 'outlet-terrace', is_active: true },
]

function tableDraft(overrides: Partial<TableDraft> = {}): TableDraft {
  return {
    outletId: 'outlet-main',
    code: 't-01',
    name: 'Window table',
    capacity: '4',
    ...overrides,
  }
}

describe('validateTable', () => {
  it('normalizes the code and parses the seat count', () => {
    const result = validateTable(tableDraft({ code: ' t-01 ' }), OUTLETS)

    expect(result.valid).toBe(true)
    expect(result.value).toEqual({
      outletId: 'outlet-main',
      code: 'T-01',
      name: 'Window table',
      capacity: 4,
    })
  })

  it('accepts a blank code for automatic generation', () => {
    const result = validateTable(tableDraft({ code: '   ' }), OUTLETS)

    expect(result.valid).toBe(true)
    expect(result.errors.code).toBeUndefined()
    expect(result.value?.code).toBe('')
  })

  it('requires an active outlet and name', () => {
    const result = validateTable(
      tableDraft({ outletId: 'outlet-gone', code: ' ', name: ' ' }),
      OUTLETS,
    )

    expect(result.valid).toBe(false)
    expect(result.errors.outletId).toMatch(/active outlet/i)
    expect(result.errors.code).toBeUndefined()
    expect(result.errors.name).toMatch(/table name/i)
  })

  it('requires whole seats greater than zero', () => {
    for (const capacity of ['0', '-2', '2.5', '101', '']) {
      const result = validateTable(tableDraft({ capacity }), OUTLETS)
      expect(result.valid).toBe(false)
      expect(result.errors.capacity).toBeTruthy()
    }
  })
})

describe('describeTableDbError', () => {
  it('explains a duplicate table code', () => {
    expect(describeTableDbError({ code: '23505', message: 'duplicate key' })).toMatch(
      /already used in this outlet/i,
    )
  })

  it('passes through the open-order rule', () => {
    expect(
      describeTableDbError({ code: '23514', message: 'This table still has an open order' }),
    ).toBe('This table still has an open order')
  })
})

function reservationDraft(overrides: Partial<ReservationDraft> = {}): ReservationDraft {
  return {
    outletId: 'outlet-main',
    guestName: 'Selam Bekele',
    guestPhone: '+251911000000',
    reservedDate: '2026-11-20',
    reservedTime: '19:30',
    partySize: '4',
    tableId: '',
    specialRequests: '',
    ...overrides,
  }
}

describe('validateReservation', () => {
  it('accepts a reservation without a table', () => {
    const result = validateReservation(reservationDraft(), OUTLETS, TABLES)

    expect(result.valid).toBe(true)
    expect(result.value).toEqual({
      outletId: 'outlet-main',
      guestName: 'Selam Bekele',
      guestPhone: '+251911000000',
      reservedDate: '2026-11-20',
      reservedTime: '19:30',
      partySize: 4,
      tableId: null,
      specialRequests: null,
    })
  })

  it('accepts an active table from the same outlet', () => {
    const result = validateReservation(
      reservationDraft({ tableId: 'table-1', specialRequests: '  Window seat  ' }),
      OUTLETS,
      TABLES,
    )

    expect(result.valid).toBe(true)
    expect(result.value?.tableId).toBe('table-1')
    expect(result.value?.specialRequests).toBe('Window seat')
  })

  it('rejects an inactive table and a table from another outlet', () => {
    const inactive = validateReservation(
      reservationDraft({ tableId: 'table-old' }),
      OUTLETS,
      TABLES,
    )
    expect(inactive.valid).toBe(false)
    expect(inactive.errors.tableId).toMatch(/not active/i)

    const other = validateReservation(
      reservationDraft({ tableId: 'table-other' }),
      OUTLETS,
      TABLES,
    )
    expect(other.valid).toBe(false)
    expect(other.errors.tableId).toMatch(/another outlet/i)
  })

  it('requires guest name, phone, date, time and a positive party size', () => {
    const result = validateReservation(
      reservationDraft({
        guestName: ' ',
        guestPhone: ' ',
        reservedDate: '2026-13-01',
        reservedTime: '25:00',
        partySize: '0',
      }),
      OUTLETS,
      TABLES,
    )

    expect(result.valid).toBe(false)
    expect(result.errors.guestName).toMatch(/guest name/i)
    expect(result.errors.guestPhone).toMatch(/guest phone/i)
    expect(result.errors.reservedDate).toMatch(/valid date/i)
    expect(result.errors.reservedTime).toMatch(/valid time/i)
    expect(result.errors.partySize).toMatch(/greater than zero/i)
  })

  it('normalizes a time returned with seconds', () => {
    expect(normalizeTime('19:30:00')).toBe('19:30')
    expect(isTimeOfDay('19:30')).toBe(true)
    expect(isTimeOfDay('24:00')).toBe(false)
  })
})

describe('describeReservationDbError', () => {
  it('explains an exact-slot double booking', () => {
    expect(
      describeReservationDbError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "reservations_table_slot_unique"',
      }),
    ).toMatch(/already reserved for that exact date and time/i)
  })

  it('passes through reservation rule violations', () => {
    expect(
      describeReservationDbError({ code: '23514', message: 'A guest name is required' }),
    ).toBe('A guest name is required')
  })
})
