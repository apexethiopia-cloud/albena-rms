import { Factory } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { ItemsPanel } from '@/features/items/ItemsPanel'
import { CategoriesPanel } from '@/features/categories/CategoriesPanel'
import { LocationsPanel } from '@/features/locations/LocationsPanel'
import { StockPanel } from '@/features/stock/StockPanel'
import { LowStockPanel } from '@/features/stock/LowStockPanel'
import { SivPanel } from '@/features/stock/SivPanel'
import { CountPanel } from '@/features/stock/CountPanel'
import { AdjustmentPanel, WastePanel } from '@/features/stock/AdjustmentPanel'

const PLANNED = [
  {
    icon: Factory,
    title: 'Production',
    detail:
      'Recipe-based production consuming ingredient layers and producing finished items. Phase 5.',
  },
] as const

export function Inventory() {
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Ledger-derived balances, issues, counts, adjustments, waste, reorder alerts, item master data and stock locations. Quantities are never edited directly."
      />

      <div className="space-y-6">
        <StockPanel />

        <LowStockPanel />

        <SivPanel />

        <CountPanel />

        <AdjustmentPanel />

        <WastePanel />

        <ItemsPanel />

        <CategoriesPanel />

        <LocationsPanel />

        <section
          aria-labelledby="inventory-planned-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 id="inventory-planned-heading" className="text-base font-semibold text-slate-900">
            Not implemented yet
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Stock balances, transfers, counts, adjustments, waste and reorder alerts are live.
            Production is still to be built.
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
