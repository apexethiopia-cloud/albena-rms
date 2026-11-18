import { useCallback, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { SuppliersPanel } from '@/features/suppliers/SuppliersPanel'
import { GrnPanel } from '@/features/stock/GrnPanel'
import { PurchaseRequestsPanel } from '@/features/procurement/PurchaseRequestsPanel'
import { PurchaseOrdersPanel } from '@/features/procurement/PurchaseOrdersPanel'
import type { PurchaseRequest } from '@/features/procurement/api'

const PLANNED = [
  {
    icon: TrendingUp,
    title: 'Supplier performance',
    detail: 'Delivery history, price changes and shortage tracking for each supplier. Reporting arrives in Phase 7.',
  },
] as const

export function Purchasing() {
  const [poSeed, setPoSeed] = useState<PurchaseRequest | null>(null)
  const clearSeed = useCallback(() => setPoSeed(null), [])

  return (
    <>
      <PageHeader
        title="Purchasing"
        description="Purchase requests and orders, goods receiving and supplier master data."
      />

      <div className="space-y-6">
        <PurchaseRequestsPanel onCreatePo={setPoSeed} />

        <PurchaseOrdersPanel seed={poSeed} onSeedHandled={clearSeed} />

        <GrnPanel />

        <SuppliersPanel />

        <section
          aria-labelledby="purchasing-planned-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 id="purchasing-planned-heading" className="text-base font-semibold text-slate-900">
            Not implemented yet
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Requests, orders and receiving are live. Supplier performance reporting is still to be
            built.
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
