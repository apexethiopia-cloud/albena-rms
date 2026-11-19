import { useMemo, useState } from 'react'
import { ChefHat } from 'lucide-react'
import { formatDateTime } from '@/lib/format'
import type { KitchenPerformanceRow } from './api'
import {
  asNumber,
  DEFAULT_DELAY_MINUTES,
  minutesSince,
  sumBy,
} from './validation'
import { EmptyNote, ReportSection, ReportTable, StatTile } from './ui'

export function KitchenReportPanel({ rows }: { rows: KitchenPerformanceRow[] }) {
  const [delayInput, setDelayInput] = useState(String(DEFAULT_DELAY_MINUTES))
  const delayMinutes = Number.parseInt(delayInput, 10)
  const threshold = Number.isFinite(delayMinutes) && delayMinutes > 0
    ? delayMinutes
    : DEFAULT_DELAY_MINUTES

  const stats = useMemo(() => {
    const readyTimes = rows
      .map((row) => row.minutes_to_ready)
      .filter((value): value is number | string => value !== null)
      .map(asNumber)
    const serveTimes = rows
      .map((row) => row.minutes_to_serve)
      .filter((value): value is number | string => value !== null)
      .map(asNumber)

    return {
      tickets: rows.length,
      averageReady:
        readyTimes.length > 0 ? sumBy(readyTimes, (value) => value) / readyTimes.length : null,
      averageServe:
        serveTimes.length > 0 ? sumBy(serveTimes, (value) => value) / serveTimes.length : null,
      delayed: rows.filter((row) => {
        if (row.status !== 'sent_to_kitchen' && row.status !== 'preparing') return false
        const minutes = minutesSince(row.sent_at)
        return minutes !== null && minutes > threshold
      }).length,
    }
  }, [rows, threshold])

  const slowest = useMemo(
    () =>
      [...rows]
        .filter((row) => row.minutes_to_ready !== null)
        .sort((a, b) => asNumber(b.minutes_to_ready) - asNumber(a.minutes_to_ready))
        .slice(0, 10),
    [rows],
  )

  return (
    <ReportSection
      id="kitchen-report"
      title="Kitchen performance"
      icon={ChefHat}
      description="Preparation and service timing for orders sent to the kitchen (KDS-04). Minutes are measured from the moment the order was sent."
      actions={
        <label className="text-xs font-medium text-slate-600">
          Delayed after (minutes)
          <input
            type="number"
            min={1}
            step={1}
            value={delayInput}
            onChange={(event) => setDelayInput(event.target.value)}
            className="ml-2 w-20 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
          />
        </label>
      }
      footnote="The delay threshold is a report filter, not a stored business rule; change it here to match service expectations."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Orders sent" value={String(stats.tickets)} />
        <StatTile
          label="Average to ready"
          value={stats.averageReady === null ? 'n/a' : `${stats.averageReady.toFixed(1)} min`}
        />
        <StatTile
          label="Average to serve"
          value={stats.averageServe === null ? 'n/a' : `${stats.averageServe.toFixed(1)} min`}
        />
        <StatTile
          label={`Open tickets over ${threshold} min`}
          value={String(stats.delayed)}
          hint="Sent or preparing"
        />
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-slate-900">Slowest orders by time to ready</h3>
        {slowest.length === 0 ? (
          <div className="mt-2">
            <EmptyNote>No completed kitchen timings in this range.</EmptyNote>
          </div>
        ) : (
          <div className="mt-2 max-h-72 overflow-y-auto">
            <ReportTable
              headers={['Order', 'Sent', 'Status', 'To ready', 'To serve', 'Open for']}
            >
              {slowest.map((row) => (
                <tr key={row.order_id}>
                  <td className="px-2 py-1.5">
                    <span className="font-medium text-slate-900">{row.order_number}</span>
                    <span className="block text-xs text-slate-500">
                      {row.outlet_code}
                      {row.waiter_name ? ` · ${row.waiter_name}` : ''}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-slate-600">{formatDateTime(row.sent_at)}</td>
                  <td className="px-2 py-1.5 capitalize text-slate-700">
                    {row.status.replace(/_/g, ' ')}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-900">
                    {row.minutes_to_ready === null
                      ? '—'
                      : `${asNumber(row.minutes_to_ready).toFixed(1)} min`}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">
                    {row.minutes_to_serve === null
                      ? '—'
                      : `${asNumber(row.minutes_to_serve).toFixed(1)} min`}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">
                    {row.minutes_open === null
                      ? 'open'
                      : `${asNumber(row.minutes_open).toFixed(1)} min`}
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
