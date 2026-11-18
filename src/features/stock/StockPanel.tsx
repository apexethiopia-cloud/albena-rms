import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Boxes, Loader2, RotateCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import {
  formatCurrency,
  formatDateTime,
  formatQuantity,
  formatUnitCost,
} from '@/lib/format'
import {
  listStockBalances,
  listStockMovements,
  type StockBalance,
  type StockMovement,
} from './api'

const TYPE_LABELS: Record<StockMovement['transaction_type'], string> = {
  opening: 'Opening',
  grn: 'GRN',
  siv: 'SIV',
  adjustment: 'Adjustment',
  waste: 'Waste',
  production: 'Production',
}

function number(value: number | string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function StockPanel() {
  const [balances, setBalances] = useState<StockBalance[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([listStockBalances(), listStockMovements(20)])
      .then(([balanceRows, movementRows]) => {
        if (cancelled) return
        setBalances(balanceRows)
        setMovements(movementRows)
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

  const totalValue = balances.reduce((sum, row) => sum + number(row.total_value), 0)
  const stockedItems = new Set(
    balances.filter((row) => number(row.quantity) !== 0).map((row) => row.item_id),
  ).size

  return (
    <section aria-labelledby="stock-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="stock-heading" className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Boxes className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Stock balances and ledger
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Quantities are derived from posted stock transactions and valued from the remaining
              FIFO layers. There is no editable balance field (ADR-007).
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

        {!loading && !loadError && (
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            {stockedItems} item{stockedItems === 1 ? '' : 's'} with stock ·{' '}
            {formatCurrency(totalValue)} total value
          </p>
        )}
      </div>

      {loading && balances.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading stock balances…
        </div>
      ) : loadError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-6 text-center shadow-sm"
        >
          <AlertCircle className="mx-auto h-5 w-5 text-red-500" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-slate-900">Could not load stock</p>
          <p className="mt-1 text-sm text-slate-700">{loadError}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Try again
          </button>
        </div>
      ) : balances.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900">No stock has been posted yet</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">
            Post a goods receiving note on the Purchasing page to create the first FIFO layer. A
            store issue voucher can only move stock that already exists.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <caption className="sr-only">Stock balances derived from the ledger</caption>
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Item</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Location</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Quantity</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Value</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Last movement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {balances.map((row) => (
                  <tr key={`${row.item_id}:${row.location_id}`}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{row.item_name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{row.item_code}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{row.location_name}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums text-slate-900">
                      {formatQuantity(number(row.quantity))} {row.base_unit_code}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-700">
                      {formatCurrency(number(row.total_value))}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500">
                      {row.last_movement_at ? formatDateTime(row.last_movement_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Recent stock movements</h3>
          <p className="mt-1 text-xs text-slate-600">
            The ledger is append-only. Postings cannot be edited or deleted.
          </p>
        </div>

        {loading && movements.length === 0 ? (
          <div className="flex items-center gap-2 px-5 py-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading movements…
          </div>
        ) : movements.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No stock movements yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <caption className="sr-only">Most recent stock ledger entries</caption>
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Posted</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Movement</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Item</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Location</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Quantity</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Unit cost</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((movement) => {
                  const incoming = movement.direction === 'in'
                  return (
                    <tr key={movement.id}>
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500">
                        {formatDateTime(movement.posted_at)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
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
                          {TYPE_LABELS[movement.transaction_type]}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{movement.item_name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{movement.item_code}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-700">{movement.location_name}</td>
                      <td
                        className={cn(
                          'whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums',
                          incoming ? 'text-emerald-700' : 'text-amber-800',
                        )}
                      >
                        {incoming ? '+' : '−'}
                        {formatQuantity(number(movement.quantity))} {movement.base_unit_code}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-700">
                        {formatUnitCost(number(movement.unit_cost))}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500">
                        {movement.reference_number ?? movement.reference_type}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
