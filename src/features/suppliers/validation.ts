import { mapDbError, type DbErrorLike } from '@/lib/errors'

export type SupplierInput = {
  code: string
  name: string
  contactName: string
  phone: string
  email: string
  address: string
  taxNumber: string
  paymentTerms: string
}

export type SupplierValidation = {
  valid: boolean
  errors: Record<string, string>
  normalized: SupplierInput
}

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,11}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_PATTERN = /^[0-9+()\-.\s]{7,30}$/

function limit(
  errors: Record<string, string>,
  key: string,
  value: string,
  max: number,
  label: string,
): void {
  if (value.length > max) {
    errors[key] = `${label} must be ${max} characters or fewer.`
  }
}

export function validateSupplier(input: SupplierInput): SupplierValidation {
  const errors: Record<string, string> = {}
  const normalized: SupplierInput = {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    contactName: input.contactName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    address: input.address.trim(),
    taxNumber: input.taxNumber.trim(),
    paymentTerms: input.paymentTerms.trim(),
  }

  // A blank code is valid: the database trigger generates the master code.
  if (normalized.code && !CODE_PATTERN.test(normalized.code)) {
    errors.code = 'Use 2–12 characters: letters, digits, hyphen or underscore.'
  }

  if (!normalized.name) {
    errors.name = 'Supplier name is required.'
  } else {
    limit(errors, 'name', normalized.name, 120, 'Supplier name')
  }

  limit(errors, 'contactName', normalized.contactName, 80, 'Contact name')
  limit(errors, 'address', normalized.address, 200, 'Address')
  limit(errors, 'taxNumber', normalized.taxNumber, 40, 'Tax number')
  limit(errors, 'paymentTerms', normalized.paymentTerms, 60, 'Payment terms')

  if (normalized.phone && !PHONE_PATTERN.test(normalized.phone)) {
    errors.phone = 'Use digits, spaces, +, -, ( or ) — at least 7 characters.'
  }

  if (normalized.email && !EMAIL_PATTERN.test(normalized.email)) {
    errors.email = 'Enter a valid email address, or leave it blank.'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalized,
  }
}

export function describeSupplierDbError(error: DbErrorLike): string {
  return mapDbError(error, 'suppliers')
}
