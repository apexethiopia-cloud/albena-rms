import { requireSupabase } from '@/lib/supabase'
import { describeCategoryDbError, type CategoryInput } from './validation'

export type Category = {
  id: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

const COLUMNS =
  'id, name, sort_order, is_active, created_at, updated_at'

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await requireSupabase()
    .from('item_categories')
    .select(COLUMNS)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw new Error(describeCategoryDbError(error))
  return (data ?? []) as unknown as Category[]
}

export async function createCategory(input: CategoryInput): Promise<void> {
  const { error } = await requireSupabase().from('item_categories').insert({
    name: input.name,
    sort_order: Number(input.sortOrder),
  })

  if (error) throw new Error(describeCategoryDbError(error))
}

export async function updateCategory(
  id: string,
  patch: Partial<CategoryInput> & { is_active?: boolean },
): Promise<void> {
  const row: Record<string, unknown> = {}

  if (patch.name !== undefined) row.name = patch.name
  if (patch.sortOrder !== undefined) row.sort_order = Number(patch.sortOrder)
  if (patch.is_active !== undefined) row.is_active = patch.is_active

  const { error } = await requireSupabase()
    .from('item_categories')
    .update(row)
    .eq('id', id)

  if (error) throw new Error(describeCategoryDbError(error))
}
