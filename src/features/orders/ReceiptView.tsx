import { Printer, X } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { Order, Receipt } from './api'

function number(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

type ReceiptViewProps = {
  receipt: Receipt
  order: Order
  onClose: () => void
}

/**
 * Browser print / print-to-PDF only (RCT-02). No payment credentials are
 * handled anywhere in the prototype (RCT-04).
 */
export function ReceiptView({ receipt, order, onClose }: ReceiptViewProps) {
  return (
    <section
      role="dialog"
      aria-label={`Receipt ${receipt.receipt_number}`}
      className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Receipt {receipt.receipt_number}
          </h2>
          <p className="text-xs text-slate-500">
            Issued {formatDateTime(receipt.issued_at)} · browser print or print-to-PDF
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print receipt
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-md text-sm text-slate-800">
        <div className="border-b border-dashed border-slate-300 pb-3 text-center">
          <p className="text-lg font-semibold text-slate-900">{receipt.business_name}</p>
          {receipt.business_address && <p className="text-xs">{receipt.business_address}</p>}
          {receipt.business_phone && <p className="text-xs">{receipt.business_phone}</p>}
          {receipt.business_tin && <p className="text-xs">TIN: {receipt.business_tin}</p>}
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-slate-500">Receipt</dt>
          <dd className="text-right font-medium">{receipt.receipt_number}</dd>
          <dt className="text-slate-500">Issued</dt>
          <dd className="text-right">{formatDateTime(receipt.issued_at)}</dd>
          <dt className="text-slate-500">Order</dt>
          <dd className="text-right">{order.order_number}</dd>
          <dt className="text-slate-500">Table</dt>
          <dd className="text-right">{receipt.table_code ?? 'Takeaway'}</dd>
          <dt className="text-slate-500">Waiter</dt>
          <dd className="text-right">{receipt.waiter_name || '—'}</dd>
        </dl>

        <table className="mt-3 w-full text-xs">
          <thead className="border-y border-slate-300 text-left">
            <tr>
              <th scope="col" className="py-1 font-medium">Item</th>
              <th scope="col" className="py-1 text-right font-medium">Qty</th>
              <th scope="col" className="py-1 text-right font-medium">Price</th>
              <th scope="col" className="py-1 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.order_lines.map((line) => (
              <tr key={line.id} className="border-b border-dashed border-slate-200">
                <td className="py-1">
                  {line.item_name}
                  {line.special_instructions && (
                    <span className="block text-[11px] text-slate-500">
                      {line.special_instructions}
                    </span>
                  )}
                </td>
                <td className="py-1 text-right tabular-nums">{line.quantity}</td>
                <td className="py-1 text-right tabular-nums">
                  {formatCurrency(number(line.unit_price))}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {formatCurrency(number(line.line_total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-slate-500">Subtotal (VAT exclusive)</dt>
            <dd className="tabular-nums">{formatCurrency(number(receipt.subtotal))}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">VAT {number(receipt.vat_rate)}%</dt>
            <dd className="tabular-nums">{formatCurrency(number(receipt.vat_amount))}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-300 pt-1 text-sm font-semibold">
            <dt>Total (VAT inclusive)</dt>
            <dd className="tabular-nums">{formatCurrency(number(receipt.total))}</dd>
          </div>
        </dl>

        <p className="mt-4 text-center text-[11px] text-slate-500">
          {receipt.line_count} line{receipt.line_count === 1 ? '' : 's'} · prices include VAT.
        </p>
        {receipt.receipt_footer && (
          <p className="mt-1 text-center text-[11px] text-slate-500">
            {receipt.receipt_footer}
          </p>
        )}
      </div>
    </section>
  )
}
