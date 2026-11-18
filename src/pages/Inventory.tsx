import { Boxes, ClipboardCheck, Factory, Scale, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { ItemsPanel } from '@/features/items/ItemsPanel'
import { CategoriesPanel } from '@/features/categories/CategoriesPanel'
import { LocationsPanel } from '@/features/locations/LocationsPanel'

const PLANNED = [
  {
    icon: Boxes,
    title: 'Stock ledger and balances',
    detail:
      'Balances derived from posted transactions only, by item and stock location. No editable balance column exists (ADR-007).',
  },
  {
    icon: ClipboardCheck,
    title: 'Inventory counts',
    detail:
      'Count sheets, variance calculation and approval. Variances post as traceable adjustments, never as overwritten balances.',
  },
  {
    icon: Scale,
    title: 'Adjustments',
    detail:
      'Positive and negative adjustments with a reason, atomic posting and FIFO cost-layer impact (ADR-009).',
  },
  {
    icon: Trash2,
    title: 'Waste and transfers',
    detail:
      'Waste postings and store-to-store transfers, each generating ledger transactions with before/after audit records.',
  },
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
        description="Item master data now; the stock ledger, counts and postings arrive in Phase 4."
      />

      <div className="space-y-6">
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
            Items exist. There are no stock balances or movements in the system yet, so every item
            currently has no recorded quantity.
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
