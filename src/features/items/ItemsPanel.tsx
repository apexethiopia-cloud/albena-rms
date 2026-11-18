import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
import {
  createItem,
  createItemUnitConversion,
  listCategories,
  listItemUnitConversions,
  listItems,
  listUnits,
  updateItem,
  updateItemUnitConversion,
  type Category,
  type Item,
  type Unit,
} from './api'
import { validateItem, type ItemInput } from './validation'

type FormMode = { kind: 'create' } | { kind: 'edit'; item: Item }

const EMPTY: ItemInput = {
  code: '',
  name: '',
  categoryId: '',
  baseUnitId: '',
  purchaseUnitId: '',
  reorderLevel: '0',
}

function fromItem(item: Item): ItemInput {
  return {
    code: item.code,
    name: item.name,
    categoryId: item.category_id ?? '',
    baseUnitId: item.base_unit_id,
    purchaseUnitId: item.purchase_unit_id ?? '',
    reorderLevel: String(item.reorder_level),
  }
}

function number(value: number | string): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return String(value)
  return parsed.toLocaleString('en-ET', { maximumFractionDigits: 6 })
}

export function ItemsPanel() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Mirrors `items_write` in migration 0003. The database is the boundary (ADR-003).
  const canManage = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'purchasing_officer') ||
      hasRole(user.roles, 'storekeeper') ||
      hasRole(user.roles, 'executive_chef')
    : false

  const [items, setItems] = useState<Item[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [conversions, setConversions] = useState<
    Array<{ item_id: string; unit_id: string; base_factor: number }>
  >([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [mode, setMode] = useState<FormMode | null>(null)
  const [form, setForm] = useState<ItemInput>(EMPTY)
  const [factor, setFactor] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([listItems(), listUnits(), listCategories(), listItemUnitConversions()])
      .then(([itemRows, unitRows, categoryRows, conversionRows]) => {
        if (cancelled) return
        setItems(itemRows)
        setUnits(unitRows)
        setCategories(categoryRows)
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

  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units])
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )
  const baseUnits = useMemo(() => units.filter((unit) => unit.is_base), [units])
  const purchaseUnits = useMemo(() => units.filter((unit) => !unit.is_base), [units])
  const conversionByItemUnit = useMemo(
    () =>
      new Map(
        conversions.map(
          (conversion) => [
            `${conversion.item_id}:${conversion.unit_id}`,
            conversion.base_factor,
          ] as [string, number],
        ),
      ),
    [conversions],
  )

  const reload = () => setReloadToken((token) => token + 1)

  const setField = (key: keyof ItemInput) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const closeForm = () => {
    setMode(null)
    setFieldErrors({})
    setFormError(null)
  }

  const openCreate = () => {
    setMode({ kind: 'create' })
    setForm({ ...EMPTY, baseUnitId: baseUnits[0]?.id ?? '' })
    setFactor('')
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
  }

  const openEdit = (item: Item) => {
    setMode({ kind: 'edit', item })
    setForm(fromItem(item))
    setFactor(
      item.purchase_unit_id
        ? String(conversionByItemUnit.get(`${item.id}:${item.purchase_unit_id}`) ?? '')
        : '',
    )
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!mode) return

    const result = validateItem(form)
    setFieldErrors(result.errors)
    if (!result.valid) return

    const purchaseUnitId = form.purchaseUnitId || ''
    const purchaseUnit = purchaseUnitId ? unitById.get(purchaseUnitId) : undefined
    const needsConversion =
      !!purchaseUnitId && !!purchaseUnit && purchaseUnit.base_factor === null

    if (needsConversion) {
      const parsedFactor = Number(factor)
      if (!factor.trim() || !Number.isFinite(parsedFactor) || parsedFactor <= 0) {
        setFieldErrors((current) => ({
          ...current,
          purchaseUnit: 'Enter how many base units one purchase unit contains for this item.',
        }))
        return
      }
    }

    setSaving(true)
    setFormError(null)

    try {
      let itemId: string | null = null
      if (mode.kind === 'create') {
        itemId = await createItem(result.normalized)
        if (needsConversion) {
          await createItemUnitConversion(itemId, purchaseUnitId, Number(factor))
        }
        setNotice(`Item ${result.normalized.code} created.`)
      } else {
        await updateItem(mode.item.id, result.normalized)
        if (needsConversion) {
          await updateItemUnitConversion(mode.item.id, purchaseUnitId, Number(factor))
        }
        setNotice(`Item ${result.normalized.code} updated.`)
      }
      closeForm()
      reload()
    } catch (error) {
      setFormError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (item: Item) => {
    setPendingId(item.id)
    setActionError(null)
    setNotice(null)

    try {
      await updateItem(item.id, { is_active: !item.is_active })
      setNotice(
        `${item.code} ${item.is_active ? 'deactivated' : 'reactivated'}. ${
          item.is_active
            ? 'Ledger history and recipe references are kept.'
            : 'It can be selected on new documents again.'
        }`,
      )
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setPendingId(null)
    }
  }

  const activeCount = items.filter((item) => item.is_active).length
  const selectedPurchaseUnit = form.purchaseUnitId ? unitById.get(form.purchaseUnitId) : undefined
  const needsConversion = selectedPurchaseUnit ? selectedPurchaseUnit.base_factor === null : false

  return (
    <section aria-labelledby="items-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="items-heading" className="text-base font-semibold text-slate-900">
              Items
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Item master data. Stock is always stored in the base unit — gram, millilitre or piece
              (ADR-010). Balances are not stored here; they come from posted stock transactions.
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New item
            </button>
          )}
        </div>

        {!canManage && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              Read-only. Changing items requires a management, purchasing, stores or chef role, and
              the database rejects the write without it.
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
          aria-labelledby="item-form-heading"
          className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 id="item-form-heading" className="text-sm font-semibold text-slate-900">
              {mode.kind === 'create' ? 'New item' : `Edit ${mode.item.code}`}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close item form"
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
              <label htmlFor="item-code" className="block text-sm font-medium text-slate-700">
                Code
              </label>
              <input
                id="item-code"
                value={form.code}
                onChange={(event) => setField('code')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.code)}
                aria-describedby={fieldErrors.code ? 'item-code-error' : 'item-code-hint'}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm uppercase shadow-sm focus:border-brand-500',
                  fieldErrors.code ? 'border-red-400' : 'border-slate-300',
                )}
                placeholder="e.g. TOMATO"
                autoComplete="off"
              />
              <p id="item-code-hint" className="mt-1 text-xs text-slate-500">
                2–20 characters: letters, digits, hyphen or underscore.
              </p>
              {fieldErrors.code && (
                <p id="item-code-error" className="mt-1 text-xs text-red-700">
                  {fieldErrors.code}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="item-name" className="block text-sm font-medium text-slate-700">
                Item name
              </label>
              <input
                id="item-name"
                value={form.name}
                onChange={(event) => setField('name')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.name)}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.name ? 'border-red-400' : 'border-slate-300',
                )}
                placeholder="e.g. Tomato, fresh"
                autoComplete="off"
              />
              {fieldErrors.name && <p className="mt-1 text-xs text-red-700">{fieldErrors.name}</p>}
            </div>

            <div>
              <label htmlFor="item-category" className="block text-sm font-medium text-slate-700">
                Category
              </label>
              <select
                id="item-category"
                value={form.categoryId}
                onChange={(event) => setField('categoryId')(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500"
              >
                <option value="">Uncategorised</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="item-base-unit" className="block text-sm font-medium text-slate-700">
                Base unit
              </label>
              <select
                id="item-base-unit"
                value={form.baseUnitId}
                onChange={(event) => setField('baseUnitId')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.baseUnitId)}
                className={cn(
                  'mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.baseUnitId ? 'border-red-400' : 'border-slate-300',
                )}
              >
                <option value="">Choose a base unit</option>
                {baseUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.code})
                  </option>
                ))}
              </select>
              {fieldErrors.baseUnitId && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.baseUnitId}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="item-purchase-unit"
                className="block text-sm font-medium text-slate-700"
              >
                Purchase unit
              </label>
              <select
                id="item-purchase-unit"
                value={form.purchaseUnitId}
                onChange={(event) => {
                  setField('purchaseUnitId')(event.target.value)
                  setFactor(event.target.value ? '' : '')
                }}
                aria-invalid={Boolean(fieldErrors.purchaseUnit)}
                aria-describedby={fieldErrors.purchaseUnit ? 'item-purchase-unit-error' : undefined}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500"
              >
                <option value="">Same as base unit</option>
                {purchaseUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.code})
                    {unit.base_factor === null ? ' — factor per item' : ''}
                  </option>
                ))}
              </select>
              {needsConversion && (
                <p className="mt-1 text-xs text-amber-700">
                  {selectedPurchaseUnit?.name} has no universal size. A per-item factor is required
                  before this unit can be received.
                </p>
              )}
              {needsConversion && (
                <div className="mt-2">
                  <label
                    htmlFor="item-purchase-factor"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Purchase unit factor
                  </label>
                  <input
                    id="item-purchase-factor"
                    inputMode="decimal"
                    value={factor}
                    onChange={(event) => setFactor(event.target.value)}
                    aria-invalid={Boolean(fieldErrors.purchaseUnit)}
                    aria-describedby={fieldErrors.purchaseUnit ? 'item-purchase-unit-error' : undefined}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 sm:max-w-56"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    How many base units (g / ml / piece) one {selectedPurchaseUnit?.name} contains
                    for this item.
                  </p>
                  {fieldErrors.purchaseUnit && (
                    <p id="item-purchase-unit-error" className="mt-1 text-xs text-red-700">
                      {fieldErrors.purchaseUnit}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="item-reorder-level"
                className="block text-sm font-medium text-slate-700"
              >
                Reorder level
              </label>
              <input
                id="item-reorder-level"
                inputMode="decimal"
                value={form.reorderLevel}
                onChange={(event) => setField('reorderLevel')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.reorderLevel)}
                aria-describedby="item-reorder-hint"
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.reorderLevel ? 'border-red-400' : 'border-slate-300',
                )}
              />
              <p id="item-reorder-hint" className="mt-1 text-xs text-slate-500">
                In the base unit. Use 0 when no alert is needed.
              </p>
              {fieldErrors.reorderLevel && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.reorderLevel}</p>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {mode.kind === 'create' ? 'Create item' : 'Save changes'}
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {items.length} item{items.length === 1 ? '' : 's'} · {activeCount} active
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

        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading items…
          </div>
        ) : loadError ? (
          <div role="alert" className="px-5 py-8 text-center">
            <AlertCircle className="mx-auto h-5 w-5 text-red-500" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-900">Could not load items</p>
            <p className="mt-1 text-sm text-slate-600">{loadError}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No items yet. {canManage ? 'Create the first one.' : 'Ask an administrator.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <caption className="sr-only">Inventory item master</caption>
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Code
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Item
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Category
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Base unit
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Reorder
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
                {items.map((item) => {
                  const baseUnit = unitById.get(item.base_unit_id)
                  const category = item.category_id ? categoryById.get(item.category_id) : undefined

                  return (
                    <tr key={item.id} className={cn(!item.is_active && 'bg-slate-50/60')}>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs font-semibold text-slate-700">
                        {item.code}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-900">{item.name}</td>
                      <td className="px-5 py-3 text-slate-600">{category?.name ?? '—'}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                        {baseUnit ? `${baseUnit.name} (${baseUnit.code})` : '—'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                        {number(item.reorder_level)}
                        {baseUnit ? ` ${baseUnit.code}` : ''}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            item.is_active
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-200 text-slate-600',
                          )}
                        >
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                        {formatDate(item.updated_at)}
                      </td>
                      {canManage && (
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void toggleActive(item)}
                              disabled={pendingId === item.id}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                            >
                              {pendingId === item.id && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              )}
                              {item.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
