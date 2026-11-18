import { requireSupabase } from '@/lib/supabase'
import { describeMenuDbError, type NormalizedMenuItem } from './validation'

export type Numberish = number | string

export type MenuCategory = {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

export type MenuItem = {
  id: string
  code: string
  name: string
  category_id: string | null
  selling_price: Numberish
  recipe_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  menu_categories: { name: string } | null
  recipes: { code: string; name: string } | null
}

const MENU_ITEM_COLUMNS = `
  id, code, name, category_id, selling_price, recipe_id, is_active,
  created_at, updated_at, menu_categories (name), recipes (code, name)
`

export async function listMenuCategories(): Promise<MenuCategory[]> {
  const { data, error } = await requireSupabase()
    .from('menu_categories')
    .select('id, name, sort_order, is_active')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw new Error(describeMenuDbError(error))
  return (data ?? []) as unknown as MenuCategory[]
}

export async function listMenuItems(): Promise<MenuItem[]> {
  const { data, error } = await requireSupabase()
    .from('menu_items')
    .select(MENU_ITEM_COLUMNS)
    .order('name', { ascending: true })

  if (error) throw new Error(describeMenuDbError(error))
  return (data ?? []) as unknown as MenuItem[]
}

export async function createMenuItem(input: NormalizedMenuItem): Promise<string> {
  const { data, error } = await requireSupabase()
    .from('menu_items')
    .insert({
      code: input.code,
      name: input.name,
      category_id: input.categoryId,
      selling_price: input.sellingPrice,
      recipe_id: input.recipeId,
    })
    .select('id')
    .single()

  if (error) throw new Error(describeMenuDbError(error))
  if (!data) throw new Error('The menu item was saved but no reference was returned. Refresh the list.')
  return (data as { id: string }).id
}

export async function updateMenuItem(
  id: string,
  input: NormalizedMenuItem & { isActive?: boolean },
): Promise<void> {
  const row: Record<string, unknown> = {
    code: input.code,
    name: input.name,
    category_id: input.categoryId,
    selling_price: input.sellingPrice,
    recipe_id: input.recipeId,
  }
  if (input.isActive !== undefined) row.is_active = input.isActive

  const { error } = await requireSupabase().from('menu_items').update(row).eq('id', id)

  if (error) throw new Error(describeMenuDbError(error))
}
