import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Plus,
  RotateCw,
  Scissors,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import { listOutlets, type Outlet } from '@/features/outlets/api'
import { listMenuItems, type MenuItem } from '@/features/menu/api'
import { listTables, type RestaurantTable } from '@/features/tables/api'
import {
  cancelOrder,
  closeOrder,
  createOrder,
  getReceipt,
  getReceiptByOrder,
  listOrders,
  mergeOrders,
  setOrderStatus,
  splitOrder,
  transferOrder,
  updateOrder,
  type Order,
  type OrderStatus,
  type Receipt,
} from './api'
import { ReceiptView } from './ReceiptView'
import {
  validateOrder,
  type OrderDraft,
  type OrderLineDraft,
} from './validation'

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  sent_to_kitchen: 'Sent to kitchen',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-slate-100 text-slate-700',
  sent_to_kitchen: 'bg-sky-50 text-sky-700',
  preparing: 'bg-amber-50 text-amber-800',
  ready: 'bg-indigo-50 text-indigo-700',
  served: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-50 text-red-700',
}

const OPEN_STATUSES: OrderStatus[] = [
  'pending',
  'sent_to_kitchen',
  'preparing',
  'ready',
  'served',
]

type StatusFilter = 'open' | 'all' | 'closed' | 'cancelled'

let lineSequence = 0

function newLine(): OrderLineDraft {
  lineSequence += 1
  return {
    key: `line-${lineSequence}`,
    menuItemId: '',
    quantity: '1',
    specialInstructions: '',
  }
}

function emptyForm(outletId = ''): OrderDraft {
  return { outletId, tableId: '', notes: '', lines: [newLine()] }
}

function lineTotal(order: Order): number {
  return order.order_lines.reduce(
    (sum, line) => sum + Number(line.unit_price) * line.quantity,
    0,
  )
}

export function OrdersPanel() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Mirrors can_take_orders(), can_close_orders() and the manager-only
  // branches inside update_order(), cancel_order() and merge_orders().
  const canTakeOrders = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'restaurant_manager') ||
      hasRole(user.roles, 'waiter') ||
      hasRole(user.roles, 'cashier')
    : false
  const canCloseOrders = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'restaurant_manager') ||
      hasRole(user.roles, 'cashier')
    : false
  const isManager = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'restaurant_manager')
    : false

  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [outletFilter, setOutletFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')

  const [mode, setMode] = useState<'closed' | 'create' | 'edit'>('closed')
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [form, setForm] = useState<OrderDraft>(() => emptyForm())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [closeId, setCloseId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [transferDraft, setTransferDraft] = useState<Record<string, string>>({})
  const [splitId, setSplitId] = useState<string | null>(null)
  const [splitLineIds, setSplitLineIds] = useState<string[]>([])
  const [splitTableId, setSplitTableId] = useState('')
  const [mergeId, setMergeId] = useState<string | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState('')

  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([listOutlets(), listTables(), listMenuItems(), listOrders()])
      .then(([nextOutlets, nextTables, nextMenuItems, nextOrders]) => {
        if (cancelled) return
        setOutlets(nextOutlets)
        setTables(nextTables)
        setMenuItems(nextMenuItems)
        setOrders(nextOrders)
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

  const activeOutlets = useMemo(
    () => outlets.filter((outlet) => outlet.is_active),
    [outlets],
  )
  const activeMenuItems = useMemo(
    () => menuItems.filter((item) => item.is_active),
    [menuItems],
  )
  const outletById = useMemo(
    () => new Map(outlets.map((outlet) => [outlet.id, outlet])),
    [outlets],
  )

  const visibleOrders = useMemo(() => {
    return orders.filter((order) => {
      if (outletFilter !== 'all' && order.outlet_id !== outletFilter) return false
      if (statusFilter === 'open') return OPEN_STATUSES.includes(order.status)
      if (statusFilter === 'closed') return order.status === 'closed'
      if (statusFilter === 'cancelled') return order.status === 'cancelled'
      return true
    })
  }, [orders, outletFilter, statusFilter])

  const openTableIds = useMemo(
    () =>
      new Set(
        orders
          .filter((order) => OPEN_STATUSES.includes(order.status) && order.table_id)
          .map((order) => order.table_id as string),
      ),
    [orders],
  )

  const formTables = useMemo(
    () =>
      tables.filter(
        (table) =>
          table.outlet_id === form.outletId &&
          table.is_active &&
          table.status !== 'cleaning' &&
          table.status !== 'closed',
      ),
    [tables, form.outletId],
  )

  const setField = (key: 'outletId' | 'tableId' | 'notes') => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const setLineField =
    (key: string, field: keyof Omit<OrderLineDraft, 'key'>) => (value: string) => {
      setForm((current) => ({
        ...current,
        lines: current.lines.map((line) =>
          line.key === key ? { ...line, [field]: value } : line,
        ),
      }))
    }

  const addLine = () => {
    setForm((current) => ({ ...current, lines: [...current.lines, newLine()] }))
  }

  const removeLine = (key: string) => {
    setForm((current) => ({
      ...current,
      lines:
        current.lines.length === 1
          ? current.lines
          : current.lines.filter((line) => line.key !== key),
    }))
  }

  const openCreate = () => {
    setMode('create')
    setEditingOrder(null)
    setForm(
      emptyForm(outletFilter !== 'all' ? outletFilter : activeOutlets[0]?.id ?? ''),
    )
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
  }

  const openEdit = (order: Order) => {
    setMode('edit')
    setEditingOrder(order)
    setForm({
      outletId: order.outlet_id,
      tableId: order.table_id ?? '',
      notes: order.notes ?? '',
      lines: order.order_lines.map((line) => {
        lineSequence += 1
        return {
          key: `line-${lineSequence}`,
          menuItemId: line.menu_item_id ?? '',
          quantity: String(line.quantity),
          specialInstructions: line.special_instructions ?? '',
        }
      }),
    })
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
  }

  const closeForm = () => {
    setMode('closed')
    setEditingOrder(null)
    setFieldErrors({})
    setFormError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const result = validateOrder(
      form,
      activeOutlets.map((outlet) => outlet.id),
      tables,
      menuItems.map((item) => ({ id: item.id, is_active: item.is_active })),
    )
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)
    setNotice(null)

    try {
      if (mode === 'edit' && editingOrder) {
        await updateOrder(editingOrder.id, editingOrder.revision, result.value)
        setNotice(`${editingOrder.order_number} was updated.`)
      } else {
        await createOrder(result.value)
        setNotice(
          `Order with ${result.value.lines.length} line${
            result.value.lines.length === 1 ? '' : 's'
          } was opened.`,
        )
      }
      closeForm()
      reload()
    } catch (error) {
      setFormError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const runStatus = async (order: Order, status: OrderStatus) => {
    setBusyId(order.id)
    setActionError(null)
    setNotice(null)

    try {
      await setOrderStatus(order.id, status, order.revision)
      setNotice(`${order.order_number} is now ${STATUS_LABELS[status].toLowerCase()}.`)
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const confirmClose = async (order: Order) => {
    setBusyId(order.id)
    setActionError(null)
    setNotice(null)

    try {
      const receiptId = await closeOrder(order.id, order.revision)
      const nextReceipt = await getReceipt(receiptId)
      setReceipt(nextReceipt)
      setReceiptOrder(order)
      setCloseId(null)
      setNotice(`${order.order_number} was closed and ${nextReceipt.receipt_number} issued.`)
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const viewReceipt = async (order: Order) => {
    setBusyId(order.id)
    setActionError(null)
    setNotice(null)

    try {
      const existing = await getReceiptByOrder(order.id)
      if (!existing) {
        setActionError('No receipt was found for that order.')
        return
      }
      setReceipt(existing)
      setReceiptOrder(order)
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const confirmCancel = async (order: Order) => {
    if (!cancelReason.trim()) {
      setActionError('A cancellation reason is required.')
      return
    }

    setBusyId(order.id)
    setActionError(null)
    setNotice(null)

    try {
      await cancelOrder(order.id, cancelReason, order.revision)
      setNotice(`${order.order_number} was cancelled.`)
      setCancelId(null)
      setCancelReason('')
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const runTransfer = async (order: Order) => {
    const tableId = transferDraft[order.id] ?? ''
    if (!tableId) {
      setActionError('Choose the table to transfer the order to.')
      return
    }

    setBusyId(order.id)
    setActionError(null)
    setNotice(null)

    try {
      await transferOrder(order.id, tableId, order.revision)
      setNotice(`${order.order_number} was transferred.`)
      setTransferDraft((current) => {
        const next = { ...current }
        delete next[order.id]
        return next
      })
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const runSplit = async (order: Order) => {
    if (splitLineIds.length === 0) {
      setActionError('Choose at least one line to split.')
      return
    }
    if (splitLineIds.length >= order.order_lines.length) {
      setActionError('Leave at least one line on the original order.')
      return
    }

    setBusyId(order.id)
    setActionError(null)
    setNotice(null)

    try {
      const newOrderId = await splitOrder(
        order.id,
        splitLineIds,
        splitTableId || null,
        order.revision,
      )
      setNotice(
        `Selected lines were moved to a new order (${newOrderId.slice(0, 8)}).`,
      )
      setSplitId(null)
      setSplitLineIds([])
      setSplitTableId('')
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const runMerge = async (order: Order) => {
    const target = orders.find((candidate) => candidate.id === mergeTargetId)
    if (!target) {
      setActionError('Choose the order to merge into.')
      return
    }

    setBusyId(order.id)
    setActionError(null)
    setNotice(null)

    try {
      await mergeOrders(order.id, target.id, order.revision, target.revision)
      setNotice(
        `${order.order_number} was merged into ${target.order_number}.`,
      )
      setMergeId(null)
      setMergeTargetId('')
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const toggleSplitLine = (lineId: string) => {
    setSplitLineIds((current) =>
      current.includes(lineId)
        ? current.filter((id) => id !== lineId)
        : [...current, lineId],
    )
  }

  const tableLabel = (tableId: string | null) => {
    if (!tableId) return 'Takeaway / no table'
    const table = tables.find((candidate) => candidate.id === tableId)
    return table ? `${table.code} · ${table.name}` : 'Unknown table'
  }

  const openOrdersForMerge = (order: Order) =>
    orders.filter(
      (candidate) =>
        candidate.id !== order.id &&
        candidate.outlet_id === order.outlet_id &&
        OPEN_STATUSES.includes(candidate.status),
    )

  return (
    <section aria-labelledby="orders-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="orders-heading"
              className="flex items-center gap-2 text-base font-semibold text-slate-900"
            >
              <ClipboardList className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Orders
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Orders snapshot the menu name and price at the moment the line is added. Line
              prices include VAT; closing a served order issues a numbered receipt and frees
              the table (ORD-01..06, RCT-01..05).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Outlet</span>
              <select
                aria-label="Order outlet filter"
                value={outletFilter}
                onChange={(event) => setOutletFilter(event.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="all">All outlets</option>
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.code} · {outlet.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Show</span>
              <select
                aria-label="Order status filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="open">Open orders</option>
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
                <option value="all">All orders</option>
              </select>
            </label>

            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="mt-5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
            >
              <RotateCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
              Refresh
            </button>
            {canTakeOrders && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New order
              </button>
            )}
          </div>
        </div>

        {!canTakeOrders && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Read-only: orders are taken by the System Administrator, General Manager,
            Restaurant Manager and Waiter. Closing is limited to the System Administrator,
            General Manager, Restaurant Manager and Cashier.
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
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
              {mode === 'edit' ? `Edit ${editingOrder?.order_number ?? 'order'}` : 'New order'}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close order form"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Outlet</span>
              <select
                aria-label="Order outlet"
                value={form.outletId}
                onChange={(event) => {
                  setField('outletId')(event.target.value)
                  setField('tableId')('')
                }}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">Choose an outlet</option>
                {activeOutlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.code} · {outlet.name}
                  </option>
                ))}
              </select>
              {fieldErrors.outletId && (
                <span className="mt-1 block text-red-600">{fieldErrors.outletId}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Table (optional)</span>
              <select
                aria-label="Order table (optional)"
                value={form.tableId}
                onChange={(event) => setField('tableId')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">Takeaway / no table</option>
                {formTables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.code} · {table.name}
                  </option>
                ))}
              </select>
              {fieldErrors.tableId && (
                <span className="mt-1 block text-red-600">{fieldErrors.tableId}</span>
              )}
            </label>

            <label className="text-xs text-slate-600 sm:col-span-2">
              <span className="mb-1 block font-medium">Notes</span>
              <input
                aria-label="Order notes"
                value={form.notes}
                onChange={(event) => setField('notes')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.notes && (
                <span className="mt-1 block text-red-600">{fieldErrors.notes}</span>
              )}
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Lines
              </h4>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add line
              </button>
            </div>

            {form.lines.map((line, index) => (
              <div key={line.key} className="grid gap-2 sm:grid-cols-12">
                <label className="text-xs text-slate-600 sm:col-span-5">
                  <span className="mb-1 block font-medium">Menu item</span>
                  <select
                    aria-label={`Menu item for line ${index + 1}`}
                    value={line.menuItemId}
                    onChange={(event) =>
                      setLineField(line.key, 'menuItemId')(event.target.value)
                    }
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">Choose an item</option>
                    {activeMenuItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} · {item.name} · {formatCurrency(Number(item.selling_price))}
                      </option>
                    ))}
                  </select>
                  {fieldErrors[`line-${index}-item`] && (
                    <span className="mt-1 block text-red-600">
                      {fieldErrors[`line-${index}-item`]}
                    </span>
                  )}
                </label>

                <label className="text-xs text-slate-600 sm:col-span-2">
                  <span className="mb-1 block font-medium">Qty</span>
                  <input
                    aria-label={`Quantity for line ${index + 1}`}
                    value={line.quantity}
                    onChange={(event) =>
                      setLineField(line.key, 'quantity')(event.target.value)
                    }
                    inputMode="numeric"
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  {fieldErrors[`line-${index}-quantity`] && (
                    <span className="mt-1 block text-red-600">
                      {fieldErrors[`line-${index}-quantity`]}
                    </span>
                  )}
                </label>

                <label className="text-xs text-slate-600 sm:col-span-4">
                  <span className="mb-1 block font-medium">Special instructions</span>
                  <input
                    aria-label={`Instructions for line ${index + 1}`}
                    value={line.specialInstructions}
                    onChange={(event) =>
                      setLineField(line.key, 'specialInstructions')(event.target.value)
                    }
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  {fieldErrors[`line-${index}-instructions`] && (
                    <span className="mt-1 block text-red-600">
                      {fieldErrors[`line-${index}-instructions`]}
                    </span>
                  )}
                </label>

                <div className="flex items-end sm:col-span-1">
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    disabled={form.lines.length === 1}
                    aria-label={`Remove line ${index + 1}`}
                    className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
            {fieldErrors.lines && (
              <p className="text-xs text-red-600">{fieldErrors.lines}</p>
            )}
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
              {mode === 'edit' ? 'Save changes' : 'Open order'}
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

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {loadError ? (
          <div className="flex items-start gap-2 text-sm text-red-700">
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
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading orders…
          </p>
        ) : visibleOrders.length === 0 ? (
          <p className="text-sm text-slate-500">
            No orders match this view. Open the first order to start service.
          </p>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {visibleOrders.map((order) => {
              const pickupTable = transferDraft[order.id] ?? ''
              const isClosed = order.status === 'closed'
              const isCancelled = order.status === 'cancelled'
              const isOpen = OPEN_STATUSES.includes(order.status)
              const canCancel = isOpen && (order.status === 'pending' || isManager)
              const canEdit = isOpen && (order.status === 'pending' || isManager)
              const mergeCandidates = openOrdersForMerge(order)

              return (
                <li
                  key={order.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{order.order_number}</p>
                      <p className="text-xs text-slate-500">
                        {outletById.get(order.outlet_id)?.code ?? 'Outlet'} ·{' '}
                        {tableLabel(order.table_id)} · {order.waiter_name || 'No waiter'}
                      </p>
                      <p className="text-xs text-slate-400">
                        Opened {formatDateTime(order.opened_at)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_STYLES[order.status],
                      )}
                    >
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>

                  {order.notes && (
                    <p className="mt-2 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
                      {order.notes}
                    </p>
                  )}
                  {order.cancel_reason && (
                    <p className="mt-2 text-xs text-red-700">
                      Cancelled: {order.cancel_reason}
                    </p>
                  )}

                  <table className="mt-3 w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {order.order_lines.map((line) => (
                        <tr key={line.id}>
                          <td className="py-1">
                            <span className="text-slate-800">{line.item_name}</span>
                            {line.special_instructions && (
                              <span className="block text-xs text-slate-500">
                                {line.special_instructions}
                              </span>
                            )}
                          </td>
                          <td className="py-1 text-right tabular-nums text-slate-600">
                            {line.quantity} × {formatCurrency(Number(line.unit_price))}
                          </td>
                          <td className="py-1 pl-3 text-right tabular-nums text-slate-800">
                            {formatCurrency(Number(line.line_total))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm">
                    <span className="text-slate-600">
                      {order.order_lines.length} line
                      {order.order_lines.length === 1 ? '' : 's'} · VAT inclusive
                    </span>
                    <span className="font-medium tabular-nums text-slate-900">
                      {formatCurrency(
                        isClosed && order.total !== null
                          ? Number(order.total)
                          : lineTotal(order),
                      )}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openEdit(order)}
                        disabled={busyId === order.id}
                        className="rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                      >
                        Edit
                      </button>
                    )}
                    {canTakeOrders && order.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => runStatus(order, 'sent_to_kitchen')}
                        disabled={busyId === order.id}
                        className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        {busyId === order.id && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        )}
                        Send to kitchen
                      </button>
                    )}
                    {canTakeOrders && order.status === 'ready' && (
                      <button
                        type="button"
                        onClick={() => runStatus(order, 'served')}
                        disabled={busyId === order.id}
                        className="rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        Mark served
                      </button>
                    )}
                    {canCloseOrders && order.status === 'served' && (
                      <button
                        type="button"
                        onClick={() => {
                          setCloseId(order.id)
                          setActionError(null)
                          setNotice(null)
                        }}
                        disabled={busyId === order.id}
                        className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Close &amp; print receipt
                      </button>
                    )}
                    {isClosed && (
                      <button
                        type="button"
                        onClick={() => viewReceipt(order)}
                        disabled={busyId === order.id}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        View receipt
                      </button>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => {
                          setCancelId(order.id)
                          setCancelReason('')
                          setActionError(null)
                          setNotice(null)
                        }}
                        disabled={busyId === order.id}
                        className="rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Cancel order
                      </button>
                    )}
                    {canTakeOrders && isOpen && (
                      <button
                        type="button"
                        onClick={() => {
                          setSplitId(order.id)
                          setSplitLineIds([])
                          setSplitTableId('')
                          setActionError(null)
                          setNotice(null)
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
                        Split
                      </button>
                    )}
                    {isManager && isOpen && mergeCandidates.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setMergeId(order.id)
                          setMergeTargetId('')
                          setActionError(null)
                          setNotice(null)
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        Merge
                      </button>
                    )}
                    {isCancelled && (
                      <span className="text-xs text-slate-500">No further action</span>
                    )}
                  </div>

                  {canTakeOrders && isOpen && (
                    <div className="mt-3 flex items-end gap-2">
                      <label className="flex-1 text-xs text-slate-600">
                        <span className="mb-1 block font-medium">Transfer to table</span>
                        <select
                          aria-label={`Transfer table for ${order.order_number}`}
                          value={pickupTable}
                          onChange={(event) =>
                            setTransferDraft((current) => ({
                              ...current,
                              [order.id]: event.target.value,
                            }))
                          }
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        >
                          <option value="">Choose a table</option>
                          {tables
                            .filter(
                              (table) =>
                                table.outlet_id === order.outlet_id &&
                                table.is_active &&
                                table.id !== order.table_id &&
                                table.status !== 'cleaning' &&
                                table.status !== 'closed' &&
                                !openTableIds.has(table.id),
                            )
                            .map((table) => (
                              <option key={table.id} value={table.id}>
                                {table.code} · {table.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => runTransfer(order)}
                        disabled={busyId === order.id || !pickupTable}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Transfer
                      </button>
                    </div>
                  )}

                  {splitId === order.id && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-xs font-medium text-slate-700">
                        Choose the lines to move to a new order
                      </p>
                      <ul className="mt-2 space-y-1">
                        {order.order_lines.map((line) => (
                          <li key={line.id}>
                            <label className="flex items-center gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                aria-label={`Split line ${line.item_name}`}
                                checked={splitLineIds.includes(line.id)}
                                onChange={() => toggleSplitLine(line.id)}
                              />
                              {line.quantity} × {line.item_name}
                            </label>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <label className="text-xs text-slate-600">
                          <span className="mb-1 block font-medium">New table (optional)</span>
                          <select
                            aria-label={`Split table for ${order.order_number}`}
                            value={splitTableId}
                            onChange={(event) => setSplitTableId(event.target.value)}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                          >
                            <option value="">Takeaway / no table</option>
                            {tables
                              .filter(
                                (table) =>
                                  table.outlet_id === order.outlet_id &&
                                  table.is_active &&
                                  table.status !== 'cleaning' &&
                                  table.status !== 'closed' &&
                                  !openTableIds.has(table.id),
                              )
                              .map((table) => (
                                <option key={table.id} value={table.id}>
                                  {table.code} · {table.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => runSplit(order)}
                          disabled={busyId === order.id}
                          className="rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                        >
                          Split selected
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSplitId(null)
                            setSplitLineIds([])
                            setSplitTableId('')
                          }}
                          className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Cancel split
                        </button>
                      </div>
                    </div>
                  )}

                  {mergeId === order.id && (
                    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <label className="flex-1 text-xs text-slate-600">
                        <span className="mb-1 block font-medium">Merge into</span>
                        <select
                          aria-label={`Merge target for ${order.order_number}`}
                          value={mergeTargetId}
                          onChange={(event) => setMergeTargetId(event.target.value)}
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        >
                          <option value="">Choose an open order</option>
                          {mergeCandidates.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.order_number} · {tableLabel(candidate.table_id)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => runMerge(order)}
                        disabled={busyId === order.id || !mergeTargetId}
                        className="rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        Merge orders
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMergeId(null)
                          setMergeTargetId('')
                        }}
                        className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        Cancel merge
                      </button>
                    </div>
                  )}

                  {cancelId === order.id && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50/60 p-3">
                      <label className="text-xs text-red-800">
                        <span className="mb-1 block font-medium">Cancellation reason</span>
                        <input
                          aria-label={`Cancellation reason for ${order.order_number}`}
                          value={cancelReason}
                          onChange={(event) => setCancelReason(event.target.value)}
                          className="w-full rounded-md border border-red-200 px-2 py-1 text-xs"
                        />
                      </label>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => confirmCancel(order)}
                          disabled={busyId === order.id}
                          className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Confirm cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCancelId(null)
                            setCancelReason('')
                          }}
                          className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Keep order
                        </button>
                      </div>
                    </div>
                  )}

                  {closeId === order.id && (
                    <div
                      role="group"
                      aria-label={`Close ${order.order_number}`}
                      className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3"
                    >
                      <p className="text-xs text-emerald-900">
                        Closing issues the receipt, posts the VAT-inclusive totals and frees
                        the table. This cannot be undone.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => confirmClose(order)}
                          disabled={busyId === order.id}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {busyId === order.id && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          )}
                          Confirm close
                        </button>
                        <button
                          type="button"
                          onClick={() => setCloseId(null)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white"
                        >
                          Keep order open
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {receipt && receiptOrder && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <ReceiptView
            receipt={receipt}
            order={receiptOrder}
            onClose={() => {
              setReceipt(null)
              setReceiptOrder(null)
            }}
          />
        </div>
      )}
    </section>
  )
}
