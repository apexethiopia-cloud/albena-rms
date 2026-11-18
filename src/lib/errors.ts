export type DbErrorLike = { code?: string; message: string }

/**
 * Turns a PostgREST/PostgreSQL error into something a restaurant manager can act on.
 * `subject` names the record type, e.g. "suppliers".
 */
export function mapDbError(error: DbErrorLike, subject = 'this record'): string {
  switch (error.code) {
    case '23505':
      return 'That code is already in use. Choose a different one.'
    case '42501':
      return `You do not have permission to change ${subject}.`
    case '23514':
      return 'The value violates a database rule.'
    case '23503':
      return 'A referenced record does not exist or is still in use.'
    case 'P0002':
      return 'That record no longer exists. Refresh and try again.'
    case '42P01':
    case 'PGRST205':
      return 'This table is not in the database yet. Apply the pending Supabase migration.'
    default:
      return error.message
  }
}

export function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
