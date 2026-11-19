import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import { formatCurrency, formatDate, formatDateTime, formatQuantity, toIsoDate } from '@/lib/format'
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
  createSiv,
  deleteSiv,
  listSivs,
  listStockBalances,
  postSiv,
  updateSiv,
  type Numberish,
  type Siv,
  type StockBalance,
} from './api'
import {
  previewLine,
  validateSiv,
  type SivDraft,
  type StockContext,
  type StockLineDraft,
} from './validation'

function number(value: Numberish): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function emptyLine(key: number): StockLineDraft {
  return { key: `siv-line-${key}`, itemId: '', quantity: '', unitId: '', unitCost: '' }
}

function initialForm(sourceLocationId: string, destinationLocationId: string): SivDraft {
  return {
    issueDate: toIsoDate(new Date()),
    sourceLocationId,
    destinationLocationId,
    notes: '',
    lines: [emptyLine(1)],
  }
}

export function SivPanel() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Mirrors can_post_siv() in migration 0005. The database is the boundary.
  const canPost = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'storekeeper')
    : false

  const [documents, setDocuments] = useState<Siv[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [conversions, setConversions] = useState<
    Array<{ item_id: string; unit_id: string; base_factor: number }>
  >([])
  const [locations, setLocations] = useState<StockLocation[]>([])
  const [balances, setBalances] = useState<StockBalance[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SivDraft>(() => initialForm('', ''))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmPostId, setConfirmPostId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const lineSequence = useRef(1)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([
      listSivs(),
      listItems(),
      listUnits(),
      listItemUnitConversions(),
      listLocations(),
      listStockBalances(),
    ])
      .then(([sivRows, itemRows, unitRows, conversionRows, locationRows, balanceRows]) => {
        if (cancelled) return
        setDocuments(sivRows)
        setItems(itemRows)
        setUnits(unitRows)
        setConversions(conversionRows)
        setLocations(locationRows)
        setBalances(balanceRows)
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
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  )
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units])
  const balanceByItemLocation = useMemo(
    () =>
      new Map(
        balances.map((balance) => [
          `${balance.item_id}:${balance.location_id}`,
          number(balance.quantity),
        ]),
      ),
    [balances],
  )

  const context: StockContext = useMemo(
    () => ({ items, units, conversions }),
    [items, units, conversions],
  )

  const unitsForItem = useCallback(
    (itemId: string): Unit[] => {
      if (!itemId) return []
      return units.filter(
        (unit) =>
          previewLine(
            { key: 'probe', itemId, quantity: '1', unitId: unit.id, unitCost: '1' },
            context,
          ).factor !== null,
      )
    },
    [units, context],
  )

  const openCreate = () => {
    lineSequence.current = 1
    setEditingId(null)
    setForm(
      initialForm(activeLocations[0]?.id ?? '', activeLocations[1]?.id ?? activeLocations[0]?.id ?? ''),
    )
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
    setFormOpen(true)
  }

  const openEdit = (document: Siv) => {
    lineSequence.current = Math.max(document.siv_lines.length, 1)
    setEditingId(document.id)
    setForm({
      issueDate: document.issue_date,
      sourceLocationId: document.source_location_id,
      destinationLocationId: document.destination_location_id,
      notes: document.notes ?? '',
      lines: document.siv_lines.map((line, index) => ({
        key: `siv-edit-${index + 1}`,
        itemId: line.item_id,
        unitId: line.unit_id,
        quantity: String(line.quantity),
        unitCost: '',
      })),
    })
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingId(null)
    setFieldErrors({})
    setFormError(null)
  }

  const setField = (key: keyof SivDraft) => (value: string) => {
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

    const result = validateSiv(form, context)
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)
    setNotice(null)

    try {
      if (editingId) {
        await updateSiv(editingId, result.value)
        setNotice('SIV draft updated. Post it to move stock.')
      } else {
        await createSiv(result.value)
        setNotice('SIV saved as a draft. Post it to move stock.')
      }
      closeForm()
      reload()
    } catch (error) {
      setFormError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (document: Siv) => {
    setPendingId(document.id)
    setActionError(null)
    setNotice(null)

    try {
      await deleteSiv(document.id)
      setNotice(`SIV ${document.siv_number} deleted.`)
      setConfirmDeleteId(null)
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setPendingId(null)
    }
  }

  const post = async (document: Siv) => {
    setPendingId(document.id)
    setActionError(null)
    setNotice(null)

    try {
      await postSiv(document.id)
      setNotice(
        `SIV ${document.siv_number} posted. FIFO cost moved from source to destination.`,
      )
      setConfirmPostId(null)
      setConfirmDeleteId(null)
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section aria-labelledby="siv-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="siv-heading" className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Send className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Store issue vouchers and transfers
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              A SIV moves stock from a source location to a destination location. Posting consumes
              the oldest FIFO layers at source and creates matching layers at destination. Negative
              stock is rejected. Approval steps are not implemented because the owner has not
              defined the OD-06 thresholds.
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
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-obsidian transition hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New SIV
              </button>
            )}
          </div>
        </div>

        {!canPost && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              Read-only. Creating and posting issue vouchers requires a System Administrator,
              General Manager or Storekeeper role, and the database rejects the write without it.
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
          aria-labelledby="siv-form-heading"
          className="rounded-xl border border-brand-200 bg-surface p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="siv-form-heading" className="text-sm font-semibold text-slate-900">
                {editingId ? 'Edit store issue voucher' : 'New store issue voucher'}
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Stock must already exist at the source. Posting is rejected if any line would make
                the source balance negative.
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close SIV form"
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
              <p className="block text-sm font-medium text-slate-700">SIV number</p>
              <p className="mt-1 text-xs text-slate-500">
                Number assigned automatically when saved.
              </p>
            </div>

            <div>
              <label htmlFor="siv-date" className="block text-sm font-medium text-slate-700">
                Issue date
              </label>
              <input
                id="siv-date"
                type="date"
                value={form.issueDate}
                onChange={(event) => setField('issueDate')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.issueDate)}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.issueDate ? 'border-red-400' : 'border-slate-300',
                )}
              />
              {fieldErrors.issueDate && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.issueDate}</p>
              )}
            </div>

            <div>
              <label htmlFor="siv-source" className="block text-sm font-medium text-slate-700">
                Source location
              </label>
              <select
                id="siv-source"
                value={form.sourceLocationId}
                onChange={(event) => setField('sourceLocationId')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.sourceLocationId)}
                className={cn(
                  'mt-1 w-full rounded-lg border bg-surface px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.sourceLocationId ? 'border-red-400' : 'border-slate-300',
                )}
              >
                <option value="">Select source…</option>
                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.code})
                  </option>
                ))}
              </select>
              {fieldErrors.sourceLocationId && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.sourceLocationId}</p>
              )}
            </div>

            <div>
              <label htmlFor="siv-destination" className="block text-sm font-medium text-slate-700">
                Destination location
              </label>
              <select
                id="siv-destination"
                value={form.destinationLocationId}
                onChange={(event) => setField('destinationLocationId')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.destinationLocationId)}
                className={cn(
                  'mt-1 w-full rounded-lg border bg-surface px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.destinationLocationId ? 'border-red-400' : 'border-slate-300',
                )}
              >
                <option value="">Select destination…</option>
                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.code})
                  </option>
                ))}
              </select>
              {fieldErrors.destinationLocationId && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.destinationLocationId}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="siv-notes" className="block text-sm font-medium text-slate-700">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="siv-notes"
                value={form.notes}
                onChange={(event) => setField('notes')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.notes)}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.notes ? 'border-red-400' : 'border-slate-300',
                )}
                placeholder="Department, requisition reference or comment"
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
                    <th scope="col" className="py-2 pr-2 font-medium">Base quantity</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Available at source</th>
                    <th scope="col" className="py-2 font-medium">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 align-top">
                  {form.lines.map((line, index) => {
                    const preview = previewLine(line, context)
                    const availableUnits = unitsForItem(line.itemId)
                    const item = itemById.get(line.itemId)
                    const available = item
                      ? balanceByItemLocation.get(
                          `${item.id}:${form.sourceLocationId}`,
                        ) ?? 0
                      : null
                    const insufficient =
                      preview.baseQuantity !== null &&
                      available !== null &&
                      preview.baseQuantity > available

                    return (
                      <tr key={line.key}>
                        <td className="py-2 pr-2">
                          <select
                            aria-label={`Item for SIV line ${index + 1}`}
                            value={line.itemId}
                            onChange={(event) => selectItem(index, event.target.value)}
                            className="w-full min-w-[10rem] rounded-lg border border-slate-300 bg-surface px-2 py-1.5 text-sm shadow-sm focus:border-brand-500"
                          >
                            <option value="">Select item…</option>
                            {activeItems.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.name} ({candidate.code})
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
                            aria-label={`Quantity for SIV line ${index + 1}`}
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
                            aria-label={`Unit for SIV line ${index + 1}`}
                            value={line.unitId}
                            onChange={(event) => setLine(index, { unitId: event.target.value })}
                            className="w-28 rounded-lg border border-slate-300 bg-surface px-2 py-1.5 text-sm shadow-sm focus:border-brand-500"
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
                        <td className="whitespace-nowrap py-2 pr-2 text-xs text-slate-600">
                          {preview.baseQuantity === null
                            ? '—'
                            : `${formatQuantity(preview.baseQuantity)} ${unitById.get(item?.base_unit_id ?? '')?.code ?? ''}`}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-2 text-xs">
                          {available === null ? (
                            <span className="text-slate-500">Select an item</span>
                          ) : (
                            <span className={insufficient ? 'font-medium text-red-700' : 'text-slate-600'}>
                              {formatQuantity(available)}{' '}
                              {unitById.get(item?.base_unit_id ?? '')?.code ?? ''}
                              {insufficient && ' · not enough'}
                            </span>
                          )}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            aria-label={`Remove SIV line ${index + 1}`}
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

            <p className="mt-3 text-xs text-slate-600">
              Available quantities are shown for guidance. The database rechecks them and rejects a
              posting that would create negative stock.
            </p>
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
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-obsidian transition hover:bg-brand-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save draft
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {documents.length} document{documents.length === 1 ? '' : 's'} ·{' '}
            {documents.filter((document) => document.posted_at === null).length} draft
          </p>
        </div>

        {loading && documents.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading issue vouchers…
          </div>
        ) : loadError ? (
          <div role="alert" className="px-5 py-8 text-center">
            <AlertCircle className="mx-auto h-5 w-5 text-red-500" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-900">Could not load issue vouchers</p>
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
            No issue vouchers yet. A SIV can only move stock that a GRN or adjustment has already
            posted.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {documents.map((document) => {
              const total = document.siv_lines.reduce(
                (sum, line) => sum + number(line.posted_cost ?? 0),
                0,
              )
              const isPosted = document.posted_at !== null
              const busy = pendingId === document.id

              return (
                <article key={document.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{document.siv_number}</p>
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
                      <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-slate-600">
                        <span>{locationById.get(document.source_location_id)?.name ?? 'Unknown'}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        <span>
                          {locationById.get(document.destination_location_id)?.name ?? 'Unknown'}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Issued {formatDate(document.issue_date)}
                        {isPosted && document.posted_at
                          ? ` · Posted ${formatDateTime(document.posted_at)}`
                          : ' · Not yet posted'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isPosted && (
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(total)}
                        </p>
                      )}
                      {canPost && !isPosted && (
                        <>
                          {confirmDeleteId === document.id ? (
                            <>
                              <span className="text-xs text-slate-600">Delete this draft?</span>
                              <button
                                type="button"
                                onClick={() => void remove(document)}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-obsidian transition hover:bg-red-700 disabled:opacity-60"
                              >
                                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                                Confirm delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={busy}
                                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(document)}
                                aria-label={`Edit SIV ${document.siv_number}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDeleteId(document.id)
                                  setConfirmPostId(null)
                                }}
                                aria-label={`Delete SIV ${document.siv_number}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Delete
                              </button>
                            </>
                          )}
                          {confirmPostId === document.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void post(document)}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-obsidian transition hover:bg-amber-700 disabled:opacity-60"
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
                              onClick={() => {
                                setConfirmPostId(document.id)
                                setConfirmDeleteId(null)
                              }}
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
                      View {document.siv_lines.length} line
                      {document.siv_lines.length === 1 ? '' : 's'}
                    </summary>
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="text-left uppercase tracking-wide text-slate-500">
                          <tr>
                            <th scope="col" className="py-1 pr-3 font-medium">Item</th>
                            <th scope="col" className="py-1 pr-3 text-right font-medium">Quantity</th>
                            <th scope="col" className="py-1 pr-3 font-medium">Unit</th>
                            <th scope="col" className="py-1 pr-3 text-right font-medium">Base quantity</th>
                            <th scope="col" className="py-1 text-right font-medium">FIFO cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {document.siv_lines.map((line) => (
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
                                {line.base_quantity === null
                                  ? '—'
                                  : number(line.base_quantity)}
                              </td>
                              <td className="py-1.5 text-right tabular-nums">
                                {line.posted_cost === null
                                  ? '—'
                                  : formatCurrency(number(line.posted_cost))}
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
