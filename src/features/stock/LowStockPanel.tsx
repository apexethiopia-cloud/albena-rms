import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, Loader2, RotateCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import { formatQuantity } from '@/lib/format'
import { listReorderStatus, type ReorderStatus } from './api'

function number(value: number | string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function LowStockPanel() {
  const [rows, setRows] = useState<ReorderStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [showAll, setShowAll] = useState(false)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    listReorderStatus()
      .then((statusRows) => {
        if (!cancelled) setRows(statusRows)
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

  const lowCount = useMemo(() => rows.filter((row) => row.is_low).length, [rows])
  const visibleRows = showAll ? rows : rows.filter((row) => row.is_low)

  return (
    <section aria-labelledby="reorder-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="reorder-heading"
              className="flex items-center gap-2 text-base font-semibold text-slate-900"
            >
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
              Reorder alerts
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Active items with a configured reorder level are compared against total on-hand stock
              across all locations (INV-06). The level is set on the item in base units.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(event) => setShowAll(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Show all tracked items
            </label>
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
        </div>

        {!loading && !loadError && (
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            {lowCount === 0
              ? 'No items below their reorder level'
              : `${lowCount} item${lowCount === 1 ? '' : 's'} below reorder level`}
          </p>
        )}
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading reorder status…
        </div>
      ) : loadError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-6 text-center shadow-sm"
        >
          <AlertCircle className="mx-auto h-5 w-5 text-red-500" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium text-slate-900">Could not load reorder status</p>
          <p className="mt-1 text-sm text-slate-700">{loadError}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-900">No reorder levels are configured</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">
            Set a reorder level in base units on an item to include it in low-stock alerts.
          </p>
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center shadow-sm">
          <p className="text-sm font-medium text-emerald-900">
            Every tracked item is above its reorder level
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            Tick “Show all tracked items” to review the current levels.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <caption className="sr-only">Items at or below their configured reorder level</caption>
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Item</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">On hand</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Reorder level</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Shortage</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((row) => (
                  <tr key={row.item_id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{row.item_name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{row.item_code}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-700">
                      {formatQuantity(number(row.on_hand))} {row.base_unit_code}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-700">
                      {formatQuantity(number(row.reorder_level))} {row.base_unit_code}
                    </td>
                    <td
                      className={cn(
                        'whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums',
                        row.is_low ? 'text-red-700' : 'text-slate-500',
                      )}
                    >
                      {row.is_low
                        ? `${formatQuantity(number(row.shortage))} ${row.base_unit_code}`
                        : '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          row.is_low
                            ? 'bg-red-50 text-red-700'
                            : 'bg-emerald-50 text-emerald-700',
                        )}
                      >
                        {row.is_low ? 'Reorder' : 'OK'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
