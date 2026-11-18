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

  if (!code) {
    errors.code = 'Code is required.'
  } else if (!CODE_PATTERN.test(code)) {
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

type DbErrorLike = { code?: string; message: string }

export function describeDbError(error: DbErrorLike): string {
  switch (error.code) {
    case '23505':
      return 'That code is already in use. Choose a different one.'
    case '42501':
      return 'You do not have permission to change outlets.'
    case '23514':
      return 'The value violates a database rule.'
    default:
      return error.message
  }
}

export function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
