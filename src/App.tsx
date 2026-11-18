import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { NetworkStatusBanner } from '@/components/NetworkStatusBanner'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { ComingSoon } from '@/pages/ComingSoon'
import { Dashboard } from '@/pages/Dashboard'
import { Inventory } from '@/pages/Inventory'
import { Login } from '@/pages/Login'
import { NotFound } from '@/pages/NotFound'
import { Purchasing } from '@/pages/Purchasing'
import { Settings } from '@/pages/Settings'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />

          <Route path="inventory" element={<Inventory />} />

          <Route path="purchasing" element={<Purchasing />} />

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
