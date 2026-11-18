import { requireSupabase } from '@/lib/supabase'
import { describeItemDbError, type NormalizedItem } from './validation'

export type Item = {
  id: string
  code: string
  name: string
  category_id: string | null
  base_unit_id: string
  purchase_unit_id: string | null
  reorder_level: number | string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Unit = {
  id: string
  code: string
  name: string
  dimension: 'mass' | 'volume' | 'count'
  is_base: boolean
  base_factor: number | null
}

export type Category = {
  id: string
  name: string
  is_active: boolean
}

const ITEM_COLUMNS =
  'id, code, name, category_id, base_unit_id, purchase_unit_id, reorder_level, is_active, created_at, updated_at'

export async function listItems(): Promise<Item[]> {
  const { data, error } = await requireSupabase()
    .from('items')
    .select(ITEM_COLUMNS)
    .order('name', { ascending: true })

  if (error) throw new Error(describeItemDbError(error))
  return (data ?? []) as unknown as Item[]
}

export async function listUnits(): Promise<Unit[]> {
  const { data, error } = await requireSupabase()
    .from('units')
    .select('id, code, name, dimension, is_base, base_factor')
    .order('dimension', { ascending: true })
    .order('is_base', { ascending: false })

  if (error) throw new Error(describeItemDbError(error))
  return (data ?? []) as unknown as Unit[]
}

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await requireSupabase()
    .from('item_categories')
    .select('id, name, is_active')
    .order('name', { ascending: true })

  if (error) throw new Error(describeItemDbError(error))
  return (data ?? []) as unknown as Category[]
}

export async function createItem(input: NormalizedItem): Promise<string> {
  const { data, error } = await requireSupabase().from('items').insert({
    code: input.code,
    name: input.name,
    category_id: input.categoryId,
    base_unit_id: input.baseUnitId,
    purchase_unit_id: input.purchaseUnitId,
    reorder_level: input.reorderLevel,
  }).select('id').single()

  if (error) throw new Error(describeItemDbError(error))
  if (!data) throw new Error(describeItemDbError({ message: 'The insert returned no row' }))
  return (data as { id: string }).id
}

export async function listItemUnitConversions(): Promise<
  Array<{ item_id: string; unit_id: string; base_factor: number }>
> {
  const { data, error } = await requireSupabase()
    .from('item_unit_conversions')
    .select('item_id, unit_id, base_factor')

  if (error) throw new Error(describeItemDbError(error))
  return (data ?? []) as unknown as Array<{
    item_id: string
    unit_id: string
    base_factor: number
  }>
}

export async function createItemUnitConversion(
  itemId: string,
  unitId: string,
  baseFactor: number,
): Promise<void> {
  const { error } = await requireSupabase()
    .from('item_unit_conversions')
    .insert({ item_id: itemId, unit_id: unitId, base_factor: baseFactor })
    .select('item_id, unit_id, base_factor')
    .single()

  if (error) throw new Error(describeItemDbError(error))
}

export async function updateItemUnitConversion(
  itemId: string,
  unitId: string,
  baseFactor: number,
): Promise<void> {
  const { error } = await requireSupabase()
    .from('item_unit_conversions')
    .update({ base_factor: baseFactor })
    .eq('item_id', itemId)
    .eq('unit_id', unitId)

  if (error) throw new Error(describeItemDbError(error))
}

export async function updateItem(
  id: string,
  patch: Partial<NormalizedItem> & { is_active?: boolean },
): Promise<void> {
  const row: Record<string, unknown> = {}

  if (patch.code !== undefined) row.code = patch.code
  if (patch.name !== undefined) row.name = patch.name
  if (patch.categoryId !== undefined) row.category_id = patch.categoryId
  if (patch.baseUnitId !== undefined) row.base_unit_id = patch.baseUnitId
  if (patch.purchaseUnitId !== undefined) row.purchase_unit_id = patch.purchaseUnitId
  if (patch.reorderLevel !== undefined) row.reorder_level = patch.reorderLevel
  if (patch.is_active !== undefined) row.is_active = patch.is_active

  const { error } = await requireSupabase().from('items').update(row).eq('id', id)

  if (error) throw new Error(describeItemDbError(error))
}
