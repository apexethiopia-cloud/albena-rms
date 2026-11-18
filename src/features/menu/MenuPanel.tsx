import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCw,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import { formatCurrency } from '@/lib/format'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import { listRecipes, type Recipe } from '@/features/recipes/api'
import {
  createMenuItem,
  listMenuCategories,
  listMenuItems,
  updateMenuItem,
  type MenuCategory,
  type MenuItem,
} from './api'
import { validateMenuItem, type MenuItemDraft } from './validation'

function number(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function emptyForm(categoryId = ''): MenuItemDraft {
  return { code: '', name: '', categoryId, sellingPrice: '', recipeId: '' }
}

export function MenuPanel() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Mirrors can_manage_menu(): System Administrator, General Manager, Restaurant Manager.
  const canManage = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'restaurant_manager')
    : false

  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [mode, setMode] = useState<'closed' | 'create' | 'edit'>('closed')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<MenuItemDraft>(() => emptyForm())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([listMenuItems(), listMenuCategories(), listRecipes()])
      .then(([nextItems, nextCategories, nextRecipes]) => {
        if (cancelled) return
        setItems(nextItems)
        setCategories(nextCategories)
        setRecipes(nextRecipes)
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

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active),
    [categories],
  )
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )
  const recipeById = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, recipe])),
    [recipes],
  )

  const openCreate = () => {
    setMode('create')
    setEditingId(null)
    setForm(emptyForm(activeCategories[0]?.id ?? ''))
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
  }

  const openEdit = (item: MenuItem) => {
    setMode('edit')
    setEditingId(item.id)
    setForm({
      code: item.code,
      name: item.name,
      categoryId: item.category_id ?? '',
      sellingPrice: String(number(item.selling_price)),
      recipeId: item.recipe_id ?? '',
    })
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
  }

  const closeForm = () => {
    setMode('closed')
    setEditingId(null)
    setFieldErrors({})
    setFormError(null)
  }

  const setField = (key: keyof MenuItemDraft) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const result = validateMenuItem(
      form,
      activeCategories.map((category) => category.id),
    )
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)
    setNotice(null)

    try {
      if (mode === 'edit' && editingId) {
        await updateMenuItem(editingId, result.value)
        setNotice(`${result.value.code} was updated.`)
      } else {
        await createMenuItem(result.value)
        setNotice(`${result.value.code} was added to the menu.`)
      }
      closeForm()
      reload()
    } catch (error) {
      setFormError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (item: MenuItem) => {
    setBusyId(item.id)
    setActionError(null)
    setNotice(null)

    try {
      await updateMenuItem(item.id, {
        code: item.code,
        name: item.name,
        categoryId: item.category_id ?? '',
        sellingPrice: number(item.selling_price),
        recipeId: item.recipe_id,
        isActive: !item.is_active,
      })
      setNotice(
        item.is_active
          ? `${item.code} was deactivated. It stays on historical orders.`
          : `${item.code} is active again.`,
      )
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const recipeLabel = (item: MenuItem) => {
    if (item.recipes) return `${item.recipes.code} · ${item.recipes.name}`
    const recipe = item.recipe_id ? recipeById.get(item.recipe_id) : undefined
    return recipe ? `${recipe.code} · ${recipe.name}` : '—'
  }

  return (
    <section aria-labelledby="menu-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="menu-heading"
              className="flex items-center gap-2 text-base font-semibold text-slate-900"
            >
              <UtensilsCrossed className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Menu
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Menu prices include VAT (15%). Order lines copy the item name and price, so editing or
              deactivating a menu item never changes a historical order or receipt.
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
                New menu item
              </button>
            )}
          </div>
        </div>

        {!canManage && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Read-only: the menu is managed by the System Administrator, General Manager and
            Restaurant Manager.
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

      {mode !== 'closed' && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              {mode === 'edit' ? 'Edit menu item' : 'New menu item'}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close menu form"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Menu code</span>
              <input
                aria-label="Menu code"
                value={form.code}
                onChange={(event) => setField('code')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.code && <span className="mt-1 block text-red-600">{fieldErrors.code}</span>}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Menu name</span>
              <input
                aria-label="Menu name"
                value={form.name}
                onChange={(event) => setField('name')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.name && <span className="mt-1 block text-red-600">{fieldErrors.name}</span>}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Category</span>
              <select
                aria-label="Menu category"
                value={form.categoryId}
                onChange={(event) => setField('categoryId')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">Choose a category</option>
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {fieldErrors.categoryId && (
                <span className="mt-1 block text-red-600">{fieldErrors.categoryId}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Selling price (ETB, VAT included)</span>
              <input
                aria-label="Selling price (ETB, VAT included)"
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
              <span className="mb-1 block font-medium">Linked recipe (optional)</span>
              <select
                aria-label="Linked recipe (optional)"
                value={form.recipeId}
                onChange={(event) => setField('recipeId')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">No recipe link</option>
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.code} · {recipe.name}
                  </option>
                ))}
              </select>
            </label>
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
              {mode === 'edit' ? 'Save changes' : 'Save menu item'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {loadError ? (
          <div className="flex items-start gap-2 p-5 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4" aria-hidden="true" />
            <div>
              <p>{loadError}</p>
              <button
                type="button"
                onClick={reload}
                className="mt-2 rounded-md border border-red-200 px-2 py-1 text-xs font-medium hover:bg-red-50"
              >
                Try again
              </button>
            </div>
          </div>
        ) : loading ? (
          <p className="flex items-center gap-2 p-5 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading menu…
          </p>
        ) : items.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            No menu items yet. Create the first one to start taking orders.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Item</th>
                  <th scope="col" className="px-5 py-3 font-medium">Category</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Price</th>
                  <th scope="col" className="px-5 py-3 font-medium">Recipe</th>
                  <th scope="col" className="px-5 py-3 font-medium">Status</th>
                  {canManage && (
                    <th scope="col" className="px-5 py-3 text-right font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className={cn(!item.is_active && 'bg-slate-50/60')}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.code}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {item.menu_categories?.name ??
                        (item.category_id ? categoryById.get(item.category_id)?.name : null) ??
                        '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-700">
                      {formatCurrency(number(item.selling_price))}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{recipeLabel(item)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          item.is_active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(item)}
                          disabled={busyId === item.id}
                          className="ml-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                        >
                          {item.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
