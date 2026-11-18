import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import { formatCurrency, formatDate, formatQuantity, formatUnitCost } from '@/lib/format'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import {
  listItemUnitConversions,
  listItems,
  listUnits,
  type Item,
  type Unit,
} from '@/features/items/api'
import {
  createRecipe,
  createRecipeVersion,
  listRecipeCosts,
  listRecipes,
  publishRecipeVersion,
  type Recipe,
  type RecipeCost,
  type RecipeVersion,
  type RecipeVersionStatus,
} from './api'
import {
  validateRecipe,
  validateRecipeVersion,
  type RecipeDraft,
  type RecipeLineDraft,
  type RecipeVersionDraft,
} from './validation'

const STATUS_LABELS: Record<RecipeVersionStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
}

const STATUS_CLASSES: Record<RecipeVersionStatus, string> = {
  draft: 'bg-amber-50 text-amber-800',
  published: 'bg-emerald-50 text-emerald-700',
  archived: 'bg-slate-100 text-slate-600',
}

function number(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function emptyLine(key: number): RecipeLineDraft {
  return { key: `recipe-line-${key}`, itemId: '', unitId: '', quantity: '' }
}

function initialForm(): RecipeDraft {
  return {
    code: '',
    name: '',
    menuItemName: '',
    notes: '',
    yieldQuantity: '1',
    sellingPrice: '',
    lines: [emptyLine(1)],
  }
}

export function RecipesPanel() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Mirrors can_manage_recipes(): System Administrator, General Manager, Executive Chef.
  const canManage = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'executive_chef')
    : false

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [costs, setCosts] = useState<RecipeCost[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [conversions, setConversions] = useState<
    Array<{ item_id: string; unit_id: string; base_factor: number }>
  >([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [mode, setMode] = useState<'closed' | 'create' | 'version'>('closed')
  const [versionRecipe, setVersionRecipe] = useState<Recipe | null>(null)
  const [form, setForm] = useState<RecipeDraft>(() => initialForm())
  const [versionForm, setVersionForm] = useState<RecipeVersionDraft>({
    notes: '',
    yieldQuantity: '1',
    sellingPrice: '',
    lines: [emptyLine(1)],
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const lineSequence = useRef(1)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([
      listRecipes(),
      listRecipeCosts(),
      listItems(),
      listUnits(),
      listItemUnitConversions(),
    ])
      .then(([recipeRows, costRows, itemRows, unitRows, conversionRows]) => {
        if (cancelled) return
        setRecipes(recipeRows)
        setCosts(costRows)
        setItems(itemRows)
        setUnits(unitRows)
        setConversions(conversionRows)
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(toMessage(error))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const activeItems = useMemo(() => items.filter((item) => item.is_active), [items])
  const context = useMemo(
    () => ({ items, units, conversions }),
    [items, units, conversions],
  )
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units])
  const costByVersion = useMemo(
    () => new Map(costs.map((cost) => [cost.version_id, cost])),
    [costs],
  )

  const closeForm = () => {
    setMode('closed')
    setVersionRecipe(null)
    setFieldErrors({})
    setFormError(null)
  }

  const openCreate = () => {
    lineSequence.current = 1
    setForm(initialForm())
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
    setMode('create')
  }

  const openVersion = (recipe: Recipe) => {
    const latest = recipe.recipe_versions[0]
    lineSequence.current = latest?.recipe_version_lines.length ?? 1
    setVersionRecipe(recipe)
    setVersionForm({
      notes: '',
      yieldQuantity: String(latest ? number(latest.yield_quantity) : 1),
      sellingPrice: latest ? String(number(latest.selling_price)) : '',
      lines:
        latest && latest.recipe_version_lines.length > 0
          ? latest.recipe_version_lines.map((line) => ({
              key: `recipe-line-${line.id}`,
              itemId: line.item_id,
              unitId: line.unit_id,
              quantity: String(number(line.quantity)),
            }))
          : [emptyLine(1)],
    })
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
    setMode('version')
  }

  const setField = (
    key: 'code' | 'name' | 'menuItemName' | 'notes' | 'yieldQuantity' | 'sellingPrice',
  ) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const setLine = (index: number, patch: Partial<RecipeLineDraft>) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }))
  }

  const addLine = () => {
    lineSequence.current += 1
    setForm((current) => ({
      ...current,
      lines: [...current.lines, emptyLine(lineSequence.current)],
    }))
  }

  const removeLine = (index: number) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.filter((_, lineIndex) => lineIndex !== index),
    }))
  }

  const setVersionLine = (index: number, patch: Partial<RecipeLineDraft>) => {
    setVersionForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }))
  }

  const addVersionLine = () => {
    lineSequence.current += 1
    setVersionForm((current) => ({
      ...current,
      lines: [...current.lines, emptyLine(lineSequence.current)],
    }))
  }

  const removeVersionLine = (index: number) => {
    setVersionForm((current) => ({
      ...current,
      lines: current.lines.filter((_, lineIndex) => lineIndex !== index),
    }))
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const result = validateRecipe(form, context)
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)
    setNotice(null)

    try {
      await createRecipe(result.value)
      setNotice(`Recipe ${result.value.code} saved as a draft version.`)
      closeForm()
      reload()
    } catch (error) {
      setFormError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handleVersion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!versionRecipe) return

    const result = validateRecipeVersion(versionForm, context)
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)
    setNotice(null)

    try {
      await createRecipeVersion(versionRecipe.id, result.value)
      setNotice(`A new draft version of ${versionRecipe.code} was saved.`)
      closeForm()
      reload()
    } catch (error) {
      setFormError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async (version: RecipeVersion, recipeCode: string) => {
    setPublishingId(version.id)
    setActionError(null)
    setNotice(null)

    try {
      await publishRecipeVersion(version.id)
      setNotice(`${recipeCode} version ${version.version_number} is now published.`)
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setPublishingId(null)
    }
  }

  const renderLineEditor = (
    lines: RecipeLineDraft[],
    labelPrefix: string,
    onLine: (index: number, patch: Partial<RecipeLineDraft>) => void,
    onRemove: (index: number) => void,
  ) =>
    lines.map((line, index) => {
      const item = itemById.get(line.itemId)
      const baseUnit = item ? unitById.get(item.base_unit_id) : undefined
      const unitOptions = item
        ? units.filter(
            (unit) =>
              unit.dimension === baseUnit?.dimension ||
              conversions.some(
                (conversion) =>
                  conversion.item_id === item.id && conversion.unit_id === unit.id,
              ),
          )
        : units

      return (
        <div key={line.key} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-12">
          <label className="text-xs text-slate-600 sm:col-span-5">
            <span className="mb-1 block font-medium">Ingredient for {labelPrefix} line {index + 1}</span>
            <select
              aria-label={`Ingredient for ${labelPrefix} line ${index + 1}`}
              value={line.itemId}
              onChange={(event) => onLine(index, { itemId: event.target.value, unitId: '' })}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">Choose an ingredient</option>
              {activeItems.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.code} — {option.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-600 sm:col-span-2">
            <span className="mb-1 block font-medium">Quantity</span>
            <input
              aria-label={`Quantity for ${labelPrefix} line ${index + 1}`}
              value={line.quantity}
              onChange={(event) => onLine(index, { quantity: event.target.value })}
              inputMode="decimal"
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>

          <label className="text-xs text-slate-600 sm:col-span-3">
            <span className="mb-1 block font-medium">Unit</span>
            <select
              aria-label={`Unit for ${labelPrefix} line ${index + 1}`}
              value={line.unitId}
              onChange={(event) => onLine(index, { unitId: event.target.value })}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">Choose a unit</option>
              {unitOptions.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} — {unit.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end justify-end sm:col-span-2">
            <button
              type="button"
              onClick={() => onRemove(index)}
              aria-label={`Remove ${labelPrefix} line ${index + 1}`}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )
    })

  return (
    <section aria-labelledby="recipes-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="recipes-heading"
              className="flex items-center gap-2 text-base font-semibold text-slate-900"
            >
              <BookOpen className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Recipes
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Recipe versions keep their ingredients, yield and selling price. Cost uses the
              current weighted-average FIFO layer cost of each ingredient; no recipe ever deducts
              stock (REC-06).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
            >
              <RotateCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
              Refresh
            </button>
            {canManage && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New recipe
              </button>
            )}
          </div>
        </div>

        {!canManage && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Read-only: recipes and versions are managed by the System Administrator, General
            Manager and Executive Chef.
          </p>
        )}

        {notice && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {notice}
          </p>
        )}
        {actionError && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </p>
        )}
      </div>

      {mode === 'create' && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-semibold text-slate-900">New recipe</h3>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close recipe form"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Recipe code</span>
              <input
                aria-label="Recipe code"
                value={form.code}
                onChange={(event) => setField('code')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.code && <span className="mt-1 block text-red-600">{fieldErrors.code}</span>}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Recipe name</span>
              <input
                aria-label="Recipe name"
                value={form.name}
                onChange={(event) => setField('name')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.name && <span className="mt-1 block text-red-600">{fieldErrors.name}</span>}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Menu item (optional)</span>
              <input
                aria-label="Menu item"
                value={form.menuItemName}
                onChange={(event) => setField('menuItemName')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.menuItemName && (
                <span className="mt-1 block text-red-600">{fieldErrors.menuItemName}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Yield (portions)</span>
              <input
                aria-label="Yield (portions)"
                value={form.yieldQuantity}
                onChange={(event) => setField('yieldQuantity')(event.target.value)}
                inputMode="decimal"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.yieldQuantity && (
                <span className="mt-1 block text-red-600">{fieldErrors.yieldQuantity}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Selling price (ETB per portion)</span>
              <input
                aria-label="Selling price (ETB per portion)"
                value={form.sellingPrice}
                onChange={(event) => setField('sellingPrice')(event.target.value)}
                inputMode="decimal"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.sellingPrice && (
                <span className="mt-1 block text-red-600">{fieldErrors.sellingPrice}</span>
              )}
            </label>

            <label className="text-xs text-slate-600 sm:col-span-2">
              <span className="mb-1 block font-medium">Notes (optional)</span>
              <input
                aria-label="Recipe notes"
                value={form.notes}
                onChange={(event) => setField('notes')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.notes && (
                <span className="mt-1 block text-red-600">{fieldErrors.notes}</span>
              )}
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-800">Ingredients</p>
            <div className="space-y-2">
              {renderLineEditor(form.lines, 'recipe', setLine, removeLine)}
            </div>
            {fieldErrors.lines && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.lines}</p>
            )}
            <button
              type="button"
              onClick={addLine}
              className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add ingredient
            </button>
          </div>

          {formError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save draft
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === 'version' && versionRecipe && (
        <form
          onSubmit={handleVersion}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                New version of {versionRecipe.code}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Existing versions are kept; publishing the new draft archives the current
                published version.
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close version form"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Yield (portions)</span>
              <input
                aria-label="Yield (portions)"
                value={versionForm.yieldQuantity}
                onChange={(event) =>
                  setVersionForm((current) => ({ ...current, yieldQuantity: event.target.value }))
                }
                inputMode="decimal"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.yieldQuantity && (
                <span className="mt-1 block text-red-600">{fieldErrors.yieldQuantity}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Selling price (ETB per portion)</span>
              <input
                aria-label="Selling price (ETB per portion)"
                value={versionForm.sellingPrice}
                onChange={(event) =>
                  setVersionForm((current) => ({ ...current, sellingPrice: event.target.value }))
                }
                inputMode="decimal"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.sellingPrice && (
                <span className="mt-1 block text-red-600">{fieldErrors.sellingPrice}</span>
              )}
            </label>

            <label className="text-xs text-slate-600 sm:col-span-2">
              <span className="mb-1 block font-medium">Version notes (optional)</span>
              <input
                aria-label="Version notes"
                value={versionForm.notes}
                onChange={(event) =>
                  setVersionForm((current) => ({ ...current, notes: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-800">Ingredients</p>
            <div className="space-y-2">
              {renderLineEditor(
                versionForm.lines,
                'version',
                setVersionLine,
                removeVersionLine,
              )}
            </div>
            {fieldErrors.lines && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.lines}</p>
            )}
            <button
              type="button"
              onClick={addVersionLine}
              className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add ingredient
            </button>
          </div>

          {formError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save draft version
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && recipes.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading recipes…
        </div>
      ) : loadError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-6 text-center shadow-sm"
        >
          <AlertCircle className="mx-auto h-5 w-5 text-red-500" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-slate-900">Could not load recipes</p>
          <p className="mt-1 text-sm text-slate-700">{loadError}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Try again
          </button>
        </div>
      ) : recipes.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900">No recipes yet</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">
            Create a recipe to record ingredients, yield and selling price. Costing uses the
            current FIFO stock value.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{recipe.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {recipe.code}
                    {recipe.menu_item_name ? ` · ${recipe.menu_item_name}` : ''}
                  </p>
                  {recipe.notes && <p className="mt-1 text-xs text-slate-500">{recipe.notes}</p>}
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => openVersion(recipe)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    New version
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <caption className="sr-only">
                    Versions, costs and food cost percentage for {recipe.name}
                  </caption>
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-2.5 font-medium">Version</th>
                      <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-medium">Yield</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-medium">Price</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-medium">Cost / portion</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-medium">Gross profit</th>
                      <th scope="col" className="px-5 py-2.5 text-right font-medium">Food cost %</th>
                      <th scope="col" className="px-5 py-2.5 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recipe.recipe_versions.map((version) => {
                      const cost = costByVersion.get(version.id)
                      return (
                        <tr key={version.id}>
                          <td className="px-5 py-3 text-slate-700">
                            v{version.version_number}
                            {version.effective_from && (
                              <span className="mt-0.5 block text-xs text-slate-500">
                                from {formatDate(version.effective_from)}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3">
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                STATUS_CLASSES[version.status],
                              )}
                            >
                              {STATUS_LABELS[version.status]}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-700">
                            {formatQuantity(number(version.yield_quantity))}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-700">
                            {formatCurrency(number(version.selling_price))}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-700">
                            {cost ? formatUnitCost(number(cost.cost_per_portion)) : '—'}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-700">
                            {cost ? formatCurrency(number(cost.gross_profit)) : '—'}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-700">
                            {cost?.food_cost_pct != null
                              ? `${formatQuantity(number(cost.food_cost_pct))}%`
                              : '—'}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3">
                            {canManage && version.status === 'draft' ? (
                              <button
                                type="button"
                                onClick={() => void handlePublish(version, recipe.code)}
                                disabled={publishingId === version.id}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              >
                                {publishingId === version.id && (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                )}
                                Publish
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {recipe.recipe_versions.some(
                (version) => (costByVersion.get(version.id)?.lines_without_cost ?? 0) > 0,
              ) && (
                <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-amber-700">
                  Some ingredients have no remaining stock layers, so their cost is counted as
                  zero until stock is received.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
