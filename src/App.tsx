import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { NetworkStatusBanner } from '@/components/NetworkStatusBanner'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { ComingSoon } from '@/pages/ComingSoon'
import { Dashboard } from '@/pages/Dashboard'
import { Login } from '@/pages/Login'
import { NotFound } from '@/pages/NotFound'
import { Settings } from '@/pages/Settings'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
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
                  'FIFO valuation across receiving layers (OD-04 confirmed)',
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
                  'Stock on hand, movement and FIFO valuation',
                  'Recipe cost, food cost % and profitability',
                  'Waste trends and theoretical vs actual consumption',
                  'Management dashboard: open tables, kitchen queue, low stock',
                ]}
              />
            }
          />

          <Route path="settings" element={<Settings />} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <>
      <NetworkStatusBanner />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </>
  )
}
