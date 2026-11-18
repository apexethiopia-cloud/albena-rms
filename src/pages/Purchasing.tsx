import { FileText, PackageCheck, ReceiptText, Truck } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { SuppliersPanel } from '@/features/suppliers/SuppliersPanel'

const PLANNED = [
  {
    icon: FileText,
    title: 'Purchase requests',
    detail:
      'Draft → submitted → approved or rejected, with the requesting outlet and the reason for rejection kept on the record.',
  },
  {
    icon: ReceiptText,
    title: 'Purchase orders',
    detail:
      'Orders raised from approved requests and linked to one supplier, with ordered versus received quantities.',
  },
  {
    icon: Truck,
    title: 'Goods receiving notes',
    detail:
      'Atomic stock increase and FIFO cost-layer creation on posting (ADR-009), with duplicate-posting protection.',
  },
  {
    icon: PackageCheck,
    title: 'Supplier performance',
    detail:
      'Delivery history, price changes and shortage tracking for each supplier. Reporting arrives in Phase 7.',
  },
] as const

export function Purchasing() {
  return (
    <>
      <PageHeader
        title="Purchasing"
        description="Supplier master data now; purchase requests, orders and receiving in Phase 4."
      />

      <div className="space-y-6">
        <SuppliersPanel />

        <section
          aria-labelledby="purchasing-planned-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 id="purchasing-planned-heading" className="text-base font-semibold text-slate-900">
            Not implemented yet
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Supplier records are live. The purchasing documents below do not exist yet.
          </p>

          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {PLANNED.map(({ icon: Icon, title, detail }) => (
              <li key={title} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  {title}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{detail}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
