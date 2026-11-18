import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ChefHat, Loader2, RotateCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import { formatDateTime } from '@/lib/format'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import {
  listKitchenOrders,
  setOrderStatus,
  subscribeToOrderChanges,
  type Order,
  type OrderStatus,
} from './api'

type KitchenColumn = {
  status: Extract<OrderStatus, 'sent_to_kitchen' | 'preparing' | 'ready'>
  title: string
  hint: string
}

const COLUMNS: KitchenColumn[] = [
  { status: 'sent_to_kitchen', title: 'Sent', hint: 'Waiting to be started' },
  { status: 'preparing', title: 'Preparing', hint: 'In the kitchen now' },
  { status: 'ready', title: 'Ready', hint: 'Waiting for pickup' },
]

type KitchenAction = { status: OrderStatus; label: string }

function nextActions(status: OrderStatus, canServe: boolean): KitchenAction[] {
  if (status === 'sent_to_kitchen') {
    return [
      { status: 'preparing', label: 'Start preparing' },
      { status: 'ready', label: 'Mark ready' },
    ]
  }
  if (status === 'preparing') {
    return [{ status: 'ready', label: 'Mark ready' }]
  }
  if (status === 'ready' && canServe) {
    return [{ status: 'served', label: 'Mark served' }]
  }
  return []
}

export function KitchenDisplayPanel() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Mirrors can_update_kitchen_status() and the can_take_orders() check for
  // the served transition.
  const canUpdateKitchen = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'restaurant_manager') ||
      hasRole(user.roles, 'executive_chef') ||
      hasRole(user.roles, 'kitchen_staff')
    : false
  const canServe = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'restaurant_manager') ||
      hasRole(user.roles, 'waiter')
    : false

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    listKitchenOrders()
      .then((nextOrders) => {
        if (!cancelled) setOrders(nextOrders)
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

  // KDS-03: refetch on any order or line change. The database stays the
  // source of truth; the event only triggers a reload.
  useEffect(() => {
    const unsubscribe = subscribeToOrderChanges(reload)
    return unsubscribe
  }, [reload])

  const byStatus = useMemo(() => {
    const map: Record<string, Order[]> = {
      sent_to_kitchen: [],
      preparing: [],
      ready: [],
    }
    for (const order of orders) {
      map[order.status]?.push(order)
    }
    return map
  }, [orders])

  const runStatus = async (order: Order, status: OrderStatus) => {
    setBusyId(order.id)
    setActionError(null)
    setNotice(null)

    try {
      await setOrderStatus(order.id, status, order.revision)
      setNotice(`${order.order_number} moved to ${status.replace(/_/g, ' ')}.`)
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section aria-labelledby="kds-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="kds-heading"
              className="flex items-center gap-2 text-base font-semibold text-slate-900"
            >
              <ChefHat className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Kitchen display
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Live ticket board for orders that were sent to the kitchen. Tickets refresh
              automatically over Supabase Realtime and every transition is re-checked by
              PostgreSQL (KDS-01..03).
            </p>
          </div>

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

        {!canUpdateKitchen && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Read-only: kitchen status is updated by the System Administrator, General
            Manager, Restaurant Manager, Executive Chef and Kitchen Staff.
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            {notice}
          </p>
        )}
        {actionError && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </p>
        )}
      </div>

      {loadError ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-white p-5 text-sm text-red-700">
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
      ) : loading && orders.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading kitchen tickets…
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((column) => (
            <div
              key={column.status}
              aria-label={`${column.title} tickets`}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-slate-900">{column.title}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {byStatus[column.status]?.length ?? 0}
                </span>
              </div>
              <p className="text-xs text-slate-500">{column.hint}</p>

              <ul className="mt-3 space-y-3">
                {(byStatus[column.status] ?? []).map((order) => (
                  <li key={order.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{order.order_number}</p>
                        <p className="text-xs text-slate-500">
                          {order.restaurant_tables?.code ?? 'Takeaway'}
                          {order.waiter_name ? ` · ${order.waiter_name}` : ''}
                        </p>
                      </div>
                      <p className="text-right text-[11px] text-slate-400">
                        {formatDateTime(order.sent_at ?? order.opened_at)}
                      </p>
                    </div>

                    <ul className="mt-2 space-y-1 text-sm">
                      {order.order_lines.map((line) => (
                        <li key={line.id} className="flex justify-between gap-2">
                          <span className="text-slate-800">
                            {line.item_name}
                            {line.special_instructions && (
                              <span className="block text-xs text-amber-700">
                                {line.special_instructions}
                              </span>
                            )}
                          </span>
                          <span className="tabular-nums text-slate-600">× {line.quantity}</span>
                        </li>
                      ))}
                    </ul>

                    {order.notes && (
                      <p className="mt-2 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
                        {order.notes}
                      </p>
                    )}

                    {canUpdateKitchen && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {nextActions(order.status, canServe).map((action) => (
                          <button
                            key={action.status}
                            type="button"
                            onClick={() => runStatus(order, action.status)}
                            disabled={busyId === order.id}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50',
                              action.status === 'served'
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-brand-600 text-white hover:bg-brand-700',
                            )}
                          >
                            {busyId === order.id && (
                              <Loader2
                                className="h-3.5 w-3.5 animate-spin"
                                aria-hidden="true"
                              />
                            )}
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}

                {(byStatus[column.status] ?? []).length === 0 && (
                  <li className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-400">
                    No tickets.
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
