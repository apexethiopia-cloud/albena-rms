import { requireSupabase } from '@/lib/supabase'
import {
  describeRecipeDbError,
  type NormalizedRecipe,
  type NormalizedRecipeVersion,
} from './validation'

export type Numberish = number | string

export type RecipeVersionStatus = 'draft' | 'published' | 'archived'

export type RecipeVersionLine = {
  id: string
  version_id: string
  item_id: string
  unit_id: string
  quantity: Numberish
  base_quantity: Numberish
  sort_order: number
}

export type RecipeVersion = {
  id: string
  recipe_id: string
  version_number: number
  status: RecipeVersionStatus
  yield_quantity: Numberish
  selling_price: Numberish
  notes: string | null
  effective_from: string | null
  created_at: string
  published_at: string | null
  recipe_version_lines: RecipeVersionLine[]
}

export type Recipe = {
  id: string
  code: string
  name: string
  menu_item_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
  recipe_versions: RecipeVersion[]
}

export type RecipeCost = {
  version_id: string
  recipe_id: string
  recipe_code: string
  recipe_name: string
  menu_item_name: string | null
  version_number: number
  status: RecipeVersionStatus
  yield_quantity: Numberish
  selling_price: Numberish
  effective_from: string | null
  total_cost: Numberish
  cost_per_portion: Numberish
  gross_profit: Numberish
  food_cost_pct: Numberish | null
  lines_without_cost: number
}

const RECIPE_COLUMNS = `
  id, code, name, menu_item_name, notes, created_at, updated_at,
  recipe_versions (
    id, recipe_id, version_number, status, yield_quantity, selling_price, notes,
    effective_from, created_at, published_at,
    recipe_version_lines (id, version_id, item_id, unit_id, quantity, base_quantity, sort_order)
  )
`

export async function listRecipes(): Promise<Recipe[]> {
  const { data, error } = await requireSupabase()
    .from('recipes')
    .select(RECIPE_COLUMNS)
    .order('code', { ascending: true })

  if (error) throw new Error(describeRecipeDbError(error))

  const recipes = (data ?? []) as unknown as Recipe[]
  return recipes.map((recipe) => ({
    ...recipe,
    recipe_versions: [...recipe.recipe_versions].sort(
      (a, b) => b.version_number - a.version_number,
    ),
  }))
}

export async function listRecipeCosts(): Promise<RecipeCost[]> {
  const { data, error } = await requireSupabase()
    .from('recipe_version_costs')
    .select(
      `version_id, recipe_id, recipe_code, recipe_name, menu_item_name,
       version_number, status, yield_quantity, selling_price, effective_from,
       total_cost, cost_per_portion, gross_profit, food_cost_pct, lines_without_cost`,
    )
    .order('recipe_code', { ascending: true })
    .order('version_number', { ascending: false })

  if (error) throw new Error(describeRecipeDbError(error))
  return (data ?? []) as unknown as RecipeCost[]
}

export async function createRecipe(input: NormalizedRecipe): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_recipe', {
    p_name: input.name,
    p_menu_item_name: input.menuItemName,
    p_notes: input.notes,
    p_yield_quantity: input.yieldQuantity,
    p_selling_price: input.sellingPrice,
    p_lines: input.lines.map((line) => ({
      item_id: line.itemId,
      unit_id: line.unitId,
      quantity: line.quantity,
    })),
  })

  if (error) throw new Error(describeRecipeDbError(error))
  if (!data) throw new Error('The recipe was saved but no reference was returned. Refresh the list.')
  return data as string
}

export async function createRecipeVersion(
  recipeId: string,
  input: NormalizedRecipeVersion,
): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_recipe_version', {
    p_recipe_id: recipeId,
    p_notes: input.notes,
    p_yield_quantity: input.yieldQuantity,
    p_selling_price: input.sellingPrice,
    p_lines: input.lines.map((line) => ({
      item_id: line.itemId,
      unit_id: line.unitId,
      quantity: line.quantity,
    })),
  })

  if (error) throw new Error(describeRecipeDbError(error))
  if (!data) {
    throw new Error('The version was saved but no reference was returned. Refresh the list.')
  }
  return data as string
}

export async function updateRecipe(
  recipeId: string,
  input: { name: string; menuItemName: string; notes: string },
): Promise<void> {
  const { error } = await requireSupabase().rpc('update_recipe', {
    p_recipe_id: recipeId,
    p_name: input.name,
    p_menu_item_name: input.menuItemName,
    p_notes: input.notes,
  })

  if (error) throw new Error(describeRecipeDbError(error))
}

export async function publishRecipeVersion(versionId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('publish_recipe_version', {
    p_version_id: versionId,
  })

  if (error) throw new Error(describeRecipeDbError(error))
}
