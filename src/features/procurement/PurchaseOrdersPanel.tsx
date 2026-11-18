import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Plus,
  ReceiptText,
  RotateCw,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import { formatCurrency, formatDate, toIsoDate } from '@/lib/format'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import {
  listItemUnitConversions,
  listItems,
  listUnits,
  type Item,
  type Unit,
} from '@/features/items/api'
import { listSuppliers, type Supplier } from '@/features/suppliers/api'
import {
  approvePurchaseOrder,
  closePurchaseOrder,
  createPurchaseOrder,
  listPurchaseOrders,
  listPurchaseRequests,
  markPurchaseOrderOrdered,
  type PurchaseOrder,
  type PurchaseRequest,
} from './api'
import {
  ORDER_STATUS_LABELS,
  validatePurchaseOrder,
  type PurchaseLineDraft,
  type PurchaseOrderDraft,
  type PurchaseOrderStatus,
} from './validation'
import { PurchaseLinesEditor } from './PurchaseLinesEditor'
import { resolveUnitFactor, type StockContext } from '@/features/stock/validation'

const STATUS_STYLES: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  approved: 'bg-sky-100 text-sky-800',
  ordered: 'bg-amber-100 text-amber-800',
  closed: 'bg-emerald-100 text-emerald-800',
}

function emptyLine(key: number): PurchaseLineDraft {
  return { key: `po-line-${key}`, itemId: '', unitId: '', quantity: '', unitCost: '' }
}

function initialForm(prId = ''): PurchaseOrderDraft {
  return {
    poNumber: '',
    supplierId: '',
    prId,
    orderDate: toIsoDate(new Date()),
    expectedDate: '',
    notes: '',
    lines: [emptyLine(1)],
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-700">{message}</p>
}

type PurchaseOrdersPanelProps = {
  seed?: PurchaseRequest | null
  onSeedHandled?: () => void
}

export function PurchaseOrdersPanel({ seed, onSeedHandled }: PurchaseOrdersPanelProps) {
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

  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [conversions, setConversions] = useState<
    Array<{ item_id: string; unit_id: string; base_factor: number }>
  >([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<PurchaseOrderDraft>(() => initialForm())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const lineSequence = useRef(1)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([
      listPurchaseOrders(),
      listPurchaseRequests(),
      listSuppliers(),
      listItems(),
      listUnits(),
      listItemUnitConversions(),
    ])
      .then(([orderRows, requestRows, supplierRows, itemRows, unitRows, conversionRows]) => {
        if (cancelled) return
        setOrders(orderRows)
        setRequests(requestRows)
        setSuppliers(supplierRows)
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

  useEffect(() => {
    if (!seed) return

    lineSequence.current = seed.purchase_request_lines.length
    const lines = seed.purchase_request_lines.map((line, index) => ({
      key: `po-seed-${index + 1}`,
      itemId: line.item_id,
      unitId: line.unit_id,
      quantity: String(line.quantity),
      unitCost: '',
    }))

    setForm({
      ...initialForm(seed.id),
      lines: lines.length > 0 ? lines : [emptyLine(1)],
    })
    setFieldErrors({})
    setFormError(null)
    setNotice(`Creating a purchase order for ${seed.pr_number}. Enter the supplier and unit costs.`)
    setFormOpen(true)
    onSeedHandled?.()
  }, [seed, onSeedHandled])

  const activeItems = useMemo(() => items.filter((item) => item.is_active), [items])
  const activeSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.is_active),
    [suppliers],
  )
  const supplierById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers],
  )
  const requestById = useMemo(
    () => new Map(requests.map((request) => [request.id, request])),
    [requests],
  )

  const availableRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.status === 'approved' &&
          !orders.some((order) => order.pr_id === request.id),
      ),
    [requests, orders],
  )

  const selectableRequests = useMemo(() => {
    if (!form.prId) return availableRequests
    if (availableRequests.some((request) => request.id === form.prId)) return availableRequests
    const current = requestById.get(form.prId)
    return current ? [current, ...availableRequests] : availableRequests
  }, [availableRequests, form.prId, requestById])

  const context: StockContext = useMemo(
    () => ({ items, units, conversions }),
    [items, units, conversions],
  )

  const unitsForItem = useCallback(
    (itemId: string): Unit[] => {
      if (!itemId) return []
      return units.filter((unit) => resolveUnitFactor(itemId, unit.id, context).factor !== null)
    },
    [units, context],
  )

  const openCount = orders.filter((order) => order.status !== 'closed').length

  const openCreate = () => {
    lineSequence.current = 1
    setForm(initialForm())
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

  const selectRequest = (prId: string) => {
    const request = prId ? requestById.get(prId) : null
    if (!request) {
      setForm((current) => ({ ...current, prId: '' }))
      return
    }

    lineSequence.current = request.purchase_request_lines.length
    const lines = request.purchase_request_lines.map((line, index) => ({
      key: `po-source-${index + 1}`,
      itemId: line.item_id,
      unitId: line.unit_id,
      quantity: String(line.quantity),
      unitCost: '',
    }))

    setForm((current) => ({
      ...current,
      prId,
      lines: lines.length > 0 ? lines : current.lines,
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const result = validatePurchaseOrder(form, context)
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)
    setNotice(null)

    try {
      await createPurchaseOrder(result.value)
      setNotice(`PO ${result.value.poNumber} saved as a draft. Approve it before ordering.`)
      closeForm()
      reload()
    } catch (error) {
      setFormError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (
    order: PurchaseOrder,
    action: (id: string) => Promise<void>,
    successMessage: string,
  ) => {
    setPendingId(order.id)
    setActionError(null)
    setNotice(null)

    try {
      await action(order.id)
      setNotice(successMessage)
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setPendingId(null)
    }
  }

  const formTotal = form.lines.reduce((sum, line) => {
    const quantity = Number(line.quantity)
    const cost = Number(line.unitCost)
    if (!Number.isFinite(quantity) || !Number.isFinite(cost)) return sum
    return sum + quantity * cost
  }, 0)

  return (
    <section aria-labelledby="purchase-orders-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="purchase-orders-heading"
              className="flex items-center gap-2 text-base font-semibold text-slate-900"
            >
              <ReceiptText className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Purchase orders
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Orders move Draft → Approved → Ordered → Closed. An order can be raised from one
              approved request, and that link is stored on the order (PO-01..04).
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
                New PO
              </button>
            )}
          </div>
        </div>

        {!canManage && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              Read-only. Raising purchase orders requires a System Administrator, General Manager or
              Purchasing Officer role, and the database rejects the write without it.
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
          aria-labelledby="po-form-heading"
          className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="po-form-heading" className="text-sm font-semibold text-slate-900">
                New purchase order
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Link an approved request to copy its lines, then enter the supplier and the agreed
                unit costs. The order is a draft until it is approved.
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close purchase order form"
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
              <span className="font-medium text-slate-700">PO number</span>
              <input
                type="text"
                value={form.poNumber}
                onChange={(event) =>
                  setForm((current) => ({ ...current, poNumber: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="PO-0001"
              />
              <FieldError message={fieldErrors.poNumber} />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-700">Supplier</span>
              <select
                value={form.supplierId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, supplierId: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Choose a supplier</option>
                {activeSuppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.code} — {supplier.name}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrors.supplierId} />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-700">Source request</span>
              <select
                value={form.prId}
                onChange={(event) => selectRequest(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">No linked request</option>
                {selectableRequests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.pr_number} — {request.requester_name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Choosing a request copies its lines; unit costs are entered here.
              </p>
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-700">Order date</span>
              <input
                type="date"
                value={form.orderDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, orderDate: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <FieldError message={fieldErrors.orderDate} />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-700">Expected date</span>
              <input
                type="date"
                value={form.expectedDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, expectedDate: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <FieldError message={fieldErrors.expectedDate} />
            </label>
          </div>

          <label className="mt-4 block text-sm">
            <span className="font-medium text-slate-700">Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Delivery instructions or references"
            />
            <FieldError message={fieldErrors.notes} />
          </label>

          <PurchaseLinesEditor
            lines={form.lines}
            items={activeItems}
            unitsForItem={unitsForItem}
            errors={fieldErrors}
            showCost
            labelPrefix="order"
            onSelectItem={selectItem}
            onSetLine={setLine}
            onAddLine={addLine}
            onRemoveLine={removeLine}
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-700">
              Draft total: <span className="font-semibold">{formatCurrency(formTotal)}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Save draft
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading && (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading purchase orders…
          </p>
        )}

        {loadError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <p className="font-medium">Could not load purchase orders.</p>
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

        {!loading && !loadError && orders.length === 0 && (
          <p className="text-sm text-slate-600">
            No purchase orders yet. {canManage ? 'Create the first order above.' : ''}
          </p>
        )}

        {!loading && !loadError && orders.length > 0 && (
          <>
            <p className="text-xs text-slate-500">
              {orders.length} order{orders.length === 1 ? '' : 's'} · {openCount} open
            </p>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[48rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2 font-medium">Number</th>
                    <th className="px-2 py-2 font-medium">Order date</th>
                    <th className="px-2 py-2 font-medium">Supplier</th>
                    <th className="px-2 py-2 font-medium">Source request</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-slate-100 align-top">
                      <td className="px-2 py-2 font-medium text-slate-900">{order.po_number}</td>
                      <td className="px-2 py-2 text-slate-700">{formatDate(order.order_date)}</td>
                      <td className="px-2 py-2 text-slate-700">
                        {supplierById.get(order.supplier_id)?.name ?? '—'}
                      </td>
                      <td className="px-2 py-2 text-slate-700">
                        {order.pr_id ? requestById.get(order.pr_id)?.pr_number ?? '—' : '—'}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            STATUS_STYLES[order.status],
                          )}
                        >
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {canApprove && order.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() =>
                                runAction(
                                  order,
                                  approvePurchaseOrder,
                                  `PO ${order.po_number} approved.`,
                                )
                              }
                              disabled={pendingId !== null}
                              className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                            >
                              Approve
                            </button>
                          )}
                          {canManage && order.status === 'approved' && (
                            <button
                              type="button"
                              onClick={() =>
                                runAction(
                                  order,
                                  markPurchaseOrderOrdered,
                                  `PO ${order.po_number} marked as ordered.`,
                                )
                              }
                              disabled={pendingId !== null}
                              className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
                            >
                              Mark ordered
                            </button>
                          )}
                          {canManage && order.status === 'ordered' && (
                            <button
                              type="button"
                              onClick={() =>
                                runAction(order, closePurchaseOrder, `PO ${order.po_number} closed.`)
                              }
                              disabled={pendingId !== null}
                              className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                            >
                              Close
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
