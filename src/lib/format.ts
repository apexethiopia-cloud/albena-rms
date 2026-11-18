import { CURRENCY, env } from './env'

const currencyFormatter = new Intl.NumberFormat('en-ET', {
  style: 'currency',
  currency: CURRENCY,
  currencyDisplay: 'code',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Money is stored as numeric(14,2); always render exactly two decimals. */
export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

const quantityFormatter = new Intl.NumberFormat('en-ET', {
  maximumFractionDigits: 6,
})

const unitCostFormatter = new Intl.NumberFormat('en-ET', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
})

/** Stock quantities are in base units and may carry up to six decimals. */
export function formatQuantity(amount: number): string {
  return quantityFormatter.format(amount)
}

/**
 * FIFO cost per base unit can be far below one birr (for example per gram),
 * so the internal cost is shown with up to six decimals. Document totals use
 * formatCurrency instead.
 */
export function formatUnitCost(amount: number): string {
  return unitCostFormatter.format(amount)
}

export function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

export function formatDate(value: Date | string, timeZone: string = env.timezone): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone,
  }).format(toDate(value))
}

export function formatDateTime(value: Date | string, timeZone: string = env.timezone): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(toDate(value))
}

/** ISO date (YYYY-MM-DD) in the business timezone, for report boundaries. */
export function toIsoDate(value: Date | string, timeZone: string = env.timezone): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(toDate(value))
  return parts
}
