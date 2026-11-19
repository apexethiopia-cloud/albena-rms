import { describe, expect, it } from 'vitest'
import {
  aggregateRows,
  asNumber,
  businessToday,
  daysBetween,
  defaultReportRange,
  formatPercent,
  isDateInRange,
  isValidIsoDate,
  minutesSince,
  percentOf,
  roundTo,
  sumBy,
  validateDateRange,
} from '@/features/reports/validation'

describe('report date helpers', () => {
  it('uses the Addis Ababa business date (UTC+3)', () => {
    expect(businessToday(new Date('2026-11-18T20:59:00Z'))).toBe('2026-11-18')
    expect(businessToday(new Date('2026-11-18T22:30:00Z'))).toBe('2026-11-19')
  })

  it('defaults to month-to-date', () => {
    expect(defaultReportRange(new Date('2026-11-18T22:30:00Z'))).toEqual({
      from: '2026-11-01',
      to: '2026-11-19',
    })
  })

  it('validates ISO dates and date order', () => {
    expect(isValidIsoDate('2026-11-18')).toBe(true)
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(isValidIsoDate('18-11-2026')).toBe(false)

    expect(validateDateRange('', '2026-11-18')).toMatch(/both a start and an end/i)
    expect(validateDateRange('2026-11-18', 'not-a-date')).toMatch(/valid dates/i)
    expect(validateDateRange('2026-11-19', '2026-11-18')).toMatch(/on or before/i)
    expect(validateDateRange('2025-01-01', '2026-11-18')).toMatch(/one year or less/i)
    expect(validateDateRange('2026-11-01', '2026-11-30')).toBeNull()
  })

  it('counts inclusive days and checks range membership', () => {
    expect(daysBetween('2026-11-01', '2026-11-30')).toBe(29)
    expect(isDateInRange('2026-11-18', { from: '2026-11-01', to: '2026-11-30' })).toBe(true)
    expect(isDateInRange('2026-12-01', { from: '2026-11-01', to: '2026-11-30' })).toBe(false)
  })

  it('parses numbers safely and rounds', () => {
    expect(asNumber('12.5')).toBe(12.5)
    expect(asNumber(null)).toBe(0)
    expect(asNumber('not-a-number')).toBe(0)
    expect(roundTo(1.23456, 2)).toBe(1.23)
  })
})

describe('report aggregation helpers', () => {
  const rows = [
    { code: 'A', name: 'Alpha', qty: 2, value: '10.00', group: 'x' },
    { code: 'A', name: 'Alpha', qty: 3, value: '15.00', group: 'x' },
    { code: 'B', name: 'Beta', qty: 1, value: '50.00', group: 'y' },
  ]

  it('sums values', () => {
    expect(sumBy(rows, (row) => row.value)).toBe(75)
  })

  it('groups and sorts by value descending', () => {
    const grouped = aggregateRows(
      rows,
      (row) => row.code,
      (row) => row.name,
      (row) => row.qty,
      (row) => row.value,
    )

    expect(grouped).toEqual([
      { key: 'B', label: 'Beta', quantity: 1, value: 50 },
      { key: 'A', label: 'Alpha', quantity: 5, value: 25 },
    ])
  })

  it('returns null percentages for zero denominators', () => {
    expect(percentOf(25, 100)).toBe(25)
    expect(percentOf(1, 0)).toBeNull()
    expect(percentOf(0, 0)).toBeNull()
    expect(formatPercent(null)).toBe('n/a')
    expect(formatPercent(12.36)).toBe('12.4%')
  })

  it('computes elapsed minutes and clamps future timestamps', () => {
    const now = new Date('2026-11-18T10:30:00Z')
    expect(minutesSince('2026-11-18T10:00:00Z', now)).toBe(30)
    expect(minutesSince('2026-11-18T11:00:00Z', now)).toBe(0)
    expect(minutesSince(null, now)).toBeNull()
    expect(minutesSince('bad', now)).toBeNull()
  })
})
