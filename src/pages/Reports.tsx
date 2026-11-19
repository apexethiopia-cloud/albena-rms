import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Filter, Loader2, RotateCw } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { toMessage } from '@/lib/errors'
import { listOutlets, type Outlet } from '@/features/outlets/api'
import { loadReports, type ReportBundle } from '@/features/reports/api'
import { CostWasteReportPanel } from '@/features/reports/CostWasteReportPanel'
import { InventoryReportPanel } from '@/features/reports/InventoryReportPanel'
import { KitchenReportPanel } from '@/features/reports/KitchenReportPanel'
import { PurchasingReportPanel } from '@/features/reports/PurchasingReportPanel'
import { ReservationsReportPanel } from '@/features/reports/ReservationsReportPanel'
import { SalesReportPanel } from '@/features/reports/SalesReportPanel'
import {
  defaultReportRange,
  validateDateRange,
  type DateRange,
} from '@/features/reports/validation'

type AppliedFilters = {
  range: DateRange
  outletId: string
}

export function Reports() {
  const initialRange = defaultReportRange()
  const [from, setFrom] = useState(initialRange.from)
  const [to, setTo] = useState(initialRange.to)
  const [outletId, setOutletId] = useState('')
  const [filterError, setFilterError] = useState<string | null>(null)
  const [applied, setApplied] = useState<AppliedFilters>({
    range: initialRange,
    outletId: '',
  })

  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [outletsError, setOutletsError] = useState<string | null>(null)
  const [bundle, setBundle] = useState<ReportBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    listOutlets()
      .then((rows) => {
        if (!cancelled) setOutlets(rows.filter((outlet) => outlet.is_active))
      })
      .catch((error: unknown) => {
        if (!cancelled) setOutletsError(toMessage(error))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    loadReports(applied.range, applied.outletId || null)
      .then((next) => {
        if (!cancelled) setBundle(next)
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
  }, [applied, reloadToken])

  const applyFilters = useCallback(() => {
    const validationError = validateDateRange(from, to)
    if (validationError) {
      setFilterError(validationError)
      return
    }
    setFilterError(null)
    setApplied({ range: { from, to }, outletId })
  }, [from, to, outletId])

  const resetFilters = useCallback(() => {
    const range = defaultReportRange()
    setFrom(range.from)
    setTo(range.to)
    setOutletId('')
    setFilterError(null)
    setApplied({ range, outletId: '' })
  }, [])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])
  const outletScoped = applied.outletId !== ''

  return (
    <>
      <PageHeader
        title="Reports"
        description="Sales, inventory, purchasing, cost, waste, kitchen and reservation reporting with a shared date range and outlet filter (RPT-01..09). Figures come from immutable receipts and the stock ledger."
      />

      <section
        aria-label="Report filters"
        className="mb-6 rounded-xl border border-slate-200 bg-surface p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600">
            From
            <input
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            To
            <input
              type="date"
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 block rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Outlet
            <select
              value={outletId}
              onChange={(event) => setOutletId(event.target.value)}
              className="mt-1 block w-48 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
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
            onClick={applyFilters}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-obsidian transition hover:bg-brand-700"
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            Apply filters
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <RotateCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} aria-hidden="true" />
            Refresh
          </button>
        </div>

        {filterError && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {filterError}
          </p>
        )}
        {outletsError && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            The outlet list could not be loaded: {outletsError}
          </p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Showing {applied.range.from} to {applied.range.to}
          {outletScoped ? ' for the selected outlet' : ' for all outlets'}. Business dates use
          Africa/Addis_Ababa (OD-01).
        </p>
      </section>

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
      ) : loading && !bundle ? (
        <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-surface p-5 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading reports…
        </p>
      ) : bundle ? (
        <div className="space-y-6">
          <SalesReportPanel
            daily={bundle.salesDaily}
            lines={bundle.salesLines}
            outletScoped={outletScoped}
          />
          <InventoryReportPanel rows={bundle.inventory} />
          <PurchasingReportPanel
            purchaseRequests={bundle.purchaseRequests}
            purchaseOrders={bundle.purchaseOrders}
            grns={bundle.grns}
          />
          <CostWasteReportPanel
            waste={bundle.waste}
            theoretical={bundle.theoretical}
            variance={bundle.variance}
          />
          <KitchenReportPanel rows={bundle.kitchen} />
          <ReservationsReportPanel rows={bundle.reservations} />
        </div>
      ) : (
        <p className="rounded-xl border border-slate-200 bg-surface p-5 text-sm text-slate-500">
          No report data.
        </p>
      )}
    </>
  )
}
