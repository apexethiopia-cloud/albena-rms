import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  RotateCw,
  ShoppingBasket,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import { formatCurrency } from '@/lib/format'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import { listOutlets, type Outlet } from '@/features/outlets/api'
import { listMenuItems, type MenuItem } from '@/features/menu/api'
import { listTables, type RestaurantTable } from '@/features/tables/api'
import { createOrder } from './api'
import { validateOrder, type OrderDraft, type OrderLineDraft } from './validation'

const ALL_CATEGORY = 'All'
const UNCATEGORISED = 'Uncategorised'

let cartSequence = 0

function newCartLine(menuItemId: string): OrderLineDraft {
  cartSequence += 1
  return {
    key: `pos-line-${cartSequence}`,
    menuItemId,
    quantity: '1',
    specialInstructions: '',
  }
}

function categoryOf(item: MenuItem): string {
  return item.menu_categories?.name ?? UNCATEGORISED
}

export function PosPanel() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Mirrors can_take_orders(), which now includes the cashier role.
  const canUsePos = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'restaurant_manager') ||
      hasRole(user.roles, 'waiter') ||
      hasRole(user.roles, 'cashier')
    : false

  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [category, setCategory] = useState(ALL_CATEGORY)
  const [cart, setCart] = useState<OrderLineDraft[]>([])
  const [outletId, setOutletId] = useState('')
  const [tableId, setTableId] = useState('')
  const [notes, setNotes] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    if (!canUsePos) return

    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([listOutlets(), listMenuItems(), listTables()])
      .then(([nextOutlets, nextMenuItems, nextTables]) => {
        if (cancelled) return
        setOutlets(nextOutlets)
        setMenuItems(nextMenuItems)
        setTables(nextTables)
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
  }, [canUsePos, reloadToken])

  const activeOutlets = useMemo(() => outlets.filter((outlet) => outlet.is_active), [outlets])
  const activeMenuItems = useMemo(() => menuItems.filter((item) => item.is_active), [menuItems])
  const menuById = useMemo(
    () => new Map(menuItems.map((item) => [item.id, item])),
    [menuItems],
  )
  const categories = useMemo(
    () => [ALL_CATEGORY, ...Array.from(new Set(activeMenuItems.map(categoryOf)))],
    [activeMenuItems],
  )
  const visibleMenuItems = useMemo(
    () =>
      activeMenuItems.filter(
        (item) => category === ALL_CATEGORY || categoryOf(item) === category,
      ),
    [activeMenuItems, category],
  )
  const availableTables = useMemo(
    () =>
      tables.filter(
        (table) =>
          table.is_active &&
          table.outlet_id === outletId &&
          table.status !== 'cleaning' &&
          table.status !== 'closed',
      ),
    [tables, outletId],
  )

  const cartQuantity = (itemId: string): number =>
    Number(cart.find((line) => line.menuItemId === itemId)?.quantity ?? 0)

  const cartTotal = cart.reduce((sum, line) => {
    const item = menuById.get(line.menuItemId)
    return item ? sum + Number(item.selling_price) * Number(line.quantity) : sum
  }, 0)

  const addToCart = (item: MenuItem) => {
    setCart((current) => {
      const existing = current.find((line) => line.menuItemId === item.id)
      if (existing) {
        return current.map((line) =>
          line.menuItemId === item.id
            ? { ...line, quantity: String(Math.min(999, Number(line.quantity) + 1)) }
            : line,
        )
      }
      return [...current, newCartLine(item.id)]
    })
    setFieldErrors((current) => {
      const next = { ...current }
      delete next.lines
      return next
    })
    setNotice(null)
    setActionError(null)
  }

  const changeQuantity = (key: string, delta: number) => {
    setCart((current) =>
      current
        .map((line) =>
          line.key === key
            ? {
                ...line,
                quantity: String(Math.max(0, Math.min(999, Number(line.quantity) + delta))),
              }
            : line,
        )
        .filter((line) => Number(line.quantity) > 0),
    )
    setNotice(null)
    setActionError(null)
  }

  const removeFromCart = (key: string) => {
    setCart((current) => current.filter((line) => line.key !== key))
    setNotice(null)
    setActionError(null)
  }

  const changeOutlet = (value: string) => {
    setOutletId(value)
    setTableId('')
  }

  const submitOrder = async () => {
    const draft: OrderDraft = {
      outletId,
      tableId,
      notes,
      lines: cart,
    }
    const result = validateOrder(
      draft,
      activeOutlets.map((outlet) => outlet.id),
      tables,
      menuItems.map((item) => ({ id: item.id, is_active: item.is_active })),
    )
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setActionError(null)
    setNotice(null)

    try {
      const reference = await createOrder(result.value)
      setNotice(`Order ${reference} was opened.`)
      setCart([])
      setTableId('')
      setNotes('')
      setFieldErrors({})
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitOrder()
  }

  if (!canUsePos) return null

  return (
    <section aria-labelledby="quick-pos-heading" className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="quick-pos-heading"
              className="flex items-center gap-2 text-base font-semibold text-slate-900"
            >
              <ShoppingBasket className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Quick POS
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Tap menu cards to build an order, then choose an outlet. Prices include VAT and
              the order is saved with the same create_order RPC as the order form.
            </p>
          </div>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            aria-label="Refresh POS data"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-brand-50 disabled:opacity-50"
          >
            <RotateCw
              className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>

        {notice && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {notice}
          </p>
        )}

        {actionError && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => void submitOrder()}
              disabled={saving}
              className="rounded-md border border-red-200 px-2 py-0.5 text-xs font-medium hover:bg-red-100 disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        )}

        {loadError ? (
          <div role="alert" className="flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4" aria-hidden="true" />
            <div>
              <p>{loadError}</p>
              <button
                type="button"
                onClick={reload}
                className="mt-2 rounded-md border border-red-200 px-2 py-1 text-xs font-medium hover:bg-red-100"
              >
                Try again
              </button>
            </div>
          </div>
        ) : loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading POS menu…
          </p>
        ) : visibleMenuItems.length === 0 ? (
          <p className="text-sm text-slate-500">No active menu items are available.</p>
        ) : (
          <div className="space-y-3">
            <div
              role="group"
              aria-label="Menu categories"
              className="flex flex-wrap gap-2"
            >
              {categories.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={category === name}
                  onClick={() => setCategory(name)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition',
                    category === name
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-brand-200 hover:bg-brand-50',
                  )}
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visibleMenuItems.map((item) => {
                const quantity = cartQuantity(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`Add ${item.name} to cart`}
                    onClick={() => addToCart(item)}
                    className="relative flex min-h-24 flex-col justify-between rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-brand-200 hover:bg-brand-50"
                  >
                    <span
                      aria-label={`${item.name} quantity in cart`}
                      className={cn(
                        'absolute right-2 top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold',
                        quantity > 0
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 text-slate-500',
                      )}
                    >
                      {quantity}
                    </span>
                    <span className="pr-6 text-sm font-medium text-slate-900">{item.name}</span>
                    <span className="mt-1 text-xs text-slate-500">{item.code}</span>
                    <span className="mt-2 text-sm font-semibold tabular-nums text-brand-700">
                      {formatCurrency(Number(item.selling_price))}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-slate-200 bg-brand-50/40 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Order details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-600">
                <span className="mb-1 block font-medium">Outlet</span>
                <select
                  aria-label="POS outlet"
                  value={outletId}
                  onChange={(event) => changeOutlet(event.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
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
                  aria-label="POS table (optional)"
                  value={tableId}
                  onChange={(event) => setTableId(event.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">Takeaway / no table</option>
                  {availableTables.map((table) => (
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
                  aria-label="POS notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                />
                {fieldErrors.notes && (
                  <span className="mt-1 block text-red-600">{fieldErrors.notes}</span>
                )}
              </label>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Cart</h3>
              <span className="text-xs text-slate-500">
                {cart.length} {cart.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {cart.length === 0 ? (
              <p className="text-sm text-slate-500">Tap a menu card to add the first item.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {cart.map((line, index) => {
                  const item = menuById.get(line.menuItemId)
                  const name = item?.name ?? 'Menu item'
                  return (
                    <li
                      key={line.key}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{name}</p>
                        <p className="text-xs text-slate-500">
                          {formatCurrency(Number(item?.selling_price ?? 0))} each
                        </p>
                        {fieldErrors[`line-${index}-item`] && (
                          <p className="text-xs text-red-600">
                            {fieldErrors[`line-${index}-item`]}
                          </p>
                        )}
                        {fieldErrors[`line-${index}-quantity`] && (
                          <p className="text-xs text-red-600">
                            {fieldErrors[`line-${index}-quantity`]}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => changeQuantity(line.key, -1)}
                          aria-label={`Decrease quantity for ${name}`}
                          className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-brand-50"
                        >
                          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <span
                          aria-label={`Quantity for ${name}`}
                          className="min-w-6 text-center text-sm font-medium tabular-nums text-slate-900"
                        >
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeQuantity(line.key, 1)}
                          aria-label={`Increase quantity for ${name}`}
                          className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-brand-50"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(line.key)}
                          aria-label={`Remove ${name} from cart`}
                          className="rounded-md p-1 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {fieldErrors.lines && (
              <p className="text-xs text-red-600">{fieldErrors.lines}</p>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm">
              <span className="text-slate-600">Total (VAT inclusive)</span>
              <span
                aria-label="Cart total"
                className="text-base font-semibold tabular-nums text-slate-900"
              >
                {formatCurrency(cartTotal)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Open POS order
          </button>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setCart([])
                setFieldErrors({})
              }}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Clear cart
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
