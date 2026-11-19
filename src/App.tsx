import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { NetworkStatusBanner } from '@/components/NetworkStatusBanner'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { Dashboard } from '@/pages/Dashboard'
import { Inventory } from '@/pages/Inventory'
import { Kitchen } from '@/pages/Kitchen'
import { Login } from '@/pages/Login'
import { NotFound } from '@/pages/NotFound'
import { Operations } from '@/pages/Operations'
import { Purchasing } from '@/pages/Purchasing'
import { Reports } from '@/pages/Reports'
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

          <Route path="reports" element={<Reports />} />

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
