import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { NetworkStatusBanner } from '@/components/NetworkStatusBanner'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { ComingSoon } from '@/pages/ComingSoon'
import { Dashboard } from '@/pages/Dashboard'
import { Inventory } from '@/pages/Inventory'
import { Kitchen } from '@/pages/Kitchen'
import { Login } from '@/pages/Login'
import { NotFound } from '@/pages/NotFound'
import { Operations } from '@/pages/Operations'
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

          <Route path="kitchen" element={<Kitchen />} />

          <Route path="operations" element={<Operations />} />

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
