import { requireSupabase } from '@/lib/supabase'
import { describeLocationDbError, type LocationInput } from './validation'

export type StockLocation = {
  id: string
  code: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

const COLUMNS = 'id, code, name, is_active, created_at, updated_at'

export async function listLocations(): Promise<StockLocation[]> {
  const { data, error } = await requireSupabase()
    .from('stock_locations')
    .select(COLUMNS)
    .order('code', { ascending: true })

  if (error) throw new Error(describeLocationDbError(error))
  return (data ?? []) as unknown as StockLocation[]
}

export async function createLocation(input: LocationInput): Promise<void> {
  const { error } = await requireSupabase().from('stock_locations').insert({
    code: input.code,
    name: input.name,
  })

  if (error) throw new Error(describeLocationDbError(error))
}

export async function updateLocation(
  id: string,
  patch: Partial<LocationInput & { is_active: boolean }>,
): Promise<void> {
  const { error } = await requireSupabase()
    .from('stock_locations')
    .update(patch)
    .eq('id', id)

  if (error) throw new Error(describeLocationDbError(error))
}
