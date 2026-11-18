import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { env } from '@/lib/env'
import { formatDate } from '@/lib/format'
import { useAuth } from '@/features/auth/auth-context'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/purchasing', label: 'Purchasing', icon: ShoppingCart },
  { to: '/operations', label: 'Operations', icon: UtensilsCrossed },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-base font-bold text-white">
          A
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">{env.appName}</p>
          <p className="text-xs text-slate-500">Restaurant Management</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-200 px-5 py-4">
        <p className="text-xs font-medium text-slate-500">Phase 3 · Master data</p>
        <p className="mt-0.5 text-xs text-slate-400">v0.1.0</p>
      </div>
    </>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { state, signOut } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <p className="hidden text-sm text-slate-600 sm:block">
            <span className="font-medium text-slate-900">{env.appName}</span>
            <span className="mx-2 text-slate-300" aria-hidden="true">
              |
            </span>
            {formatDate(new Date())}
          </p>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 sm:inline">
              {env.appEnv}
            </span>

            {user && (
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-900">{user.fullName}</p>
                <p className="text-[11px] capitalize text-slate-500">
                  {(user.roles[0] ?? 'no role').replace(/_/g, ' ')}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
