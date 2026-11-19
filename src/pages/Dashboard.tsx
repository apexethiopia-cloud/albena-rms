import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CalendarCheck,
  Calculator,
  ChefHat,
  Loader2,
  Package,
  ReceiptText,
  RefreshCw,
  Trash2,
  UserRound,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { toMessage } from '@/lib/errors'
import { formatCurrency, formatDate } from '@/lib/format'
import { useAuth } from '@/features/auth/auth-context'
import { listOutlets, type Outlet } from '@/features/outlets/api'
import { loadDashboard, type DashboardSnapshot } from '@/features/reports/api'
import { formatPercent } from '@/features/reports/validation'

function DashboardCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'warning'
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon
          className={tone === 'warning' ? 'h-4 w-4 text-amber-600' : 'h-4 w-4 text-brand-600'}
          aria-hidden="true"
        />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function Dashboard() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null

  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [outletId, setOutletId] = useState('')
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    listOutlets()
      .then((rows) => {
        if (!cancelled) setOutlets(rows.filter((outlet) => outlet.is_active))
      })
      .catch(() => {
        // The dashboard still works company-wide if the outlet list fails.
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    loadDashboard(outletId || null)
      .then((next) => {
        if (!cancelled) setSnapshot(next)
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
  }, [outletId, reloadToken])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  return (
    <>
      <PageHeader
        title="Operational dashboard"
        description="Today at a glance: sales, kitchen load, tables, stock, food cost and reservations (RPT-08). Business date and daily boundaries use Africa/Addis_Ababa (OD-01)."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-surface px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {user && (
            <span className="flex items-center gap-2 text-sm text-slate-700">
              <UserRound className="h-4 w-4 text-brand-600" aria-hidden="true" />
              <span className="font-semibold text-slate-900">{user.fullName}</span>
              <span className="text-xs capitalize text-slate-500">
                {user.roles.slice(0, 2).join(', ').replace(/_/g, ' ')}
              </span>
            </span>
          )}
          {snapshot && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
              {formatDate(snapshot.businessDate)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600">
            Outlet
            <select
              value={outletId}
              onChange={(event) => setOutletId(event.target.value)}
              className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
            >
              <option value="">All outlets</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.code} — {outlet.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-surface p-5 text-sm text-red-700">
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
      ) : loading && !snapshot ? (
        <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-surface p-5 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading today&apos;s numbers…
        </p>
      ) : snapshot ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardCard
              icon={Wallet}
              label="Today's sales"
              value={formatCurrency(snapshot.sales.total)}
              hint={`${snapshot.sales.receipts} receipt${snapshot.sales.receipts === 1 ? '' : 's'} · net ${formatCurrency(snapshot.sales.subtotal)} · VAT ${formatCurrency(snapshot.sales.vat)}`}
            />
            <DashboardCard
              icon={ChefHat}
              label="Kitchen queue"
              value={String(snapshot.kitchenQueue)}
              hint={`${snapshot.delayedOrders} over ${snapshot.delayMinutes} min`}
              tone={snapshot.delayedOrders > 0 ? 'warning' : 'default'}
            />
            <DashboardCard
              icon={UtensilsCrossed}
              label="Tables occupied"
              value={`${snapshot.tables.occupied}/${snapshot.tables.total}`}
              hint={`${snapshot.tables.available} available`}
            />
            <DashboardCard
              icon={AlertTriangle}
              label="Low stock"
              value={String(snapshot.lowStockCount)}
              hint="Below reorder (company-wide)"
              tone={snapshot.lowStockCount > 0 ? 'warning' : 'default'}
            />
            <DashboardCard
              icon={Package}
              label="Inventory value"
              value={formatCurrency(snapshot.inventoryValue)}
              hint="FIFO layers, company-wide"
            />
            <DashboardCard
              icon={Calculator}
              label="Food cost"
              value={formatPercent(snapshot.foodCostPct)}
              hint="Theoretical cost / net sales today"
            />
            <DashboardCard
              icon={Trash2}
              label="Waste"
              value={formatPercent(snapshot.wastePct)}
              hint={`${formatCurrency(snapshot.wasteCost)} posted today`}
            />
            <DashboardCard
              icon={CalendarCheck}
              label="Reservations"
              value={String(snapshot.reservations.total)}
              hint={`${snapshot.reservations.expectedCovers} expected covers · ${snapshot.reservations.arrived} arrived`}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ReceiptText className="h-4 w-4 text-brand-600" aria-hidden="true" />
                Top-selling items today
              </h2>
              {snapshot.topItems.length === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
                  No items sold yet today.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {snapshot.topItems.map((item, index) => (
                    <li key={item.key} className="flex items-center justify-between gap-3 py-2">
                      <span className="flex items-center gap-2 text-sm text-slate-800">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {index + 1}
                        </span>
                        {item.label}
                      </span>
                      <span className="text-right text-xs text-slate-500">
                        <span className="block font-medium tabular-nums text-slate-900">
                          {item.quantity} sold
                        </span>
                        {formatCurrency(item.value)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CalendarCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />
                Reservations today
              </h2>
              {snapshot.reservations.total === 0 ? (
                <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
                  No reservations today.
                </p>
              ) : (
                <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Bookings</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">
                      {snapshot.reservations.total}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Expected covers</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">
                      {snapshot.reservations.expectedCovers}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Arrived</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">
                      {snapshot.reservations.arrived}
                    </dd>
                  </div>
                </dl>
              )}
              <p className="mt-4 text-xs text-slate-500">
                Reservation reporting is summary-only; guest history is not stored (RES-03
                dropped under OD-10).
              </p>
            </section>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            Food cost compares sold portions x the current published recipe x current FIFO
            average cost with net sales; menu items without a published recipe reduce reported
            theoretical cost. Sales never auto-deduct stock (ADR-008), and inventory balances
            derive only from posted stock transactions (ADR-007).
          </p>
        </>
      ) : null}
    </>
  )
}
