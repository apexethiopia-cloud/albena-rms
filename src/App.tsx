import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { NetworkStatusBanner } from '@/components/NetworkStatusBanner'
import { ComingSoon } from '@/pages/ComingSoon'
import { Dashboard } from '@/pages/Dashboard'
import { NotFound } from '@/pages/NotFound'

export default function App() {
  return (
    <>
      <NetworkStatusBanner />

      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />

          <Route
            path="inventory"
            element={
              <ComingSoon
                title="Inventory"
                phase="Phase 3–4"
                description="Items, locations, stock ledger, counts and adjustments."
                planned={[
                  'Item master with category, unit of measure and reorder level',
                  'Stock balances by item and location, derived from the ledger',
                  'GRN, SIV, adjustments, waste and production postings',
                  'Low-stock alerts and inventory valuation (OD-04 pending)',
                ]}
              />
            }
          />

          <Route
            path="purchasing"
            element={
              <ComingSoon
                title="Purchasing"
                phase="Phase 4"
                description="Purchase requests, purchase orders and goods receiving."
                planned={[
                  'Purchase request workflow: draft, submitted, approved, rejected',
                  'Purchase orders linked to approved requests',
                  'Goods receiving notes with atomic stock increase',
                  'Duplicate-posting protection and shortage review',
                ]}
              />
            }
          />

          <Route
            path="operations"
            element={
              <ComingSoon
                title="Operations"
                phase="Phase 6"
                description="Menus, tables, reservations, orders, KDS and receipts."
                planned={[
                  'Menu items with price snapshots preserved at sale time',
                  'Table status, merge, split and transfer',
                  'Reservation lifecycle with overlap detection (OD-09 pending)',
                  'Kitchen display with live updates over Supabase Realtime',
                  'Receipt printing and PDF output',
                ]}
              />
            }
          />

          <Route
            path="reports"
            element={
              <ComingSoon
                title="Reports"
                phase="Phase 7"
                description="Operational, cost and management reporting."
                planned={[
                  'Sales by day, outlet, category, item and waiter',
                  'Stock on hand, movement and valuation',
                  'Recipe cost, food cost % and profitability',
                  'Waste trends and theoretical vs actual consumption',
                  'Management dashboard: open tables, kitchen queue, low stock',
                ]}
              />
            }
          />

          <Route
            path="settings"
            element={
              <ComingSoon
                title="Settings"
                phase="Phase 2–3"
                description="Users, roles, outlets and system configuration."
                planned={[
                  'User management: create, disable, reactivate',
                  'Role and outlet scope assignment',
                  'Outlet and stock location configuration',
                  'Append-only audit trail access for authorized roles',
                ]}
              />
            }
          />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  )
}
