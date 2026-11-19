import { useMemo } from 'react'
import { CalendarCheck } from 'lucide-react'
import { formatDate } from '@/lib/format'
import type { ReservationDailyRow } from './api'
import { EmptyNote, ReportSection, ReportTable, StatTile } from './ui'

export function ReservationsReportPanel({ rows }: { rows: ReservationDailyRow[] }) {
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          reservations: acc.reservations + row.total_reservations,
          covers: acc.covers + row.covers,
          expected: acc.expected + row.expected_covers,
          arrived: acc.arrived + row.arrived,
          cancelled: acc.cancelled + row.cancelled,
          unassigned: acc.unassigned + row.unassigned,
        }),
        {
          reservations: 0,
          covers: 0,
          expected: 0,
          arrived: 0,
          cancelled: 0,
          unassigned: 0,
        },
      ),
    [rows],
  )

  return (
    <ReportSection
      id="reservations-report"
      title="Reservations"
      icon={CalendarCheck}
      description="Reservation counts and covers per service date. This is a summary only; guest history is not stored (RES-03 dropped under OD-10)."
      footnote="Expected covers counts booked, confirmed and arrived reservations. Unassigned reservations have no table yet."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Reservations" value={String(totals.reservations)} />
        <StatTile label="Expected covers" value={String(totals.expected)} />
        <StatTile label="Arrived" value={String(totals.arrived)} />
        <StatTile label="Cancelled" value={String(totals.cancelled)} />
        <StatTile label="Unassigned" value={String(totals.unassigned)} />
      </div>

      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyNote>No reservations in this range.</EmptyNote>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            <ReportTable
              headers={[
                'Date',
                'Outlet',
                'Total',
                'Booked',
                'Confirmed',
                'Arrived',
                'Completed',
                'Cancelled',
                'Unassigned',
                'Covers',
              ]}
            >
              {rows.map((row) => (
                <tr key={`${row.reserved_date}-${row.outlet_id}`}>
                  <td className="px-2 py-1.5 text-slate-800">{formatDate(row.reserved_date)}</td>
                  <td className="px-2 py-1.5 text-slate-600">{row.outlet_code}</td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-900">
                    {row.total_reservations}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">{row.booked}</td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">{row.confirmed}</td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">{row.arrived}</td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">{row.completed}</td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">{row.cancelled}</td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">{row.unassigned}</td>
                  <td className="px-2 py-1.5 tabular-nums text-slate-600">{row.covers}</td>
                </tr>
              ))}
            </ReportTable>
          </div>
        )}
      </div>
    </ReportSection>
  )
}
