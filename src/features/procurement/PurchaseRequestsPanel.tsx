import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Info,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import { formatDate, formatDateTime, toIsoDate } from '@/lib/format'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import {
  listItemUnitConversions,
  listItems,
  listUnits,
  type Item,
  type Unit,
} from '@/features/items/api'
import {
  createPurchaseRequest,
  decidePurchaseRequest,
  deletePurchaseRequest,
  listPurchaseRequests,
  submitPurchaseRequest,
  updatePurchaseRequest,
  type PurchaseRequest,
} from './api'
import {
  REQUEST_STATUS_LABELS,
  validatePurchaseRequest,
  type PurchaseLineDraft,
  type PurchaseRequestDraft,
  type PurchaseRequestStatus,
} from './validation'
import { PurchaseLinesEditor } from './PurchaseLinesEditor'
import { resolveUnitFactor, type StockContext } from '@/features/stock/validation'

const STATUS_STYLES: Record<PurchaseRequestStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
}

function emptyLine(key: number): PurchaseLineDraft {
  return { key: `pr-line-${key}`, itemId: '', unitId: '', quantity: '', unitCost: '' }
}

function initialForm(): PurchaseRequestDraft {
  return {
    requestDate: toIsoDate(new Date()),
    notes: '',
    lines: [emptyLine(1)],
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-700">{message}</p>
}

type PurchaseRequestsPanelProps = {
  onCreatePo?: (request: PurchaseRequest) => void
}

export function PurchaseRequestsPanel({ onCreatePo }: PurchaseRequestsPanelProps) {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Mirrors can_manage_purchasing() / can_approve_purchasing() in migration 0006.
  const canManage = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'purchasing_officer')
    : false
  const canApprove = user
    ? hasRole(user.roles, 'system_admin') || hasRole(user.roles, 'general_manager')
    : false

  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [conversions, setConversions] = useState<
    Array<{ item_id: string; unit_id: string; base_factor: number }>
  >([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PurchaseRequestDraft>(() => initialForm())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [decision, setDecision] = useState<{ id: string; comment: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PurchaseRequest | null>(null)
  const lineSequence = useRef(1)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([listPurchaseRequests(), listItems(), listUnits(), listItemUnitConversions()])
      .then(([requestRows, itemRows, unitRows, conversionRows]) => {
        if (cancelled) return
        setRequests(requestRows)
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
  const context: StockContext = useMemo(
    () => ({ items, units, conversions }),
    [items, units, conversions],
  )

  const unitsForItem = useCallback(
    (itemId: string): Unit[] => {
      if (!itemId) return []
      return units.filter(
        (unit) =>
          resolveUnitFactor(itemId, unit.id, context).factor !== null,
      )
    },
    [units, context],
  )

  const approvedCount = requests.filter((request) => request.status === 'approved').length
  const deciding = decision
    ? requests.find((request) => request.id === decision.id) ?? null
    : null
  const editing = editingId
    ? requests.find((request) => request.id === editingId) ?? null
    : null

  const openCreate = () => {
    lineSequence.current = 1
    setEditingId(null)
    setForm(initialForm())
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
    setFormOpen(true)
  }

  const openEdit = (request: PurchaseRequest) => {
    const lines = request.purchase_request_lines.map((line, index) => ({
      key: `pr-edit-${index + 1}`,
      itemId: line.item_id,
      unitId: line.unit_id,
      quantity: String(line.quantity),
      unitCost: '',
    }))
    lineSequence.current = Math.max(1, lines.length)
    setEditingId(request.id)
    setForm({
      requestDate: request.request_date,
      notes: request.notes ?? '',
      lines: lines.length > 0 ? lines : [emptyLine(1)],
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

  const setLine = (index: number, patch: Partial<PurchaseLineDraft>) => {
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
    const item = items.find((candidate) => candidate.id === itemId)
    setLine(index, { itemId, unitId: item?.base_unit_id ?? '' })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const result = validatePurchaseRequest(form, context)
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)
    setNotice(null)

    try {
      if (editingId) {
        await updatePurchaseRequest(editingId, result.value)
        setNotice(editing ? `PR ${editing.pr_number} updated.` : 'Purchase request updated.')
      } else {
        await createPurchaseRequest(result.value)
        setNotice('Purchase request saved as a draft. Submit it for approval.')
      }
      closeForm()
      reload()
    } catch (error) {
      setFormError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const submit = async (request: PurchaseRequest) => {
    setPendingId(request.id)
    setActionError(null)
    setNotice(null)

    try {
      await submitPurchaseRequest(request.id)
      setNotice(`PR ${request.pr_number} submitted for approval.`)
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setPendingId(null)
    }
  }

  const decide = async (decisionValue: 'approved' | 'rejected') => {
    if (!decision || !deciding) return

    setPendingId(deciding.id)
    setActionError(null)
    setNotice(null)

    try {
      await decidePurchaseRequest(deciding.id, decisionValue, decision.comment)
      setNotice(
        decisionValue === 'approved'
          ? `PR ${deciding.pr_number} approved. It can now become a purchase order.`
          : `PR ${deciding.pr_number} rejected.`,
      )
      setDecision(null)
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setPendingId(null)
    }
  }

  const remove = async () => {
    if (!deleteTarget) return

    setPendingId(deleteTarget.id)
    setActionError(null)
    setNotice(null)

    try {
      await deletePurchaseRequest(deleteTarget.id)
      setNotice(`PR ${deleteTarget.pr_number} deleted.`)
      setDeleteTarget(null)
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section aria-labelledby="purchase-requests-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="purchase-requests-heading"
              className="flex items-center gap-2 text-base font-semibold text-slate-900"
            >
              <ClipboardList className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Purchase requests
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Request lines move Draft → Submitted → Approved or Rejected. An approved request can
              be converted into one purchase order. The approver, decision time and comment are kept
              on the record (PR-01..04).
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
                New request
              </button>
            )}
          </div>
        </div>

        {!canManage && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              Read-only. Raising purchase requests requires a System Administrator, General Manager
              or Purchasing Officer role, and the database rejects the write without it.
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
          aria-labelledby="pr-form-heading"
          className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="pr-form-heading" className="text-sm font-semibold text-slate-900">
                {editing ? 'Edit purchase request' : 'New purchase request'}
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                {editing
                  ? 'The request number stays unchanged. Quantities are entered in the selected unit.'
                  : 'Number assigned automatically when saved. Quantities are entered in the selected unit.'}{' '}
                The database checks the unit against the item base unit when the draft is saved.
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close purchase request form"
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
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Request date</span>
              <input
                type="date"
                value={form.requestDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, requestDate: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <FieldError message={fieldErrors.requestDate} />
            </label>
          </div>

          <label className="mt-4 block text-sm">
            <span className="font-medium text-slate-700">Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="What is this request for?"
            />
            <FieldError message={fieldErrors.notes} />
          </label>

          <PurchaseLinesEditor
            lines={form.lines}
            items={activeItems}
            unitsForItem={unitsForItem}
            errors={fieldErrors}
            showCost={false}
            labelPrefix="request"
            onSelectItem={selectItem}
            onSetLine={setLine}
            onAddLine={addLine}
            onRemoveLine={removeLine}
          />

          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {editing ? 'Save changes' : 'Save draft'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {decision && deciding && (
        <div
          aria-labelledby="pr-decision-heading"
          className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="pr-decision-heading" className="text-sm font-semibold text-slate-900">
                Decide {deciding.pr_number}
              </h3>
              <p className="mt-1 text-xs text-slate-700">
                The decision is recorded with your name and the current time. A comment is optional
                but recommended for rejections.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDecision(null)}
              aria-label="Cancel decision"
              className="rounded-md p-1 text-slate-500 transition hover:bg-amber-100 hover:text-slate-800"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <label className="mt-3 block text-sm">
            <span className="font-medium text-slate-700">Decision comment</span>
            <textarea
              value={decision.comment}
              onChange={(event) =>
                setDecision((current) =>
                  current ? { ...current, comment: event.target.value } : current,
                )
              }
              rows={2}
              className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => decide('approved')}
              disabled={pendingId !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              Approve request
            </button>
            <button
              type="button"
              onClick={() => decide('rejected')}
              disabled={pendingId !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
            >
              Reject request
            </button>
            <button
              type="button"
              onClick={() => setDecision(null)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-amber-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          role="alertdialog"
          aria-labelledby="pr-delete-heading"
          className="rounded-xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm"
        >
          <h3 id="pr-delete-heading" className="text-sm font-semibold text-slate-900">
            Delete {deleteTarget.pr_number}?
          </h3>
          <p className="mt-1 text-xs text-slate-700">
            This draft and its lines will be removed. This cannot be undone.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={remove}
              disabled={pendingId !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
            >
              Delete request
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-rose-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading && (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading purchase requests…
          </p>
        )}

        {loadError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <p className="font-medium">Could not load purchase requests.</p>
            <p className="mt-1">{loadError}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-xs font-medium text-red-800 ring-1 ring-red-200 transition hover:bg-red-100"
            >
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
          </div>
        )}

        {!loading && !loadError && requests.length === 0 && (
          <p className="text-sm text-slate-600">
            No purchase requests yet. {canManage ? 'Create the first request above.' : ''}
          </p>
        )}

        {!loading && !loadError && requests.length > 0 && (
          <>
            <p className="text-xs text-slate-500">
              {requests.length} request{requests.length === 1 ? '' : 's'} · {approvedCount}{' '}
              approved
            </p>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[48rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2 font-medium">Number</th>
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">Requester</th>
                    <th className="px-2 py-2 font-medium">Lines</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Decision</th>
                    <th className="px-2 py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id} className="border-b border-slate-100 align-top">
                      <td className="px-2 py-2 font-medium text-slate-900">{request.pr_number}</td>
                      <td className="px-2 py-2 text-slate-700">{formatDate(request.request_date)}</td>
                      <td className="px-2 py-2 text-slate-700">{request.requester_name || '—'}</td>
                      <td className="px-2 py-2 text-slate-700">
                        {request.purchase_request_lines.length}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            STATUS_STYLES[request.status],
                          )}
                        >
                          {REQUEST_STATUS_LABELS[request.status]}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-600">
                        {request.decided_at ? (
                          <span title={request.decision_comment ?? undefined}>
                            {request.decided_by_name || 'Approver'} ·{' '}
                            {formatDateTime(request.decided_at)}
                            {request.decision_comment ? ` — ${request.decision_comment}` : ''}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {canManage && request.status === 'draft' && (
                            <>
                              <button
                                type="button"
                                onClick={() => submit(request)}
                                disabled={pendingId !== null}
                                className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
                              >
                                Submit
                              </button>
                              <button
                                type="button"
                                onClick={() => openEdit(request)}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-100"
                              >
                                <Pencil className="h-3 w-3" aria-hidden="true" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(request)}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-50"
                              >
                                <Trash2 className="h-3 w-3" aria-hidden="true" />
                                Delete
                              </button>
                            </>
                          )}
                          {canApprove && request.status === 'submitted' && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setDecision({ id: request.id, comment: '' })
                                }
                                className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-emerald-700"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDecision({ id: request.id, comment: '' })
                                }
                                className="rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-rose-700"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {canManage && request.status === 'approved' && onCreatePo && (
                            <button
                              type="button"
                              onClick={() => onCreatePo(request)}
                              className="rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-brand-700"
                            >
                              Create PO
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
