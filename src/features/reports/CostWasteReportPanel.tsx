import { useMemo } from 'react'
import { Calculator } from 'lucide-react'
import { formatCurrency, formatQuantity } from '@/lib/format'
import type {
  ConsumptionVarianceRow,
  TheoreticalConsumptionRow,
  WasteReportRow,
} from './api'
import { aggregateRows, asNumber, percentOf, sumBy } from './validation'
import { EmptyNote, ReportSection, ReportTable, StatTile } from './ui'

// formatPercent lives in reports/validation; alias to keep component imports clear.
import { formatPercent as formatPct } from './validation'

export function CostWasteReportPanel({
  waste,
  theoretical,
  variance,
}: {
  waste: WasteReportRow[]
  theoretical: TheoreticalConsumptionRow[]
  variance: ConsumptionVarianceRow[]
}) {
  const totals = useMemo(() => {
    const theoreticalCost = sumBy(theoretical, (row) => row.theoretical_cost)
    const issuedCost = sumBy(variance, (row) => row.issued_cost)
    const wasteCost = sumBy(waste, (row) => row.waste_cost)
    return {
      theoreticalCost,
      issuedCost,
      wasteCost,
      costDifferencePct: percentOf(issuedCost - theoreticalCost, theoreticalCost),
    }
  }, [theoretical, variance, waste])

  const wasteByReason = useMemo(
    () =>
      aggregateRows(
        waste,
        (row) => row.reason,
        (row) => row.reason,
        (row) => row.base_quantity ?? row.quantity,
        (row) => row.waste_cost,
      ),
    [waste],
  )

  const costByMenuItem = useMemo(
    () =>
      aggregateRows(
        theoretical,
        (row) => row.menu_item_id,
        (row) => `${row.menu_item_code} — ${row.menu_item_name}`,
        (row) => row.portions_sold,
        (row) => row.theoretical_cost,
      ).slice(0, 10),
    [theoretical],
  )

  const topVariance = useMemo(
    () =>
      [...variance]
        .filter((row) => Math.abs(asNumber(row.variance_quantity)) > 0.000001)
        .sort(
          (a, b) =>
            Math.abs(asNumber(b.variance_quantity)) -
            Math.abs(asNumber(a.variance_quantity)),
        )
        .slice(0, 10),
    [variance],
  )

  return (
    <ReportSection
      id="cost-waste-report"
      title="Cost and waste"
      icon={Calculator}
      description="Theoretical consumption multiplies sold portions by the current published recipe and the current weighted-average FIFO cost. Consumption variance compares that with ledger issues, production inputs and waste."
      footnote="Assumptions (COST-03): the current recipe version and current FIFO cost are used for the whole range; historical recipe replays are not calculated. Issued quantities include SIV issues, production inputs and waste, so items without a published recipe appear as pure variance. Waste cost comes from posted waste adjustments."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Theoretical food cost"
          value={formatCurrency(totals.theoreticalCost)}
          hint="Sold portions x current recipe"
        />
        <StatTile
          label="Issued cost"
          value={formatCurrency(totals.issuedCost)}
          hint="Ledger outbound transactions"
        />
        <StatTile
          label="Issued vs theoretical"
          value={formatPct(totals.costDifferencePct)}
          hint="Positive means issued cost is higher"
        />
        <StatTile
          label="Waste cost"
          value={formatCurrency(totals.wasteCost)}
          hint={`${waste.length} posted line${waste.length === 1 ? '' : 's'}`}
        />
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Theoretical cost by menu item</h3>
          {costByMenuItem.length === 0 ? (
            <div className="mt-2">
              <EmptyNote>
                No sold menu items with a published recipe in this range.
              </EmptyNote>
            </div>
          ) : (
            <div className="mt-2">
              <ReportTable headers={['Menu item', 'Portions', 'Cost']}>
                {costByMenuItem.map((row) => (
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
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Waste by reason</h3>
          {wasteByReason.length === 0 ? (
            <div className="mt-2">
              <EmptyNote>No posted waste in this range.</EmptyNote>
            </div>
          ) : (
            <div className="mt-2">
              <ReportTable headers={['Reason', 'Qty (base)', 'Cost']}>
                {wasteByReason.map((row) => (
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
          )}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">
          Largest consumption variances (issued minus theoretical)
        </h3>
        {topVariance.length === 0 ? (
          <div className="mt-2">
            <EmptyNote>No consumption variance in this range.</EmptyNote>
          </div>
        ) : (
          <div className="mt-2">
            <ReportTable
              headers={[
                'Item',
                'Theoretical',
                'Issued',
                'Variance',
                'Waste qty',
                'Theoretical cost',
                'Issued cost',
              ]}
            >
              {topVariance.map((row) => (
                <tr key={`${row.business_date}-${row.item_id}`}>
                  <td className="px-2 py-1.5">
                    <span className="font-medium text-slate-900">{row.item_code}</span>
                    <span className="block text-xs text-slate-500">{row.item_name}</span>
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">
                    {formatQuantity(asNumber(row.theoretical_quantity))} {row.base_unit_code}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">
                    {formatQuantity(asNumber(row.issued_quantity))}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums font-medium text-slate-900">
                    {formatQuantity(asNumber(row.variance_quantity))}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">
                    {formatQuantity(asNumber(row.waste_quantity))}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">
                    {formatCurrency(asNumber(row.theoretical_cost))}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-900">
                    {formatCurrency(asNumber(row.issued_cost))}
                  </td>
                </tr>
              ))}
            </ReportTable>
          </div>
        )}
      </div>
    </ReportSection>
  )
}
