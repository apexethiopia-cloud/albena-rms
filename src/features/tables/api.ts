import { requireSupabase } from '@/lib/supabase'
import { describeTableDbError, type NormalizedTable } from './validation'

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'closed'

export type RestaurantTable = {
  id: string
  outlet_id: string
  code: string
  name: string
  capacity: number
  status: TableStatus
  is_active: boolean
  created_at: string
  updated_at: string
}

const TABLE_COLUMNS =
  'id, outlet_id, code, name, capacity, status, is_active, created_at, updated_at'

export async function listTables(): Promise<RestaurantTable[]> {
  const { data, error } = await requireSupabase()
    .from('restaurant_tables')
    .select(TABLE_COLUMNS)
    .order('code', { ascending: true })

  if (error) throw new Error(describeTableDbError(error))
  return (data ?? []) as unknown as RestaurantTable[]
}

export async function createTable(input: NormalizedTable): Promise<string> {
  const { data, error } = await requireSupabase()
    .from('restaurant_tables')
    .insert({
      outlet_id: input.outletId,
      code: input.code,
      name: input.name,
      capacity: input.capacity,
    })
    .select('id')
    .single()

  if (error) throw new Error(describeTableDbError(error))
  if (!data) {
    throw new Error('The table was saved but no reference was returned. Refresh the list.')
  }
  return (data as { id: string }).id
}

export async function updateTable(
  id: string,
  input: NormalizedTable & { isActive?: boolean },
): Promise<void> {
  const row: Record<string, unknown> = {
    outlet_id: input.outletId,
    code: input.code,
    name: input.name,
    capacity: input.capacity,
  }
  if (input.isActive !== undefined) row.is_active = input.isActive

  const { error } = await requireSupabase().from('restaurant_tables').update(row).eq('id', id)

  if (error) throw new Error(describeTableDbError(error))
}

/** Status changes go through the role-gated RPC, never a direct table update. */
export async function setTableStatus(id: string, status: TableStatus): Promise<void> {
  const { error } = await requireSupabase().rpc('set_table_status', {
    p_table_id: id,
    p_status: status,
  })

  if (error) throw new Error(describeTableDbError(error))
}
