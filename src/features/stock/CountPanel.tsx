import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Info,
  Loader2,
  Plus,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import { formatCurrency, formatDate, formatDateTime, formatQuantity, toIsoDate } from '@/lib/format'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import { listItems, listUnits, type Item, type Unit } from '@/features/items/api'
import { listLocations, type StockLocation } from '@/features/locations/api'
import {
  createInventoryCount,
  decideInventoryCount,
  listInventoryCounts,
  listStockBalances,
  postInventoryCount,
  submitInventoryCount,
  type InventoryCount,
  type InventoryDocumentStatus,
  type Numberish,
  type StockBalance,
} from './api'
import {
  validateInventoryCount,
  type CountDraft,
  type CountLineDraft,
} from './validation'

const STATUS_LABELS: Record<InventoryDocumentStatus, string> = {
  draft: 'Draft',
  submitted: 'Awaiting review',
  approved: 'Approved — not posted',
  rejected: 'Rejected',
  posted: 'Posted',
}

const STATUS_CLASSES: Record<InventoryDocumentStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-amber-50 text-amber-800',
  approved: 'bg-sky-50 text-sky-700',
  rejected: 'bg-red-50 text-red-700',
  posted: 'bg-emerald-50 text-emerald-700',
}

function number(value: Numberish | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function emptyLine(key: number): CountLineDraft {
  return { key: `count-line-${key}`, itemId: '', physicalQuantity: '' }
}

function initialForm(locationId: string, counterName: string): CountDraft {
  return {
    countNumber: '',
    countDate: toIsoDate(new Date()),
    locationId,
    counterName,
    notes: '',
    lines: [emptyLine(1)],
  }
}

export function CountPanel() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Mirrors can_manage_inventory() / can_approve_inventory() / can_post_inventory().
  const canManage = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'storekeeper')
    : false
  const canApprove = user
    ? hasRole(user.roles, 'system_admin') || hasRole(user.roles, 'general_manager')
    : false
  const canPost = canManage

  const [counts, setCounts] = useState<InventoryCount[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [locations, setLocations] = useState<StockLocation[]>([])
  const [balances, setBalances] = useState<StockBalance[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<CountDraft>(() => initialForm('', ''))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmPostId, setConfirmPostId] = useState<string | null>(null)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [decisionComment, setDecisionComment] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const lineSequence = useRef(1)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([
      listInventoryCounts(),
      listItems(),
      listUnits(),
      listLocations(),
      listStockBalances(),
    ])
      .then(([countRows, itemRows, unitRows, locationRows, balanceRows]) => {
        if (cancelled) return
        setCounts(countRows)
        setItems(itemRows)
        setUnits(unitRows)
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

  const openCreate = () => {
    lineSequence.current = 1
    setForm(initialForm(activeLocations[0]?.id ?? '', user?.fullName ?? ''))
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

  const setField = (key: 'countNumber' | 'countDate' | 'locationId' | 'counterName' | 'notes') =>
    (value: string) => {
      setForm((current) => ({ ...current, [key]: value }))
    }

  const setLine = (index: number, patch: Partial<CountLineDraft>) => {
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const result = validateInventoryCount(form, { items })
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)
    setNotice(null)

    try {
      await createInventoryCount(result.value)
      setNotice(
        `Count ${result.value.countNumber} saved as a draft. Submit it for review, then post the approved variance.`,
      )
      closeForm()
      reload()
    } catch (error) {
      setFormError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (id: string, action: () => Promise<void>, message: string) => {
    setPendingId(id)
    setActionError(null)
    setNotice(null)

    try {
      await action()
      setNotice(message)
      setConfirmPostId(null)
      setDecidingId(null)
      setDecisionComment('')
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section aria-labelledby="count-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="count-heading"
              className="flex items-center gap-2 text-base font-semibold text-slate-900"
            >
              <ClipboardCheck className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Inventory counts
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              A count sheet records the ledger quantity and the physical count for each item, then
              calculates the variance. A manager reviews and approves the sheet before posting. The
              original count and decision are preserved (CNT-01..05).
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
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New count
              </button>
            )}
          </div>
        </div>

        {!canManage && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              Read-only. Creating or posting counts requires a System Administrator, General Manager
              or Storekeeper role, and the database rejects the write without it.
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
          aria-labelledby="count-form-heading"
          className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="count-form-heading" className="text-sm font-semibold text-slate-900">
                New count sheet
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                The system quantity is captured when the sheet is saved and stays with the record
                for reporting. Posting later reconciles the ledger to the counted quantity.
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close count form"
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

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="count-number" className="block text-sm font-medium text-slate-700">
                Count number
              </label>
              <input
                id="count-number"
                value={form.countNumber}
                onChange={(event) => setField('countNumber')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.countNumber)}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm uppercase shadow-sm focus:border-brand-500',
                  fieldErrors.countNumber ? 'border-red-400' : 'border-slate-300',
                )}
                placeholder="e.g. CNT-0001"
                autoComplete="off"
              />
              {fieldErrors.countNumber && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.countNumber}</p>
              )}
            </div>

            <div>
              <label htmlFor="count-date" className="block text-sm font-medium text-slate-700">
                Count date
              </label>
              <input
                id="count-date"
                type="date"
                value={form.countDate}
                onChange={(event) => setField('countDate')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.countDate)}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.countDate ? 'border-red-400' : 'border-slate-300',
                )}
              />
              {fieldErrors.countDate && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.countDate}</p>
              )}
            </div>

            <div>
              <label htmlFor="count-location" className="block text-sm font-medium text-slate-700">
                Location
              </label>
              <select
                id="count-location"
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

            <div>
              <label htmlFor="count-counter" className="block text-sm font-medium text-slate-700">
                Counter
              </label>
              <input
                id="count-counter"
                value={form.counterName}
                onChange={(event) => setField('counterName')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.counterName)}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.counterName ? 'border-red-400' : 'border-slate-300',
                )}
                placeholder="Person who counted the stock"
                autoComplete="off"
              />
              {fieldErrors.counterName && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.counterName}</p>
              )}
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <label htmlFor="count-notes" className="block text-sm font-medium text-slate-700">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="count-notes"
                value={form.notes}
                onChange={(event) => setField('notes')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.notes)}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.notes ? 'border-red-400' : 'border-slate-300',
                )}
                placeholder="Scope, shift or comment"
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
                    <th scope="col" className="py-2 pr-2 font-medium">System quantity</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Physical quantity</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Variance</th>
                    <th scope="col" className="py-2 font-medium">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 align-top">
                  {form.lines.map((line, index) => {
                    const item = itemById.get(line.itemId)
                    const unitCode = unitById.get(item?.base_unit_id ?? '')?.code ?? ''
                    const system =
                      item && form.locationId
                        ? balanceByItemLocation.get(`${item.id}:${form.locationId}`) ?? 0
                        : null
                    const physical = line.physicalQuantity.trim()
                      ? Number(line.physicalQuantity)
                      : null
                    const variance =
                      physical !== null && Number.isFinite(physical) && system !== null
                        ? Math.round((physical - system) * 1_000_000) / 1_000_000
                        : null

                    return (
                      <tr key={line.key}>
                        <td className="py-2 pr-2">
                          <select
                            aria-label={`Item for count line ${index + 1}`}
                            value={line.itemId}
                            onChange={(event) => setLine(index, { itemId: event.target.value })}
                            className="w-full min-w-[10rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-brand-500"
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
                        <td className="whitespace-nowrap py-2 pr-2 text-xs text-slate-600">
                          {system === null
                            ? 'Select an item'
                            : `${formatQuantity(system)} ${unitCode}`}
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            aria-label={`Physical quantity for count line ${index + 1}`}
                            value={line.physicalQuantity}
                            onChange={(event) =>
                              setLine(index, { physicalQuantity: event.target.value })
                            }
                            inputMode="decimal"
                            className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-brand-500"
                            placeholder="0"
                          />
                          {fieldErrors[`line-${index}-physical`] && (
                            <p className="mt-1 text-xs text-red-700">
                              {fieldErrors[`line-${index}-physical`]}
                            </p>
                          )}
                        </td>
                        <td
                          className={cn(
                            'whitespace-nowrap py-2 pr-2 text-xs font-medium tabular-nums',
                            variance === null
                              ? 'text-slate-400'
                              : variance === 0
                                ? 'text-slate-600'
                                : 'text-amber-800',
                          )}
                        >
                          {variance === null
                            ? '—'
                            : `${variance > 0 ? '+' : ''}${formatQuantity(variance)} ${unitCode}`}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            aria-label={`Remove count line ${index + 1}`}
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
              Count in the item base unit. Physical quantities may be zero. The database stores the
              ledger snapshot and calculates the variance.
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
            {counts.length} count{counts.length === 1 ? '' : 's'} ·{' '}
            {counts.filter((count) => count.status !== 'posted').length} open
          </p>
        </div>

        {loading && counts.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading counts…
          </div>
        ) : loadError ? (
          <div role="alert" className="px-5 py-8 text-center">
            <AlertCircle className="mx-auto h-5 w-5 text-red-500" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-900">Could not load counts</p>
            <p className="mt-1 text-sm text-slate-600">{loadError}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Try again
            </button>
          </div>
        ) : counts.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No counts yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {counts.map((count) => {
              const varianceLines = count.inventory_count_lines.filter(
                (line) => number(line.variance_quantity) !== 0,
              )
              const total = count.inventory_count_lines.reduce(
                (sum, line) => sum + number(line.posted_cost ?? 0),
                0,
              )
              const busy = pendingId === count.id

              return (
                <article key={count.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{count.count_number}</p>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            STATUS_CLASSES[count.status],
                          )}
                        >
                          {STATUS_LABELS[count.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {locationById.get(count.location_id)?.name ?? 'Unknown location'} · Counter:{' '}
                        {count.counter_name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Counted {formatDate(count.count_date)}
                        {count.posted_at ? ` · Posted ${formatDateTime(count.posted_at)}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {count.inventory_count_lines.length} line
                        {count.inventory_count_lines.length === 1 ? '' : 's'} ·{' '}
                        {varianceLines.length} variance{varianceLines.length === 1 ? '' : 's'}
                        {count.status === 'posted' && total > 0
                          ? ` · ${formatCurrency(total)} posted value`
                          : ''}
                      </p>
                      {count.decided_at && (
                        <p className="mt-1 text-xs text-slate-600">
                          {count.status === 'rejected' ? 'Rejected' : 'Approved'} by{' '}
                          {count.decided_by_name ?? 'a manager'} on{' '}
                          {formatDateTime(count.decided_at)}
                          {count.decision_comment ? ` — ${count.decision_comment}` : ''}
                        </p>
                      )}
                      {count.notes && (
                        <p className="mt-1 text-xs text-slate-600">{count.notes}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {count.status === 'draft' && canManage && (
                        <button
                          type="button"
                          onClick={() =>
                            void runAction(
                              count.id,
                              () => submitInventoryCount(count.id),
                              `Count ${count.count_number} submitted for review.`,
                            )
                          }
                          disabled={busy}
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                        >
                          Submit for review
                        </button>
                      )}
                      {count.status === 'submitted' && canApprove && (
                        <button
                          type="button"
                          onClick={() => {
                            setDecidingId(count.id)
                            setDecisionComment('')
                          }}
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Review decision
                        </button>
                      )}
                      {count.status === 'approved' && canPost && (
                        <>
                          {confirmPostId === count.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void runAction(
                                    count.id,
                                    () => postInventoryCount(count.id),
                                    `Count ${count.count_number} posted. The ledger now matches the physical count.`,
                                  )
                                }
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
                              >
                                {busy && (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                )}
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
                              onClick={() => setConfirmPostId(count.id)}
                              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              Post
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {decidingId === count.id && count.status === 'submitted' && (
                    <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                      <label
                        htmlFor={`count-decision-comment-${count.id}`}
                        className="block text-xs font-medium text-slate-700"
                      >
                        Decision comment <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <input
                        id={`count-decision-comment-${count.id}`}
                        value={decisionComment}
                        onChange={(event) => setDecisionComment(event.target.value)}
                        className="mt-1 w-full max-w-lg rounded-lg border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-brand-500"
                        placeholder="Review note"
                        autoComplete="off"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void runAction(
                              count.id,
                              () => decideInventoryCount(count.id, 'approved', decisionComment),
                              `Count ${count.count_number} approved. It can now be posted.`,
                            )
                          }
                          disabled={busy}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void runAction(
                              count.id,
                              () => decideInventoryCount(count.id, 'rejected', decisionComment),
                              `Count ${count.count_number} rejected.`,
                            )
                          }
                          disabled={busy}
                          className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDecidingId(null)
                            setDecisionComment('')
                          }}
                          disabled={busy}
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900">
                      View {count.inventory_count_lines.length} line
                      {count.inventory_count_lines.length === 1 ? '' : 's'}
                    </summary>
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="text-left uppercase tracking-wide text-slate-500">
                          <tr>
                            <th scope="col" className="py-1 pr-3 font-medium">Item</th>
                            <th scope="col" className="py-1 pr-3 text-right font-medium">System</th>
                            <th scope="col" className="py-1 pr-3 text-right font-medium">Physical</th>
                            <th scope="col" className="py-1 pr-3 text-right font-medium">Variance</th>
                            <th scope="col" className="py-1 pr-3 text-right font-medium">Posted</th>
                            <th scope="col" className="py-1 text-right font-medium">Posted cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {count.inventory_count_lines.map((line) => {
                            const item = itemById.get(line.item_id)
                            const unitCode = unitById.get(item?.base_unit_id ?? '')?.code ?? ''
                            const variance = number(line.variance_quantity)
                            return (
                              <tr key={line.id}>
                                <td className="py-1.5 pr-3">{item?.name ?? line.item_id}</td>
                                <td className="py-1.5 pr-3 text-right tabular-nums">
                                  {formatQuantity(number(line.system_quantity))} {unitCode}
                                </td>
                                <td className="py-1.5 pr-3 text-right tabular-nums">
                                  {formatQuantity(number(line.physical_quantity))} {unitCode}
                                </td>
                                <td
                                  className={cn(
                                    'py-1.5 pr-3 text-right font-medium tabular-nums',
                                    variance === 0 ? 'text-slate-600' : 'text-amber-800',
                                  )}
                                >
                                  {variance > 0 ? '+' : ''}
                                  {formatQuantity(variance)} {unitCode}
                                </td>
                                <td className="py-1.5 pr-3 text-right tabular-nums">
                                  {line.posted_quantity === null
                                    ? '—'
                                    : `${number(line.posted_quantity) > 0 ? '+' : ''}${formatQuantity(number(line.posted_quantity))} ${unitCode}`}
                                </td>
                                <td className="py-1.5 text-right tabular-nums">
                                  {line.posted_cost === null
                                    ? '—'
                                    : formatCurrency(number(line.posted_cost))}
                                </td>
                              </tr>
                            )
                          })}
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
