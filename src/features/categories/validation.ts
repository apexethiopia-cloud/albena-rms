import { mapDbError, type DbErrorLike } from '@/lib/errors'

export type CategoryInput = {
  name: string
  sortOrder: string
}

export type ValidationResult = {
  valid: boolean
  errors: Record<string, string>
  normalized: CategoryInput
}

const NAME_MAX_LENGTH = 80

export function validateCategory(input: CategoryInput): ValidationResult {
  const errors: Record<string, string> = {}
  const name = input.name.trim()
  const sortOrder = input.sortOrder.trim()

  if (!name) {
    errors.name = 'Category name is required.'
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = `Keep the name under ${NAME_MAX_LENGTH} characters.`
  }

  if (sortOrder) {
    if (!/^\d+$/.test(sortOrder)) {
      errors.sortOrder = 'Use a whole number of at least 0 for the sort order.'
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    normalized: {
      name,
      sortOrder: sortOrder || '0',
    },
  }
}

export function describeCategoryDbError(error: DbErrorLike): string {
  return mapDbError(error, 'categories')
}
