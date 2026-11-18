import { mapDbError, type DbErrorLike } from '@/lib/errors'
import type { Validation } from '@/features/stock/validation'

export type BusinessSettingsDraft = {
  businessName: string
  tin: string
  address: string
  phone: string
  vatRate: string
  receiptFooter: string
}

export type NormalizedBusinessSettings = {
  businessName: string
  tin: string | null
  address: string | null
  phone: string | null
  vatRate: number
  receiptFooter: string | null
}

const MAX = {
  businessName: 120,
  tin: 40,
  address: 200,
  phone: 40,
  receiptFooter: 300,
} as const

function optional(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function validateBusinessSettings(
  input: BusinessSettingsDraft,
): Validation<NormalizedBusinessSettings> {
  const errors: Record<string, string> = {}

  if (!input.businessName.trim()) {
    errors.businessName = 'Enter the business name used on receipts.'
  } else if (input.businessName.trim().length > MAX.businessName) {
    errors.businessName = `Use ${MAX.businessName} characters or fewer.`
  }

  if (input.tin.trim().length > MAX.tin) {
    errors.tin = `Use ${MAX.tin} characters or fewer.`
  }
  if (input.address.trim().length > MAX.address) {
    errors.address = `Use ${MAX.address} characters or fewer.`
  }
  if (input.phone.trim().length > MAX.phone) {
    errors.phone = `Use ${MAX.phone} characters or fewer.`
  }
  if (input.receiptFooter.trim().length > MAX.receiptFooter) {
    errors.receiptFooter = `Use ${MAX.receiptFooter} characters or fewer.`
  }

  const vatRate = Number(input.vatRate)
  if (!input.vatRate.trim()) {
    errors.vatRate = 'Enter the VAT rate.'
  } else if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
    errors.vatRate = 'Enter a VAT rate between 0 and 100.'
  } else if (Math.round(vatRate * 100) !== vatRate * 100) {
    errors.vatRate = 'Use at most two decimal places.'
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, value: null, errors }
  }

  return {
    valid: true,
    errors,
    value: {
      businessName: input.businessName.trim(),
      tin: optional(input.tin),
      address: optional(input.address),
      phone: optional(input.phone),
      vatRate,
      receiptFooter: optional(input.receiptFooter),
    },
  }
}

export function describeBusinessSettingsDbError(error: DbErrorLike): string {
  if (error.code === '42501') {
    return 'You do not have permission to change the business settings.'
  }
  if (
    error.code === '23514' &&
    /business|vat|name|rate/i.test(error.message)
  ) {
    return error.message
  }
  return mapDbError(error, 'business settings')
}
