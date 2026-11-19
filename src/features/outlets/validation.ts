import { mapDbError, type DbErrorLike } from '@/lib/errors'

export type OutletInput = {
  code: string
  name: string
}

export type ValidationResult = {
  valid: boolean
  errors: Record<string, string>
  normalized: OutletInput
}

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,11}$/

export function validateOutlet(input: OutletInput): ValidationResult {
  const errors: Record<string, string> = {}
  const code = input.code.trim().toUpperCase()
  const name = input.name.trim()

  // A blank code is valid: the database trigger generates the master code.
  if (code && !CODE_PATTERN.test(code)) {
    errors.code = 'Use 2–12 characters: letters, digits, hyphen or underscore.'
  }

  if (!name) {
    errors.name = 'Name is required.'
  } else if (name.length > 80) {
    errors.name = 'Keep the name under 80 characters.'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalized: { code, name },
  }
}

export function describeDbError(error: DbErrorLike): string {
  return mapDbError(error, 'outlets')
}

export function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
