import { requireSupabase } from '@/lib/supabase'
import { describeDbError, type OutletInput } from './validation'

export type Outlet = {
  id: string
  code: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

const COLUMNS = 'id, code, name, is_active, created_at, updated_at'

export async function listOutlets(): Promise<Outlet[]> {
  const { data, error } = await requireSupabase()
    .from('outlets')
    .select(COLUMNS)
    .order('code', { ascending: true })

  if (error) throw new Error(describeDbError(error))
  return (data ?? []) as unknown as Outlet[]
}

export async function createOutlet(input: OutletInput): Promise<void> {
  const { error } = await requireSupabase().from('outlets').insert({
    code: input.code,
    name: input.name,
  })

  if (error) throw new Error(describeDbError(error))
}

export async function updateOutlet(
  id: string,
  patch: Partial<OutletInput & { is_active: boolean }>,
): Promise<void> {
  const { error } = await requireSupabase().from('outlets').update(patch).eq('id', id)

  if (error) throw new Error(describeDbError(error))
}
