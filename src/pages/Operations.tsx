import { PageHeader } from '@/components/PageHeader'
import { MenuPanel } from '@/features/menu/MenuPanel'
import { TablesPanel } from '@/features/tables/TablesPanel'
import { ReservationsPanel } from '@/features/reservations/ReservationsPanel'

export function Operations() {
  return (
    <>
      <PageHeader
        title="Operations"
        description="Menu, table layout and reservations. Prices include VAT, table state follows open orders, and every change is enforced by PostgreSQL permissions."
      />

      <div className="space-y-6">
        <MenuPanel />

        <TablesPanel />

        <ReservationsPanel />
      </div>
    </>
  )
}
