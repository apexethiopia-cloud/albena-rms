import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  PackageCheck,
  Plus,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import { formatCurrency, formatDate, formatDateTime, toIsoDate } from '@/lib/format'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import {
  listItemUnitConversions,
  listItems,
  listUnits,
  type Item,
  type Unit,
} from '@/features/items/api'
import { listLocations, type StockLocation } from '@/features/locations/api'
import { listSuppliers, type Supplier } from '@/features/suppliers/api'
import {
  createGrn,
  listGrns,
  postGrn,
  type Grn,
  type Numberish,
} from './api'
import {
  previewLine,
  validateGrn,
  type GrnDraft,
  type StockContext,
  type StockLineDraft,
} from './validation'

function number(value: Numberish): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function emptyLine(key: number): StockLineDraft {
  return { key: `grn-line-${key}`, itemId: '', quantity: '', unitId: '', unitCost: '' }
}

function initialForm(locationId: string): GrnDraft {
  return {
    grnNumber: '',
    supplierId: '',
    invoiceNumber: '',
    receivedDate: toIsoDate(new Date()),
    locationId,
    notes: '',
    lines: [emptyLine(1)],
  }
}

export function GrnPanel() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Mirrors can_post_grn() in migration 0005. The database is the boundary.
  const canPost = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'purchasing_officer') ||
      hasRole(user.roles, 'storekeeper')
    : false

  const [documents, setDocuments] = useState<Grn[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [conversions, setConversions] = useState<
    Array<{ item_id: string; unit_id: string; base_factor: number }>
  >([])
  const [locations, setLocations] = useState<StockLocation[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<GrnDraft>(() => initialForm(''))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmPostId, setConfirmPostId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const lineSequence = useRef(1)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([
      listGrns(),
      listSuppliers(),
      listItems(),
      listUnits(),
      listItemUnitConversions(),
      listLocations(),
    ])
      .then(([grnRows, supplierRows, itemRows, unitRows, conversionRows, locationRows]) => {
        if (cancelled) return
        setDocuments(grnRows)
        setSuppliers(supplierRows)
        setItems(itemRows)
        setUnits(unitRows)
        setConversions(conversionRows)
        setLocations(locationRows)
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

  const activeSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.is_active),
    [suppliers],
  )
  const activeItems = useMemo(() => items.filter((item) => item.is_active), [items])
  const activeLocations = useMemo(
    () => locations.filter((location) => location.is_active),
    [locations],
  )
  const supplierById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers],
  )
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  )
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units])

  const context: StockContext = useMemo(
    () => ({ items, units, conversions }),
    [items, units, conversions],
  )

  const unitsForItem = useCallback(
    (itemId: string): Unit[] => {
      if (!itemId) return []
      return units.filter((unit) => previewLine(
        { key: 'probe', itemId, quantity: '1', unitId: unit.id, unitCost: '1' },
        context,
      ).factor !== null)
    },
    [units, context],
  )

  const openCreate = () => {
    lineSequence.current = 1
    setForm(initialForm(activeLocations[0]?.id ?? ''))
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setFieldErrors({})
    setFormError(null)
  }

  const setField = (key: keyof GrnDraft) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const setLine = (index: number, patch: Partial<StockLineDraft>) => {
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

  const selectItem = (index: number, itemId: string) => {
    const item = itemById.get(itemId)
    setLine(index, { itemId, unitId: item?.base_unit_id ?? '' })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const result = validateGrn(form, context)
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)
    setNotice(null)

    try {
      await createGrn(result.value)
      setNotice(`GRN ${result.value.grnNumber} saved as a draft. Post it to move stock.`)
      closeForm()
      reload()
    } catch (error) {
      setFormError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const post = async (document: Grn) => {
    setPendingId(document.id)
    setActionError(null)
    setNotice(null)

    try {
      await postGrn(document.id)
      setNotice(`GRN ${document.grn_number} posted. The stock ledger now contains its layers.`)
      setConfirmPostId(null)
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setPendingId(null)
    }
  }

  const formTotal = form.lines.reduce((sum, line) => {
    const preview = previewLine(line, context)
    return sum + (preview.lineTotal ?? 0)
  }, 0)

  return (
    <section aria-labelledby="grn-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="grn-heading" className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <PackageCheck className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Goods receiving notes
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Record a delivery, then post it once. Posting increases the selected location and
              creates one FIFO cost layer per line (ADR-009). Approval steps are not implemented
              because the owner has not defined the OD-06 thresholds.
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
            {canPost && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New GRN
              </button>
            )}
          </div>
        </div>

        {!canPost && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              Read-only. Creating and posting receiving notes requires a System Administrator,
              General Manager, Purchasing Officer or Storekeeper role, and the database rejects the
              write without it.
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

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-labelledby="grn-form-heading"
          className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="grn-form-heading" className="text-sm font-semibold text-slate-900">
                New goods receiving note
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Quantities are entered in the selected unit. The database converts them to the item
                base unit when the draft is saved.
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close GRN form"
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

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="grn-number" className="block text-sm font-medium text-slate-700">
                GRN number
              </label>
              <input
                id="grn-number"
                value={form.grnNumber}
                onChange={(event) => setField('grnNumber')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.grnNumber)}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm uppercase shadow-sm focus:border-brand-500',
                  fieldErrors.grnNumber ? 'border-red-400' : 'border-slate-300',
                )}
                placeholder="e.g. GRN-0001"
                autoComplete="off"
              />
              {fieldErrors.grnNumber && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.grnNumber}</p>
              )}
            </div>

            <div>
              <label htmlFor="grn-supplier" className="block text-sm font-medium text-slate-700">
                Supplier
              </label>
              <select
                id="grn-supplier"
                value={form.supplierId}
                onChange={(event) => setField('supplierId')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.supplierId)}
                className={cn(
                  'mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.supplierId ? 'border-red-400' : 'border-slate-300',
                )}
              >
                <option value="">Select supplier…</option>
                {activeSuppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} ({supplier.code})
                  </option>
                ))}
              </select>
              {fieldErrors.supplierId && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.supplierId}</p>
              )}
            </div>

            <div>
              <label htmlFor="grn-invoice" className="block text-sm font-medium text-slate-700">
                Supplier invoice
              </label>
              <input
                id="grn-invoice"
                value={form.invoiceNumber}
                onChange={(event) => setField('invoiceNumber')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.invoiceNumber)}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.invoiceNumber ? 'border-red-400' : 'border-slate-300',
                )}
                placeholder="Invoice number"
                autoComplete="off"
              />
              {fieldErrors.invoiceNumber && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.invoiceNumber}</p>
              )}
            </div>

            <div>
              <label htmlFor="grn-date" className="block text-sm font-medium text-slate-700">
                Received date
              </label>
              <input
                id="grn-date"
                type="date"
                value={form.receivedDate}
                onChange={(event) => setField('receivedDate')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.receivedDate)}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.receivedDate ? 'border-red-400' : 'border-slate-300',
                )}
              />
              {fieldErrors.receivedDate && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.receivedDate}</p>
              )}
            </div>

            <div>
              <label htmlFor="grn-location" className="block text-sm font-medium text-slate-700">
                Receiving location
              </label>
              <select
                id="grn-location"
                value={form.locationId}
                onChange={(event) => setField('locationId')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.locationId)}
                className={cn(
                  'mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.locationId ? 'border-red-400' : 'border-slate-300',
                )}
              >
                <option value="">Select location…</option>
                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.code})
                  </option>
                ))}
              </select>
              {fieldErrors.locationId && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.locationId}</p>
              )}
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="grn-notes" className="block text-sm font-medium text-slate-700">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="grn-notes"
                value={form.notes}
                onChange={(event) => setField('notes')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.notes)}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.notes ? 'border-red-400' : 'border-slate-300',
                )}
                placeholder="Delivery note reference or comment"
                autoComplete="off"
              />
              {fieldErrors.notes && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.notes}</p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-slate-900">Lines</h4>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add line
              </button>
            </div>
            {fieldErrors.lines && <p className="mt-1 text-xs text-red-700">{fieldErrors.lines}</p>}

            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="py-2 pr-2 font-medium">Item</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Quantity</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Unit</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Unit cost</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Base quantity</th>
                    <th scope="col" className="py-2 pr-2 text-right font-medium">Line total</th>
                    <th scope="col" className="py-2 font-medium">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 align-top">
                  {form.lines.map((line, index) => {
                    const preview = previewLine(line, context)
                    const availableUnits = unitsForItem(line.itemId)

                    return (
                      <tr key={line.key}>
                        <td className="py-2 pr-2">
                          <select
                            aria-label={`Item for line ${index + 1}`}
                            value={line.itemId}
                            onChange={(event) => selectItem(index, event.target.value)}
                            className="w-full min-w-[10rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-brand-500"
                          >
                            <option value="">Select item…</option>
                            {activeItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.code})
                              </option>
                            ))}
                          </select>
                          {fieldErrors[`line-${index}-item`] && (
                            <p className="mt-1 text-xs text-red-700">
                              {fieldErrors[`line-${index}-item`]}
                            </p>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            aria-label={`Quantity for line ${index + 1}`}
                            value={line.quantity}
                            onChange={(event) => setLine(index, { quantity: event.target.value })}
                            inputMode="decimal"
                            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-brand-500"
                            placeholder="0"
                          />
                          {fieldErrors[`line-${index}-quantity`] && (
                            <p className="mt-1 text-xs text-red-700">
                              {fieldErrors[`line-${index}-quantity`]}
                            </p>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            aria-label={`Unit for line ${index + 1}`}
                            value={line.unitId}
                            onChange={(event) => setLine(index, { unitId: event.target.value })}
                            className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-brand-500"
                          >
                            <option value="">Select…</option>
                            {availableUnits.map((unit) => (
                              <option key={unit.id} value={unit.id}>
                                {unit.name} ({unit.code})
                              </option>
                            ))}
                          </select>
                          {fieldErrors[`line-${index}-unit`] && (
                            <p className="mt-1 max-w-[14rem] text-xs text-red-700">
                              {fieldErrors[`line-${index}-unit`]}
                            </p>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            aria-label={`Unit cost for line ${index + 1}`}
                            value={line.unitCost}
                            onChange={(event) => setLine(index, { unitCost: event.target.value })}
                            inputMode="decimal"
                            className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-brand-500"
                            placeholder="0.00"
                          />
                          {fieldErrors[`line-${index}-cost`] && (
                            <p className="mt-1 text-xs text-red-700">
                              {fieldErrors[`line-${index}-cost`]}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-2 text-xs text-slate-600">
                          {preview.baseQuantity === null
                            ? '—'
                            : `${preview.baseQuantity.toLocaleString('en-ET', {
                                maximumFractionDigits: 6,
                              })} ${itemById.get(line.itemId) ? unitById.get(itemById.get(line.itemId)!.base_unit_id)?.code ?? '' : ''}`}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-2 text-right tabular-nums text-slate-700">
                          {preview.lineTotal === null ? '—' : formatCurrency(preview.lineTotal)}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            aria-label={`Remove line ${index + 1}`}
                            className="rounded-md p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-600">
                The ledger stores base units; the document keeps the unit you entered.
              </p>
              <p className="text-sm font-semibold text-slate-900">
                Total {formatCurrency(formTotal)}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save draft
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {documents.length} document{documents.length === 1 ? '' : 's'} ·{' '}
            {documents.filter((document) => document.posted_at === null).length} draft
          </p>
        </div>

        {loading && documents.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading receiving notes…
          </div>
        ) : loadError ? (
          <div role="alert" className="px-5 py-8 text-center">
            <AlertCircle className="mx-auto h-5 w-5 text-red-500" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-900">Could not load receiving notes</p>
            <p className="mt-1 text-sm text-slate-600">{loadError}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Try again
            </button>
          </div>
        ) : documents.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No receiving notes yet. Create one to record a delivery.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {documents.map((document) => {
              const total = document.grn_lines.reduce(
                (sum, line) => sum + number(line.line_total),
                0,
              )
              const isPosted = document.posted_at !== null
              const busy = pendingId === document.id

              return (
                <article key={document.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{document.grn_number}</p>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            isPosted
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-800',
                          )}
                        >
                          {isPosted ? 'Posted' : 'Draft'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {supplierById.get(document.supplier_id)?.name ?? 'Unknown supplier'} ·{' '}
                        Invoice {document.invoice_number} ·{' '}
                        {locationById.get(document.location_id)?.name ?? 'Unknown location'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Received {formatDate(document.received_date)}
                        {isPosted && document.posted_at
                          ? ` · Posted ${formatDateTime(document.posted_at)}`
                          : ' · Not yet posted'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCurrency(total)}
                      </p>
                      {canPost && !isPosted && (
                        <>
                          {confirmPostId === document.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void post(document)}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
                              >
                                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                                Confirm post
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmPostId(null)}
                                disabled={busy}
                                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmPostId(document.id)}
                              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              Post
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900">
                      View {document.grn_lines.length} line
                      {document.grn_lines.length === 1 ? '' : 's'}
                    </summary>
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="text-left uppercase tracking-wide text-slate-500">
                          <tr>
                            <th scope="col" className="py-1 pr-3 font-medium">Item</th>
                            <th scope="col" className="py-1 pr-3 text-right font-medium">Quantity</th>
                            <th scope="col" className="py-1 pr-3 font-medium">Unit</th>
                            <th scope="col" className="py-1 pr-3 text-right font-medium">Unit cost</th>
                            <th scope="col" className="py-1 pr-3 text-right font-medium">Base quantity</th>
                            <th scope="col" className="py-1 text-right font-medium">Line total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {document.grn_lines.map((line) => (
                            <tr key={line.id}>
                              <td className="py-1.5 pr-3">
                                {itemById.get(line.item_id)?.name ?? line.item_id}
                              </td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">
                                {number(line.quantity)}
                              </td>
                              <td className="py-1.5 pr-3">
                                {unitById.get(line.unit_id)?.code ?? line.unit_id}
                              </td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">
                                {formatCurrency(number(line.unit_cost))}
                              </td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">
                                {line.base_quantity === null
                                  ? '—'
                                  : number(line.base_quantity)}
                              </td>
                              <td className="py-1.5 text-right tabular-nums">
                                {formatCurrency(number(line.line_total))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
