import { PageHeader } from '@/components/PageHeader'
import { MenuPanel } from '@/features/menu/MenuPanel'
import { TablesPanel } from '@/features/tables/TablesPanel'
import { ReservationsPanel } from '@/features/reservations/ReservationsPanel'
import { OrdersPanel } from '@/features/orders/OrdersPanel'
import { PosPanel } from '@/features/orders/PosPanel'
import { KitchenDisplayPanel } from '@/features/orders/KitchenDisplayPanel'

export function Operations() {
  return (
    <>
      <PageHeader
        title="Operations"
        description="Menu, tables, reservations, quick POS, orders and the kitchen display. Prices include VAT, table state follows open orders, and every change is enforced by PostgreSQL permissions."
      />

      <div className="space-y-6">
        <MenuPanel />

        <TablesPanel />

        <ReservationsPanel />

        {/* Quick POS section (role-gated) renders immediately before the order form. */}
        <PosPanel />

        <OrdersPanel />

        <KitchenDisplayPanel />
      </div>
    </>
  )
}
