import { useMemo, useState } from 'react'
import { Package } from 'lucide-react'
import { formatCurrency, formatQuantity, formatUnitCost } from '@/lib/format'
import type { InventoryReportRow } from './api'
import { asNumber, sumBy } from './validation'
import { EmptyNote, ReportSection, ReportTable, StatTile } from './ui'

export function InventoryReportPanel({ rows }: { rows: InventoryReportRow[] }) {
  const [search, setSearch] = useState('')
  const [belowReorderOnly, setBelowReorderOnly] = useState(false)
  const [minIdleDays, setMinIdleDays] = useState('')

  const idleThreshold = Number.parseInt(minIdleDays, 10)
  const hasIdleThreshold = Number.isFinite(idleThreshold) && idleThreshold > 0

  const totals = useMemo(() => {
    return {
      items: rows.length,
      value: sumBy(rows, (row) => row.inventory_value),
      belowReorder: rows.filter((row) => row.is_below_reorder).length,
      idle: hasIdleThreshold
        ? rows.filter(
            (row) =>
              row.days_since_last_movement !== null &&
              row.days_since_last_movement >= idleThreshold,
          ).length
        : 0,
    }
  }, [rows, hasIdleThreshold, idleThreshold])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (belowReorderOnly && !row.is_below_reorder) return false
      if (
        hasIdleThreshold &&
        (row.days_since_last_movement === null ||
          row.days_since_last_movement < idleThreshold)
      ) {
        return false
      }
      if (!term) return true
      return (
        row.item_code.toLowerCase().includes(term) ||
        row.item_name.toLowerCase().includes(term) ||
        (row.category_name ?? '').toLowerCase().includes(term)
      )
    })
  }, [rows, search, belowReorderOnly, hasIdleThreshold, idleThreshold])

  return (
    <ReportSection
      id="inventory-report"
      title="Inventory"
      icon={Package}
      description="On-hand quantities and FIFO value for active items. Slow-moving and dead stock are shown as days since the last movement; the threshold is yours to choose."
      footnote="Stock locations are not mapped to outlets yet (open item), so this report is company-wide and ignores the outlet filter. Menu sales never auto-deduct stock (ADR-008)."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active items" value={String(totals.items)} />
        <StatTile label="Inventory value" value={formatCurrency(totals.value)} hint="Remaining FIFO layers" />
        <StatTile label="Below reorder" value={String(totals.belowReorder)} />
        <StatTile
          label="Idle items"
          value={hasIdleThreshold ? String(totals.idle) : '—'}
          hint={hasIdleThreshold ? `No movement for ${idleThreshold}+ days` : 'Choose a threshold'}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-600">
          Search
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Code, name or category"
            className="mt-1 block w-56 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Idle for at least (days)
          <input
            type="number"
            min={1}
            step={1}
            value={minIdleDays}
            onChange={(event) => setMinIdleDays(event.target.value)}
            placeholder="e.g. 30"
            className="mt-1 block w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
          />
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={belowReorderOnly}
            onChange={(event) => setBelowReorderOnly(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Below reorder only
        </label>
      </div>

      <div className="mt-4">
        {filtered.length === 0 ? (
          <EmptyNote>No items match these filters.</EmptyNote>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <ReportTable
              headers={['Item', 'Category', 'On hand', 'Value', 'Avg cost', 'Days idle', 'Status']}
            >
              {filtered.map((row) => (
                <tr key={row.item_id}>
                  <td className="px-2 py-1.5">
                    <span className="font-medium text-slate-900">{row.item_code}</span>
                    <span className="block text-xs text-slate-500">{row.item_name}</span>
                  </td>
                  <td className="px-2 py-1.5 text-slate-600">{row.category_name ?? '—'}</td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-800">
                    {formatQuantity(asNumber(row.on_hand))} {row.base_unit_code}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-900">
                    {formatCurrency(asNumber(row.inventory_value))}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">
                    {row.average_unit_cost === null
                      ? '—'
                      : formatUnitCost(asNumber(row.average_unit_cost))}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">
                    {row.days_since_last_movement ?? 'never'}
                  </td>
                  <td className="px-2 py-1.5">
                    {row.is_below_reorder ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        Below reorder
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">OK</span>
                    )}
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
