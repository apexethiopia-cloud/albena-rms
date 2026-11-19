import { useMemo } from 'react'
import { ShoppingCart } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import type { GrnReportRow, PurchaseOrderReportRow, PurchaseRequestReportRow } from './api'
import { asNumber, sumBy } from './validation'
import { EmptyNote, ReportSection, ReportTable, StatTile } from './ui'

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

export function PurchasingReportPanel({
  purchaseRequests,
  purchaseOrders,
  grns,
}: {
  purchaseRequests: PurchaseRequestReportRow[]
  purchaseOrders: PurchaseOrderReportRow[]
  grns: GrnReportRow[]
}) {
  const totals = useMemo(
    () => ({
      requestsPending: purchaseRequests.filter((row) =>
        ['draft', 'submitted'].includes(row.status),
      ).length,
      requestsApproved: purchaseRequests.filter((row) => row.status === 'approved').length,
      orderedValue: sumBy(purchaseOrders, (row) => row.ordered_value),
      receivedValue: sumBy(purchaseOrders, (row) => row.received_value),
      openOrders: purchaseOrders.filter((row) => ['approved', 'ordered'].includes(row.status))
        .length,
      grnValue: sumBy(grns, (row) => row.total_value),
      grnUnposted: grns.filter((row) => row.posted_at === null).length,
    }),
    [purchaseRequests, purchaseOrders, grns],
  )

  return (
    <ReportSection
      id="purchasing-report"
      title="Purchasing"
      icon={ShoppingCart}
      description="Purchase requests, purchase orders and goods received in the selected date range. Request lines carry no price; PO and GRN values come from their lines."
      footnote="Purchasing documents are not outlet-scoped, so the outlet filter does not change this section. Received value counts posted GRNs linked to PO lines."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Requests awaiting decision"
          value={String(totals.requestsPending)}
          hint={`${totals.requestsApproved} approved`}
        />
        <StatTile label="Open purchase orders" value={String(totals.openOrders)} />
        <StatTile
          label="Ordered value"
          value={formatCurrency(totals.orderedValue)}
          hint={`Received ${formatCurrency(totals.receivedValue)}`}
        />
        <StatTile
          label="Goods received"
          value={formatCurrency(totals.grnValue)}
          hint={totals.grnUnposted > 0 ? `${totals.grnUnposted} not posted` : 'All posted'}
        />
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Purchase requests</h3>
          {purchaseRequests.length === 0 ? (
            <div className="mt-2">
              <EmptyNote>No purchase requests in this range.</EmptyNote>
            </div>
          ) : (
            <div className="mt-2 max-h-64 overflow-y-auto">
              <ReportTable headers={['PR', 'Date', 'Requester', 'Status', 'Lines', 'Qty']}>
                {purchaseRequests.map((row) => (
                  <tr key={row.pr_id}>
                    <td className="px-2 py-1.5 font-medium text-slate-900">{row.pr_number}</td>
                    <td className="px-2 py-1.5 text-slate-600">{formatDate(row.request_date)}</td>
                    <td className="px-2 py-1.5 text-slate-600">{row.requester_name || '—'}</td>
                    <td className="px-2 py-1.5 capitalize text-slate-700">
                      {statusLabel(row.status)}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-600">{row.line_count}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-600">
                      {asNumber(row.total_quantity).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </ReportTable>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Purchase orders</h3>
          {purchaseOrders.length === 0 ? (
            <div className="mt-2">
              <EmptyNote>No purchase orders in this range.</EmptyNote>
            </div>
          ) : (
            <div className="mt-2 max-h-64 overflow-y-auto">
              <ReportTable
                headers={['PO', 'Date', 'Supplier', 'Status', 'Ordered', 'Received']}
              >
                {purchaseOrders.map((row) => (
                  <tr key={row.po_id}>
                    <td className="px-2 py-1.5 font-medium text-slate-900">{row.po_number}</td>
                    <td className="px-2 py-1.5 text-slate-600">{formatDate(row.order_date)}</td>
                    <td className="px-2 py-1.5 text-slate-600">{row.supplier_name}</td>
                    <td className="px-2 py-1.5 capitalize text-slate-700">
                      {statusLabel(row.status)}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-900">
                      {formatCurrency(asNumber(row.ordered_value))}
                    </td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-600">
                      {formatCurrency(asNumber(row.received_value))}
                    </td>
                  </tr>
                ))}
              </ReportTable>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Goods received</h3>
          {grns.length === 0 ? (
            <div className="mt-2">
              <EmptyNote>No goods received in this range.</EmptyNote>
            </div>
          ) : (
            <div className="mt-2 max-h-64 overflow-y-auto">
              <ReportTable
                headers={['GRN', 'Date', 'Supplier', 'Location', 'PO', 'Value', 'Status']}
              >
                {grns.map((row) => (
                  <tr key={row.grn_id}>
                    <td className="px-2 py-1.5 font-medium text-slate-900">{row.grn_number}</td>
                    <td className="px-2 py-1.5 text-slate-600">
                      {formatDate(row.received_date)}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">{row.supplier_name}</td>
                    <td className="px-2 py-1.5 text-slate-600">{row.location_code}</td>
                    <td className="px-2 py-1.5 text-slate-600">{row.po_number ?? '—'}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-900">
                      {formatCurrency(asNumber(row.total_value))}
                    </td>
                    <td className="px-2 py-1.5 text-slate-700">
                      {row.posted_at ? 'Posted' : 'Not posted'}
                    </td>
                  </tr>
                ))}
              </ReportTable>
            </div>
          )}
        </div>
      </div>
    </ReportSection>
  )
}
