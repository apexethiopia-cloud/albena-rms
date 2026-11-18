import { describe, expect, it } from 'vitest'
import { formatCurrency, formatDateTime, toIsoDate } from '@/lib/format'

describe('formatCurrency', () => {
  it('renders ETB with exactly two decimals', () => {
    const formatted = formatCurrency(1234.5)
    expect(formatted).toContain('ETB')
    expect(formatted).toContain('1,234.50')
  })
})

describe('timezone formatting', () => {
  it('converts UTC to Africa/Addis_Ababa (UTC+3)', () => {
    const formatted = formatDateTime('2026-11-18T09:00:00Z', 'Africa/Addis_Ababa')
    expect(formatted).toContain('18 Nov 2026')
    expect(formatted).toContain('12:00')
  })

  it('derives report dates from the business timezone, not UTC', () => {
    // 22:30 UTC is already the next day in Addis Ababa.
    expect(toIsoDate('2026-11-18T22:30:00Z', 'Africa/Addis_Ababa')).toBe('2026-11-19')
  })
})
