import { useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import { formatCurrency, formatDate, formatQuantity } from '@/lib/format'
import type { SalesDailyRow, SalesLineRow } from './api'
import { aggregateRows, asNumber, roundTo, sumBy } from './validation'
import { EmptyNote, ReportSection, ReportTable, StatTile } from './ui'

export function SalesReportPanel({
  daily,
  lines,
  outletScoped,
}: {
  daily: SalesDailyRow[]
  lines: SalesLineRow[]
  outletScoped: boolean
}) {
  const totals = useMemo(() => {
    const receipts = daily.reduce((count, row) => count + row.receipt_count, 0)
    const subtotal = sumBy(daily, (row) => row.subtotal)
    const vat = sumBy(daily, (row) => row.vat_amount)
    const total = sumBy(daily, (row) => row.total)
    const lineSales = sumBy(lines, (row) => row.line_total)
    return {
      receipts,
      subtotal,
      vat,
      total,
      lineSales,
      reconciled: roundTo(subtotal, 2) === roundTo(lineSales, 2),
      difference: roundTo(subtotal - lineSales, 2),
      averageReceipt: receipts > 0 ? total / receipts : 0,
    }
  }, [daily, lines])

  const byCategory = useMemo(
    () =>
      aggregateRows(
        lines,
        (row) => row.category_id ?? row.category_name,
        (row) => row.category_name,
        (row) => row.quantity,
        (row) => row.line_total,
      ),
    [lines],
  )

  const byItem = useMemo(
    () =>
      aggregateRows(
        lines,
        (row) => row.item_code,
        (row) => row.item_name,
        (row) => row.quantity,
        (row) => row.line_total,
      ).slice(0, 10),
    [lines],
  )

  const byWaiter = useMemo(
    () =>
      aggregateRows(
        lines,
        (row) => row.waiter_name || 'Unassigned',
        (row) => row.waiter_name || 'Unassigned',
        (row) => row.quantity,
        (row) => row.line_total,
      ),
    [lines],
  )

  const byOutlet = useMemo(
    () =>
      aggregateRows(
        daily,
        (row) => row.outlet_id,
        (row) => `${row.outlet_code} — ${row.outlet_name}`,
        (row) => row.receipt_count,
        (row) => row.total,
      ),
    [daily],
  )

  const byMonth = useMemo(() => {
    const map = new Map<string, { month: string; receipts: number; subtotal: number; total: number }>()
    for (const row of daily) {
      const month = row.business_date.slice(0, 7)
      const current = map.get(month) ?? { month, receipts: 0, subtotal: 0, total: 0 }
      current.receipts += row.receipt_count
      current.subtotal += asNumber(row.subtotal)
      current.total += asNumber(row.total)
      map.set(month, current)
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
  }, [daily])

  return (
    <ReportSection
      id="sales-report"
      title="Sales"
      icon={BarChart3}
      description="Revenue is read from issued receipts, so only closed orders contribute. VAT is shown separately and prices are VAT-inclusive (OD-07)."
      footnote={
        outletScoped
          ? 'Filtered to the selected outlet. Monthly totals group the same daily rows.'
          : 'All outlets. Monthly totals group the same daily rows.'
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Net sales" value={formatCurrency(totals.subtotal)} hint="VAT-exclusive" />
        <StatTile label="VAT" value={formatCurrency(totals.vat)} />
        <StatTile label="Gross total" value={formatCurrency(totals.total)} />
        <StatTile
          label="Receipts"
          value={String(totals.receipts)}
          hint={`Avg ${formatCurrency(totals.averageReceipt)}`}
        />
      </div>

      <p className="mt-3 text-xs text-slate-500" data-testid="sales-reconciliation">
        AC-12 reconciliation: sold lines {formatCurrency(totals.lineSales)} vs receipt net sales{' '}
        {formatCurrency(totals.subtotal)} —{' '}
        {totals.reconciled ? (
          <span className="font-medium text-emerald-700">Reconciled</span>
        ) : (
          <span className="font-medium text-amber-700">
            Difference {formatCurrency(totals.difference)}
          </span>
        )}
      </p>

      {daily.length === 0 ? (
        <div className="mt-4">
          <EmptyNote>No receipts were issued in this range.</EmptyNote>
        </div>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">By category</h3>
            <div className="mt-2">
              <ReportTable headers={['Category', 'Qty', 'Sales']}>
                {byCategory.map((row) => (
                  <tr key={row.key}>
                    <td className="px-2 py-1.5 text-slate-800">{row.label}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-600">
                      {formatQuantity(row.quantity)}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-900">
                      {formatCurrency(row.value)}
                    </td>
                  </tr>
                ))}
              </ReportTable>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">By waiter</h3>
            <div className="mt-2">
              <ReportTable headers={['Waiter', 'Qty', 'Sales']}>
                {byWaiter.map((row) => (
                  <tr key={row.key}>
                    <td className="px-2 py-1.5 text-slate-800">{row.label}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-600">
                      {formatQuantity(row.quantity)}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-900">
                      {formatCurrency(row.value)}
                    </td>
                  </tr>
                ))}
              </ReportTable>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Top 10 items by sales</h3>
            <div className="mt-2">
              <ReportTable headers={['Item', 'Qty', 'Sales']}>
                {byItem.map((row) => (
                  <tr key={row.key}>
                    <td className="px-2 py-1.5 text-slate-800">{row.label}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-600">
                      {formatQuantity(row.quantity)}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-900">
                      {formatCurrency(row.value)}
                    </td>
                  </tr>
                ))}
              </ReportTable>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">By outlet</h3>
            <div className="mt-2">
              <ReportTable headers={['Outlet', 'Receipts', 'Total']}>
                {byOutlet.map((row) => (
                  <tr key={row.key}>
                    <td className="px-2 py-1.5 text-slate-800">{row.label}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-600">{row.quantity}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-900">
                      {formatCurrency(row.value)}
                    </td>
                  </tr>
                ))}
              </ReportTable>
            </div>
          </div>
        </div>
      )}

      {byMonth.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-900">Monthly summary</h3>
          <div className="mt-2">
            <ReportTable headers={['Month', 'Receipts', 'Net sales', 'Gross total']}>
              {byMonth.map((row) => (
                <tr key={row.month}>
                  <td className="px-2 py-1.5 text-slate-800">{row.month}</td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">{row.receipts}</td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-900">
                    {formatCurrency(row.subtotal)}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-900">
                    {formatCurrency(row.total)}
                  </td>
                </tr>
              ))}
            </ReportTable>
          </div>
        </div>
      )}

      {daily.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-900">Daily detail</h3>
          <div className="mt-2 max-h-72 overflow-y-auto">
            <ReportTable headers={['Date', 'Outlet', 'Receipts', 'Net sales', 'VAT', 'Total']}>
              {daily.map((row) => (
                <tr key={`${row.business_date}-${row.outlet_id}`}>
                  <td className="px-2 py-1.5 text-slate-800">{formatDate(row.business_date)}</td>
                  <td className="px-2 py-1.5 text-slate-600">{row.outlet_code}</td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">
                    {row.receipt_count}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-900">
                    {formatCurrency(asNumber(row.subtotal))}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">
                    {formatCurrency(asNumber(row.vat_amount))}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-900">
                    {formatCurrency(asNumber(row.total))}
                  </td>
                </tr>
              ))}
            </ReportTable>
          </div>
        </div>
      )}
    </ReportSection>
  )
}
