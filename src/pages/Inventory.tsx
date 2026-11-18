import { PageHeader } from '@/components/PageHeader'
import { ItemsPanel } from '@/features/items/ItemsPanel'
import { CategoriesPanel } from '@/features/categories/CategoriesPanel'
import { LocationsPanel } from '@/features/locations/LocationsPanel'
import { StockPanel } from '@/features/stock/StockPanel'
import { LowStockPanel } from '@/features/stock/LowStockPanel'
import { SivPanel } from '@/features/stock/SivPanel'
import { CountPanel } from '@/features/stock/CountPanel'
import { AdjustmentPanel, WastePanel } from '@/features/stock/AdjustmentPanel'

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
      </div>
    </>
  )
}
