import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Factory,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import { formatCurrency, formatDate, formatQuantity, toIsoDate } from '@/lib/format'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import {
  listItemUnitConversions,
  listItems,
  listUnits,
  type Item,
  type Unit,
} from '@/features/items/api'
import { listLocations, type StockLocation } from '@/features/locations/api'
import {
  createProductionOrder,
  deleteProductionOrder,
  listProductionOrders,
  postProductionOrder,
  updateProductionOrder,
  type ProductionOrder,
} from './api'
import {
  validateProduction,
  type ProductionDraft,
  type ProductionInputDraft,
} from './validation'

function number(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function emptyInput(key: number): ProductionInputDraft {
  return { key: `production-input-${key}`, itemId: '', unitId: '', quantity: '' }
}

function initialForm(locationId: string, responsibleName: string): ProductionDraft {
  return {
    productionDate: toIsoDate(new Date()),
    locationId,
    outputItemId: '',
    outputUnitId: '',
    outputQuantity: '',
    expectedOutputQuantity: '',
    responsibleName,
    notes: '',
    inputs: [emptyInput(1)],
  }
}

export function ProductionPanel() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Mirrors can_manage_production(): System Administrator, General Manager, Executive Chef.
  const canManage = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'executive_chef')
    : false

  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [locations, setLocations] = useState<StockLocation[]>([])
  const [conversions, setConversions] = useState<
    Array<{ item_id: string; unit_id: string; base_factor: number }>
  >([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductionDraft>(() => initialForm('', ''))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [confirmPostId, setConfirmPostId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [postingId, setPostingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const inputSequence = useRef(1)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([
      listProductionOrders(),
      listItems(),
      listUnits(),
      listLocations(),
      listItemUnitConversions(),
    ])
      .then(([orderRows, itemRows, unitRows, locationRows, conversionRows]) => {
        if (cancelled) return
        setOrders(orderRows)
        setItems(itemRows)
        setUnits(unitRows)
        setLocations(locationRows)
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
  const activeLocations = useMemo(
    () => locations.filter((location) => location.is_active),
    [locations],
  )
  const context = useMemo(
    () => ({ items, units, conversions }),
    [items, units, conversions],
  )
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units])
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  )

  const openCreate = () => {
    inputSequence.current = 1
    setEditingOrderId(null)
    setForm(initialForm(activeLocations[0]?.id ?? '', user?.fullName ?? ''))
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
    setFormOpen(true)
  }

  const openEdit = (order: ProductionOrder) => {
    inputSequence.current = order.production_inputs.length
    setEditingOrderId(order.id)
    setForm({
      productionDate: order.production_date,
      locationId: order.location_id,
      outputItemId: order.output_item_id,
      outputUnitId: order.output_unit_id,
      outputQuantity: String(number(order.output_quantity)),
      expectedOutputQuantity:
        order.expected_output_quantity == null
          ? ''
          : String(number(order.expected_output_quantity)),
      responsibleName: order.responsible_name,
      notes: order.notes ?? '',
      inputs:
        order.production_inputs.length > 0
          ? order.production_inputs.map((line, index) => ({
              key: `production-input-${index + 1}`,
              itemId: line.item_id,
              unitId: line.unit_id,
              quantity: String(number(line.quantity)),
            }))
          : [emptyInput(1)],
    })
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
    setConfirmPostId(null)
    setConfirmDeleteId(null)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingOrderId(null)
    setFieldErrors({})
    setFormError(null)
  }

  const setField = (
    key:
      | 'productionDate'
      | 'locationId'
      | 'outputItemId'
      | 'outputUnitId'
      | 'outputQuantity'
      | 'expectedOutputQuantity'
      | 'responsibleName'
      | 'notes',
  ) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const setInput = (index: number, patch: Partial<ProductionInputDraft>) => {
    setForm((current) => ({
      ...current,
      inputs: current.inputs.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }))
  }

  const addInput = () => {
    inputSequence.current += 1
    setForm((current) => ({
      ...current,
      inputs: [...current.inputs, emptyInput(inputSequence.current)],
    }))
  }

  const removeInput = (index: number) => {
    setForm((current) => ({
      ...current,
      inputs: current.inputs.filter((_, lineIndex) => lineIndex !== index),
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const result = validateProduction(form, context)
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)
    setNotice(null)

    try {
      if (editingOrderId) {
        await updateProductionOrder(editingOrderId, result.value)
        setNotice('Production order updated.')
      } else {
        await createProductionOrder(result.value)
        setNotice('Production order saved as a draft.')
      }
      closeForm()
      reload()
    } catch (error) {
      setFormError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handlePost = async (order: ProductionOrder) => {
    setPostingId(order.id)
    setActionError(null)
    setNotice(null)

    try {
      await postProductionOrder(order.id)
      setNotice(`Production order ${order.order_number} posted to the stock ledger.`)
      setConfirmPostId(null)
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setPostingId(null)
    }
  }

  const handleDelete = async (order: ProductionOrder) => {
    setDeletingId(order.id)
    setActionError(null)
    setNotice(null)

    try {
      await deleteProductionOrder(order.id)
      setNotice(`Production order ${order.order_number} deleted.`)
      setConfirmDeleteId(null)
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setDeletingId(null)
    }
  }

  const unitOptionsFor = (itemId: string) => {
    const item = itemById.get(itemId)
    const baseUnit = item ? unitById.get(item.base_unit_id) : undefined
    return item
      ? units.filter(
          (unit) =>
            unit.dimension === baseUnit?.dimension ||
            conversions.some(
              (conversion) =>
                conversion.item_id === item.id && conversion.unit_id === unit.id,
            ),
        )
      : units
  }

  return (
    <section aria-labelledby="production-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="production-heading"
              className="flex items-center gap-2 text-base font-semibold text-slate-900"
            >
              <Factory className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Production
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Record inputs and the actual output of a production run. Posting consumes input
              layers FIFO and creates the output layer in one transaction (PROD-03). Drafts do not
              move stock.
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
                New production
              </button>
            )}
          </div>
        </div>

        {!canManage && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Read-only: production is recorded by the System Administrator, General Manager and
            Executive Chef.
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

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              {editingOrderId ? 'Edit production order' : 'New production order'}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close production form"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Number assigned automatically when saved.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Production date</span>
              <input
                aria-label="Production date"
                type="date"
                value={form.productionDate}
                onChange={(event) => setField('productionDate')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.productionDate && (
                <span className="mt-1 block text-red-600">{fieldErrors.productionDate}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Location</span>
              <select
                aria-label="Location"
                value={form.locationId}
                onChange={(event) => setField('locationId')(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">Choose a location</option>
                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code} — {location.name}
                  </option>
                ))}
              </select>
              {fieldErrors.locationId && (
                <span className="mt-1 block text-red-600">{fieldErrors.locationId}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Responsible user</span>
              <input
                aria-label="Responsible user"
                value={form.responsibleName}
                onChange={(event) => setField('responsibleName')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.responsibleName && (
                <span className="mt-1 block text-red-600">{fieldErrors.responsibleName}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Output item</span>
              <select
                aria-label="Output item"
                value={form.outputItemId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    outputItemId: event.target.value,
                    outputUnitId: '',
                  }))
                }
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">Choose the output item</option>
                {activeItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.name}
                  </option>
                ))}
              </select>
              {fieldErrors.outputItemId && (
                <span className="mt-1 block text-red-600">{fieldErrors.outputItemId}</span>
              )}
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-600">
                <span className="mb-1 block font-medium">Output quantity</span>
                <input
                  aria-label="Output quantity"
                  value={form.outputQuantity}
                  onChange={(event) => setField('outputQuantity')(event.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-slate-600">
                <span className="mb-1 block font-medium">Output unit</span>
                <select
                  aria-label="Output unit"
                  value={form.outputUnitId}
                  onChange={(event) => setField('outputUnitId')(event.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">Unit</option>
                  {unitOptionsFor(form.outputItemId).map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.code}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Expected output (same unit, optional)</span>
              <input
                aria-label="Expected output"
                value={form.expectedOutputQuantity}
                onChange={(event) => setField('expectedOutputQuantity')(event.target.value)}
                inputMode="decimal"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.expectedOutputQuantity && (
                <span className="mt-1 block text-red-600">{fieldErrors.expectedOutputQuantity}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Notes (optional)</span>
              <input
                aria-label="Production notes"
                value={form.notes}
                onChange={(event) => setField('notes')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          {fieldErrors.outputQuantity && (
            <p className="text-xs text-red-600">{fieldErrors.outputQuantity}</p>
          )}
          {fieldErrors.outputUnitId && (
            <p className="text-xs text-red-600">{fieldErrors.outputUnitId}</p>
          )}

          <div>
            <p className="mb-2 text-sm font-medium text-slate-800">Inputs consumed</p>
            <div className="space-y-2">
              {form.inputs.map((line, index) => (
                <div
                  key={line.key}
                  className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-12"
                >
                  <label className="text-xs text-slate-600 sm:col-span-5">
                    <span className="mb-1 block font-medium">Input item {index + 1}</span>
                    <select
                      aria-label={`Input item ${index + 1}`}
                      value={line.itemId}
                      onChange={(event) =>
                        setInput(index, { itemId: event.target.value, unitId: '' })
                      }
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="">Choose an input</option>
                      {activeItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} — {item.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs text-slate-600 sm:col-span-2">
                    <span className="mb-1 block font-medium">Quantity</span>
                    <input
                      aria-label={`Quantity for input ${index + 1}`}
                      value={line.quantity}
                      onChange={(event) => setInput(index, { quantity: event.target.value })}
                      inputMode="decimal"
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </label>

                  <label className="text-xs text-slate-600 sm:col-span-3">
                    <span className="mb-1 block font-medium">Unit</span>
                    <select
                      aria-label={`Unit for input ${index + 1}`}
                      value={line.unitId}
                      onChange={(event) => setInput(index, { unitId: event.target.value })}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="">Choose a unit</option>
                      {unitOptionsFor(line.itemId).map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.code}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex items-end justify-end sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => removeInput(index)}
                      aria-label={`Remove input ${index + 1}`}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {fieldErrors.inputs && <p className="mt-1 text-xs text-red-600">{fieldErrors.inputs}</p>}
            <button
              type="button"
              onClick={addInput}
              className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add input
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
              {editingOrderId ? 'Save changes' : 'Save draft'}
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

      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading production orders…
        </div>
      ) : loadError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-6 text-center shadow-sm"
        >
          <AlertCircle className="mx-auto h-5 w-5 text-red-500" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-slate-900">Could not load production</p>
          <p className="mt-1 text-sm text-slate-700">{loadError}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Try again
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900">No production orders yet</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">
            Record the inputs and output of a production run. Stock only moves when the draft is
            posted.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <caption className="sr-only">Production history and posting state</caption>
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Production</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Output</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Yield %</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Location</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Responsible</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => {
                  const outputItem = itemById.get(order.output_item_id)
                  const outputUnit = unitById.get(order.output_unit_id)
                  const location = locationById.get(order.location_id)
                  const inputCost = order.production_inputs.reduce(
                    (total, line) => total + number(line.posted_cost),
                    0,
                  )

                  return (
                    <tr key={order.id}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{order.order_number}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatDate(order.production_date)} ·{' '}
                          {order.production_inputs.length} input
                          {order.production_inputs.length === 1 ? '' : 's'}
                          {inputCost > 0 ? ` · ${formatCurrency(inputCost)} consumed` : ''}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-slate-700">
                        {outputItem?.name ?? 'Unknown item'}
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {formatQuantity(number(order.output_quantity))} {outputUnit?.code ?? ''}{' '}
                          ({formatQuantity(number(order.output_base_quantity))} base)
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-700">
                        {order.yield_percentage != null
                          ? `${formatQuantity(number(order.yield_percentage))}%`
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-slate-700">{location?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-700">{order.responsible_name}</td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            order.status === 'posted'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-800',
                          )}
                        >
                          {order.status === 'posted' ? 'Posted' : 'Draft'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        {canManage && order.status === 'draft' ? (
                          confirmPostId === order.id ? (
                            <span className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handlePost(order)}
                                disabled={postingId === order.id}
                                className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                              >
                                {postingId === order.id && (
                                  <Loader2
                                    className="h-3.5 w-3.5 animate-spin"
                                    aria-hidden="true"
                                  />
                                )}
                                Confirm post
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmPostId(null)}
                                className="rounded-md px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : confirmDeleteId === order.id ? (
                            <span className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleDelete(order)}
                                disabled={deletingId === order.id}
                                className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                              >
                                {deletingId === order.id && (
                                  <Loader2
                                    className="h-3.5 w-3.5 animate-spin"
                                    aria-hidden="true"
                                  />
                                )}
                                Confirm delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-md px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDeleteId(null)
                                  setConfirmPostId(order.id)
                                }}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Post
                              </button>
                              <button
                                type="button"
                                onClick={() => openEdit(order)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmPostId(null)
                                  setConfirmDeleteId(order.id)
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Delete
                              </button>
                            </span>
                          )
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
        </div>
      )}
    </section>
  )
}
