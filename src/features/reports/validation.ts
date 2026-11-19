/** Reporting helpers for Phase 7 (RPT-09 date range, aggregation). */

export type Numberish = number | string

export type DateRange = {
  from: string
  to: string
}

export const BUSINESS_TIMEZONE = 'Africa/Addis_Ababa'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Converts stored numeric strings to a finite number without inventing values. */
export function asNumber(value: Numberish | null | undefined): number {
  if (value === null || value === undefined) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/** Current business date in Africa/Addis_Ababa (OD-01), formatted YYYY-MM-DD. */
export function businessToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const byType: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') byType[part.type] = part.value
  }
  return `${byType.year}-${byType.month}-${byType.day}`
}

/** Month-to-date is the default report range; the user can change either end. */
export function defaultReportRange(now: Date = new Date()): DateRange {
  const today = businessToday(now)
  return { from: `${today.slice(0, 8)}01`, to: today }
}

/**
 * RPT-09 filter validation. Returns a human-readable error, or null when the
 * range is usable. A one-year guard keeps browser-side aggregation bounded; it
 * is a UI safety limit, not a business rule.
 */
export function validateDateRange(from: string, to: string): string | null {
  if (!from || !to) return 'Choose both a start and an end date.'
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) {
    return 'Enter valid dates in YYYY-MM-DD format.'
  }
  if (from > to) return 'The start date must be on or before the end date.'
  if (daysBetween(from, to) > 366) return 'Choose a range of one year or less.'
  return null
}

/** Inclusive day count between two ISO dates. */
export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.round((end - start) / 86_400_000)
}

export function isDateInRange(date: string, range: DateRange): boolean {
  return date >= range.from && date <= range.to
}

export function sumBy<T>(rows: readonly T[], value: (row: T) => Numberish): number {
  let total = 0
  for (const row of rows) total += asNumber(value(row))
  return total
}

export type Aggregate = {
  key: string
  label: string
  quantity: number
  value: number
}

/**
 * Groups rows by a key and sums quantity and value. Used for category, item and
 * waiter breakdowns; ordering is highest value first.
 */
export function aggregateRows<T>(
  rows: readonly T[],
  key: (row: T) => string | null | undefined,
  label: (row: T) => string,
  quantity: (row: T) => Numberish,
  value: (row: T) => Numberish,
): Aggregate[] {
  const map = new Map<string, Aggregate>()
  for (const row of rows) {
    const groupKey = key(row) ?? 'unknown'
    const current = map.get(groupKey) ?? {
      key: groupKey,
      label: label(row),
      quantity: 0,
      value: 0,
    }
    current.quantity += asNumber(quantity(row))
    current.value += asNumber(value(row))
    map.set(groupKey, current)
  }
  return [...map.values()].sort((a, b) => b.value - a.value)
}

/** Percentage as a number (0..100), or null when the denominator is zero. */
export function percentOf(part: Numberish, whole: Numberish): number | null {
  const wholeValue = asNumber(whole)
  if (wholeValue <= 0) return null
  return (asNumber(part) / wholeValue) * 100
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function formatPercent(value: number | null, decimals = 1): string {
  if (value === null || !Number.isFinite(value)) return 'n/a'
  return `${value.toFixed(decimals)}%`
}

/**
 * KDS delayed-ticket threshold. This is a filter for the dashboard and kitchen
 * report, not a business rule: the owner can change it in the UI.
 */
export const DEFAULT_DELAY_MINUTES = 20

/** Whole minutes elapsed since a timestamp, or null when it cannot be parsed. */
export function minutesSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return null
  return Math.max(0, Math.round((now.getTime() - then) / 60_000))
}

