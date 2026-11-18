import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Info,
  Loader2,
  Plus,
  RotateCw,
  Scale,
  Trash2,
  Trash,
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
  createInventoryAdjustment,
  decideInventoryAdjustment,
  listInventoryAdjustments,
  listStockBalances,
  postInventoryAdjustment,
  submitInventoryAdjustment,
  type InventoryAdjustment,
  type InventoryDocumentStatus,
  type Numberish,
  type StockBalance,
} from './api'
import {
  ADJUSTMENT_REASONS,
  WASTE_REASONS,
  previewLine,
  validateInventoryAdjustment,
  type AdjustmentDraft,
  type AdjustmentKind,
  type AdjustmentLineDraft,
  type StockContext,
  type StockLineDraft,
} from './validation'

const STATUS_LABELS: Record<InventoryDocumentStatus, string> = {
  draft: 'Draft',
  submitted: 'Awaiting approval',
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

function emptyLine(key: number, direction: 'in' | 'out'): AdjustmentLineDraft {
  return { key: `adjustment-line-${key}`, itemId: '', direction, quantity: '', unitId: '', unitCost: '' }
}

function initialForm(kind: AdjustmentKind, locationId: string): AdjustmentDraft {
  return {
    kind,
    adjustmentNumber: '',
    adjustmentDate: toIsoDate(new Date()),
    locationId,
    reason: kind === 'waste' ? WASTE_REASONS[0].value : ADJUSTMENT_REASONS[0].value,
    notes: '',
    lines: [emptyLine(1, 'out')],
  }
}

type SectionProps = {
  kind: AdjustmentKind
}

function AdjustmentSection({ kind }: SectionProps) {
  const isWaste = kind === 'waste'
  const title = isWaste ? 'Waste records' : 'Inventory adjustments'
  const noun = isWaste ? 'waste record' : 'adjustment'
  const numberLabel = isWaste ? 'Waste number' : 'Adjustment number'
  const dateLabel = isWaste ? 'Waste date' : 'Adjustment date'
  const reasonLabelFor = (reason: string) =>
    (isWaste ? WASTE_REASONS : ADJUSTMENT_REASONS).find((option) => option.value === reason)?.label ??
    reason

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

  const [documents, setDocuments] = useState<InventoryAdjustment[]>([])
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
  const [form, setForm] = useState<AdjustmentDraft>(() => initialForm(kind, ''))
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
      listInventoryAdjustments(kind),
      listItems(),
      listUnits(),
      listItemUnitConversions(),
      listLocations(),
      listStockBalances(),
    ])
      .then(([documentRows, itemRows, unitRows, conversionRows, locationRows, balanceRows]) => {
        if (cancelled) return
        setDocuments(documentRows)
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
  }, [kind, reloadToken])

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
    setForm(initialForm(kind, activeLocations[0]?.id ?? ''))
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

  const setField = (key: 'adjustmentNumber' | 'adjustmentDate' | 'locationId' | 'reason' | 'notes') =>
    (value: string) => {
      setForm((current) => ({ ...current, [key]: value }))
    }

  const setLine = (index: number, patch: Partial<AdjustmentLineDraft>) => {
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
      lines: [...current.lines, emptyLine(lineSequence.current, 'out')],
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

    const result = validateInventoryAdjustment(form, context)
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)
    setNotice(null)

    try {
      await createInventoryAdjustment(result.value)
      setNotice(
        `${result.value.adjustmentNumber} saved as a draft. Submit it for approval, then post it to move stock.`,
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
    <section aria-labelledby={`${kind}-heading`} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id={`${kind}-heading`}
              className="flex items-center gap-2 text-base font-semibold text-slate-900"
            >
              {isWaste ? (
                <Trash className="h-4 w-4 text-slate-500" aria-hidden="true" />
              ) : (
                <Scale className="h-4 w-4 text-slate-500" aria-hidden="true" />
              )}
              {title}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              {isWaste
                ? 'Waste is recorded with an item, quantity, location, date, user and reason, then approved and posted as an inventory decrease at FIFO cost (WST-01..03).'
                : 'Adjustments increase or decrease stock for an approved reason. Posting writes ledger transactions and FIFO layers; balances are never overwritten (ADJ-01..03).'}
              {' '}Approval is limited to General Managers and System Administrators. The owner has
              not defined OD-06 monetary thresholds or separation-of-duties rules, so every action is
              recorded and audited but no threshold is invented.
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
                {isWaste ? 'New waste record' : 'New adjustment'}
              </button>
            )}
          </div>
        </div>

        {!canManage && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              Read-only. Recording or posting {isWaste ? 'waste' : 'adjustments'} requires a System
              Administrator, General Manager or Storekeeper role, and the database rejects the write
              without it.
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
          aria-labelledby={`${kind}-form-heading`}
          className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id={`${kind}-form-heading`} className="text-sm font-semibold text-slate-900">
                {isWaste ? 'New waste record' : 'New inventory adjustment'}
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Saving creates a draft. The document needs approval before it can be posted.
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              aria-label={`Close ${noun} form`}
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
              <label
                htmlFor={`${kind}-number`}
                className="block text-sm font-medium text-slate-700"
              >
                {numberLabel}
              </label>
              <input
                id={`${kind}-number`}
                value={form.adjustmentNumber}
                onChange={(event) => setField('adjustmentNumber')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.adjustmentNumber)}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm uppercase shadow-sm focus:border-brand-500',
                  fieldErrors.adjustmentNumber ? 'border-red-400' : 'border-slate-300',
                )}
                placeholder={isWaste ? 'e.g. WST-0001' : 'e.g. ADJ-0001'}
                autoComplete="off"
              />
              {fieldErrors.adjustmentNumber && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.adjustmentNumber}</p>
              )}
            </div>

            <div>
              <label htmlFor={`${kind}-date`} className="block text-sm font-medium text-slate-700">
                {dateLabel}
              </label>
              <input
                id={`${kind}-date`}
                type="date"
                value={form.adjustmentDate}
                onChange={(event) => setField('adjustmentDate')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.adjustmentDate)}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.adjustmentDate ? 'border-red-400' : 'border-slate-300',
                )}
              />
              {fieldErrors.adjustmentDate && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.adjustmentDate}</p>
              )}
            </div>

            <div>
              <label htmlFor={`${kind}-location`} className="block text-sm font-medium text-slate-700">
                Location
              </label>
              <select
                id={`${kind}-location`}
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
              <label htmlFor={`${kind}-reason`} className="block text-sm font-medium text-slate-700">
                Reason
              </label>
              <select
                id={`${kind}-reason`}
                value={form.reason}
                onChange={(event) => setField('reason')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.reason)}
                className={cn(
                  'mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.reason ? 'border-red-400' : 'border-slate-300',
                )}
              >
                {(isWaste ? WASTE_REASONS : ADJUSTMENT_REASONS).map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
              {fieldErrors.reason && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.reason}</p>
              )}
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <label htmlFor={`${kind}-notes`} className="block text-sm font-medium text-slate-700">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id={`${kind}-notes`}
                value={form.notes}
                onChange={(event) => setField('notes')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.notes)}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.notes ? 'border-red-400' : 'border-slate-300',
                )}
                placeholder="Explanation, incident reference or comment"
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
                    {!isWaste && (
                      <th scope="col" className="py-2 pr-2 font-medium">Direction</th>
                    )}
                    <th scope="col" className="py-2 pr-2 font-medium">Quantity</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Unit</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Unit cost</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Base quantity</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Available</th>
                    <th scope="col" className="py-2 font-medium">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 align-top">
                  {form.lines.map((line, index) => {
                    const preview = previewLine(
                      {
                        key: line.key,
                        itemId: line.itemId,
                        quantity: line.quantity,
                        unitId: line.unitId,
                        unitCost: line.unitCost,
                      } as StockLineDraft,
                      context,
                    )
                    const availableUnits = unitsForItem(line.itemId)
                    const item = itemById.get(line.itemId)
                    const available =
                      line.direction === 'out' && item
                        ? balanceByItemLocation.get(`${item.id}:${form.locationId}`) ?? 0
                        : null
                    const insufficient =
                      preview.baseQuantity !== null &&
                      available !== null &&
                      preview.baseQuantity > available

                    return (
                      <tr key={line.key}>
                        <td className="py-2 pr-2">
                          <select
                            aria-label={`Item for ${noun} line ${index + 1}`}
                            value={line.itemId}
                            onChange={(event) => selectItem(index, event.target.value)}
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
                        {!isWaste && (
                          <td className="py-2 pr-2">
                            <select
                              aria-label={`Direction for adjustment line ${index + 1}`}
                              value={line.direction}
                              onChange={(event) =>
                                setLine(index, {
                                  direction: event.target.value as 'in' | 'out',
                                })
                              }
                              className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-brand-500"
                            >
                              <option value="out">Decrease</option>
                              <option value="in">Increase</option>
                            </select>
                            {fieldErrors[`line-${index}-direction`] && (
                              <p className="mt-1 text-xs text-red-700">
                                {fieldErrors[`line-${index}-direction`]}
                              </p>
                            )}
                          </td>
                        )}
                        <td className="py-2 pr-2">
                          <input
                            aria-label={`Quantity for ${noun} line ${index + 1}`}
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
                            aria-label={`Unit for ${noun} line ${index + 1}`}
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
                          {line.direction === 'in' ? (
                            <input
                              aria-label={`Unit cost for ${noun} line ${index + 1}`}
                              value={line.unitCost}
                              onChange={(event) =>
                                setLine(index, { unitCost: event.target.value })
                              }
                              inputMode="decimal"
                              className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-brand-500"
                              placeholder="0.00"
                            />
                          ) : (
                            <span className="text-xs text-slate-400">FIFO at posting</span>
                          )}
                          {fieldErrors[`line-${index}-cost`] && (
                            <p className="mt-1 max-w-[10rem] text-xs text-red-700">
                              {fieldErrors[`line-${index}-cost`]}
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
                            <span className="text-slate-400">—</span>
                          ) : (
                            <span
                              className={
                                insufficient ? 'font-medium text-red-700' : 'text-slate-600'
                              }
                            >
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
                            aria-label={`Remove ${noun} line ${index + 1}`}
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
              Decreases consume the oldest FIFO layers and are rejected if stock is insufficient.
              Increases create a new FIFO layer at the entered unit cost.
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
            {documents.length} document{documents.length === 1 ? '' : 's'} ·{' '}
            {documents.filter((document) => document.status !== 'posted').length} open
          </p>
        </div>

        {loading && documents.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading {isWaste ? 'waste records' : 'adjustments'}…
          </div>
        ) : loadError ? (
          <div role="alert" className="px-5 py-8 text-center">
            <AlertCircle className="mx-auto h-5 w-5 text-red-500" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-900">
              Could not load {isWaste ? 'waste records' : 'adjustments'}
            </p>
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
            No {isWaste ? 'waste records' : 'adjustments'} yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {documents.map((document) => {
              const total = document.inventory_adjustment_lines.reduce(
                (sum, line) => sum + number(line.posted_cost ?? 0),
                0,
              )
              const busy = pendingId === document.id

              return (
                <article key={document.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{document.adjustment_number}</p>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            STATUS_CLASSES[document.status],
                          )}
                        >
                          {STATUS_LABELS[document.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {locationById.get(document.location_id)?.name ?? 'Unknown location'} ·{' '}
                        {reasonLabelFor(document.reason)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Dated {formatDate(document.adjustment_date)}
                        {document.posted_at
                          ? ` · Posted ${formatDateTime(document.posted_at)}`
                          : ''}
                      </p>
                      {document.decided_at && (
                        <p className="mt-1 text-xs text-slate-600">
                          {document.status === 'rejected' ? 'Rejected' : 'Approved'} by{' '}
                          {document.decided_by_name ?? 'a manager'} on{' '}
                          {formatDateTime(document.decided_at)}
                          {document.decision_comment ? ` — ${document.decision_comment}` : ''}
                        </p>
                      )}
                      {document.notes && (
                        <p className="mt-1 text-xs text-slate-600">{document.notes}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {document.status === 'posted' && (
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(total)}
                        </p>
                      )}
                      {document.status === 'draft' && canManage && (
                        <button
                          type="button"
                          onClick={() =>
                            void runAction(
                              document.id,
                              () => submitInventoryAdjustment(document.id),
                              `${document.adjustment_number} submitted for approval.`,
                            )
                          }
                          disabled={busy}
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                        >
                          Submit for approval
                        </button>
                      )}
                      {document.status === 'submitted' && canApprove && (
                        <button
                          type="button"
                          onClick={() => {
                            setDecidingId(document.id)
                            setDecisionComment('')
                          }}
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Review decision
                        </button>
                      )}
                      {document.status === 'approved' && canPost && (
                        <>
                          {confirmPostId === document.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void runAction(
                                    document.id,
                                    () => postInventoryAdjustment(document.id),
                                    `${document.adjustment_number} posted to the stock ledger.`,
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

                  {decidingId === document.id && document.status === 'submitted' && (
                    <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                      <label
                        htmlFor={`decision-comment-${document.id}`}
                        className="block text-xs font-medium text-slate-700"
                      >
                        Decision comment <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <input
                        id={`decision-comment-${document.id}`}
                        value={decisionComment}
                        onChange={(event) => setDecisionComment(event.target.value)}
                        className="mt-1 w-full max-w-lg rounded-lg border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-brand-500"
                        placeholder="Reason for the decision"
                        autoComplete="off"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void runAction(
                              document.id,
                              () =>
                                decideInventoryAdjustment(
                                  document.id,
                                  'approved',
                                  decisionComment,
                                ),
                              `${document.adjustment_number} approved. It can now be posted.`,
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
                              document.id,
                              () =>
                                decideInventoryAdjustment(
                                  document.id,
                                  'rejected',
                                  decisionComment,
                                ),
                              `${document.adjustment_number} rejected.`,
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
                      View {document.inventory_adjustment_lines.length} line
                      {document.inventory_adjustment_lines.length === 1 ? '' : 's'}
                    </summary>
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="text-left uppercase tracking-wide text-slate-500">
                          <tr>
                            <th scope="col" className="py-1 pr-3 font-medium">Item</th>
                            <th scope="col" className="py-1 pr-3 font-medium">Direction</th>
                            <th scope="col" className="py-1 pr-3 text-right font-medium">Quantity</th>
                            <th scope="col" className="py-1 pr-3 font-medium">Unit</th>
                            <th scope="col" className="py-1 pr-3 text-right font-medium">
                              Base quantity
                            </th>
                            <th scope="col" className="py-1 text-right font-medium">FIFO cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {document.inventory_adjustment_lines.map((line) => {
                            const incoming = line.direction === 'in'
                            return (
                              <tr key={line.id}>
                                <td className="py-1.5 pr-3">
                                  {itemById.get(line.item_id)?.name ?? line.item_id}
                                </td>
                                <td className="py-1.5 pr-3">
                                  <span
                                    className={cn(
                                      'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium',
                                      incoming
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-amber-50 text-amber-800',
                                    )}
                                  >
                                    {incoming ? (
                                      <ArrowDownLeft className="h-3 w-3" aria-hidden="true" />
                                    ) : (
                                      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                                    )}
                                    {incoming ? 'Increase' : 'Decrease'}
                                  </span>
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
                                    : formatQuantity(number(line.base_quantity))}
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

export function AdjustmentPanel() {
  return <AdjustmentSection kind="adjustment" />
}

export function WastePanel() {
  return <AdjustmentSection kind="waste" />
}
