import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import { createCategory, listCategories, updateCategory, type Category } from './api'
import { validateCategory } from './validation'
type FormMode = { kind: 'create' } | { kind: 'edit'; category: Category }

export function CategoriesPanel() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Mirrors `item_categories_write` in migration 0003. The database is the boundary (ADR-003).
  const canManage = user
    ? hasRole(user.roles, 'system_admin') || hasRole(user.roles, 'general_manager')
    : false

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [mode, setMode] = useState<FormMode | null>(null)
  const [name, setName] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    listCategories()
      .then((rows) => {
        if (!cancelled) setCategories(rows)
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

  const closeForm = () => {
    setMode(null)
    setName('')
    setSortOrder('0')
    setFieldErrors({})
    setFormError(null)
  }

  const openCreate = () => {
    setMode({ kind: 'create' })
    setName('')
    setSortOrder('0')
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
  }

  const openEdit = (category: Category) => {
    setMode({ kind: 'edit', category })
    setName(category.name)
    setSortOrder(String(category.sort_order))
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!mode) return

    const result = validateCategory({ name, sortOrder })
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)

    try {
      if (mode.kind === 'create') {
        await createCategory(result.normalized)
        setNotice(`Category ${result.normalized.name} created.`)
      } else {
        await updateCategory(mode.category.id, result.normalized)
        setNotice(`Category ${result.normalized.name} updated.`)
      }
      closeForm()
      reload()
    } catch (error) {
      setFormError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (category: Category) => {
    setPendingId(category.id)
    setActionError(null)
    setNotice(null)

    try {
      await updateCategory(category.id, { is_active: !category.is_active })
      setNotice(
        `${category.name} ${category.is_active ? 'deactivated' : 'reactivated'}. ${
          category.is_active
            ? 'Item references keep their history.'
            : 'The category can be selected again.'
        }`,
      )
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
        setPendingId(null)
      }
  }

  const activeCount = categories.filter((category) => category.is_active).length

  const inputClass = (error?: string) =>
    cn(
      'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
      error ? 'border-red-400' : 'border-slate-300',
    )

  return (
    <section aria-labelledby="categories-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="categories-heading" className="text-base font-semibold text-slate-900">
              Item categories
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Categories used to group items on reports and cost calculations. Deactivated categories
              stay readable for history.
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-obsidian transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New category
            </button>
          )}
        </div>

        {!canManage && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              Read-only. Changing item categories requires the System Administrator or General
              Manager role, and the database rejects the write without it.
            </span>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}

        {actionError && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{actionError}</span>
          </div>
        )}
      </div>

      {mode && (
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-labelledby="category-form-heading"
          className="rounded-xl border border-brand-200 bg-surface p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 id="category-form-heading" className="text-sm font-semibold text-slate-900">
              {mode.kind === 'create' ? 'New category' : `Edit ${mode.category.name}`}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close category form"
              className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {formError && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {formError}
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="category-name" className="block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                id="category-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'category-name-error' : undefined}
                className={inputClass(fieldErrors.name)}
                placeholder="e.g. Meat"
                autoComplete="off"
              />
              {fieldErrors.name && (
                <p id="category-name-error" className="mt-1 text-xs text-red-700">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="category-sort-order" className="block text-sm font-medium text-slate-700">
                Sort order
              </label>
              <input
                id="category-sort-order"
                inputMode="numeric"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                aria-invalid={Boolean(fieldErrors.sortOrder)}
                className={inputClass(fieldErrors.sortOrder)}
              />
              {fieldErrors.sortOrder && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.sortOrder}</p>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-obsidian transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {mode.kind === 'create' ? 'Create category' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} · {activeCount} active
          </p>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <RotateCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
            Refresh
          </button>
        </div>

        {loading && categories.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading categories…
          </div>
        ) : loadError ? (
          <div role="alert" className="px-5 py-8 text-center">
            <AlertCircle className="mx-auto h-5 w-5 text-red-500" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-900">Could not load categories</p>
            <p className="mt-1 text-sm text-slate-600">{loadError}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Try again
            </button>
          </div>
        ) : categories.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No categories yet. {canManage ? 'Create the first one.' : 'Ask an administrator.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <caption className="sr-only">Item categories</caption>
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Sort order
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Updated
                  </th>
                  {canManage && (
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((category) => (
                  <tr key={category.id} className={cn(!category.is_active && 'bg-slate-50/60')}>
                    <td className="px-5 py-3 font-medium text-slate-900">{category.name}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{category.sort_order}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          category.is_active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-200 text-slate-600',
                        )}
                      >
                        {category.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                      {formatDate(category.updated_at)}
                    </td>
                    {canManage && (
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(category)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(category)}
                            disabled={pendingId === category.id}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                          >
                            {pendingId === category.id && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            )}
                            {category.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
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
