import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '@/App'
import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
} from '@/features/auth/auth-context'

vi.mock('@/features/outlets/api', () => ({
  listOutlets: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/features/reports/api', () => ({
  loadDashboard: vi.fn().mockResolvedValue({
    businessDate: '2026-11-18',
    sales: { receipts: 0, subtotal: 0, vat: 0, total: 0 },
    kitchenQueue: 0,
    delayedOrders: 0,
    delayMinutes: 20,
    tables: { total: 0, occupied: 0, available: 0 },
    lowStockCount: 0,
    inventoryValue: 0,
    topItems: [],
    foodCostPct: null,
    wasteCost: 0,
    wastePct: null,
    reservations: { total: 0, expectedCovers: 0, arrived: 0 },
  }),
  loadReports: vi.fn().mockResolvedValue({
    salesDaily: [],
    salesLines: [],
    inventory: [],
    purchaseRequests: [],
    purchaseOrders: [],
    grns: [],
    waste: [],
    theoretical: [],
    variance: [],
    kitchen: [],
    reservations: [],
  }),
}))

const signIn = async () => ({ error: null })
const signOut = async () => {}

const signedIn: AuthContextValue = {
  state: {
    status: 'signed-in',
    user: {
      id: 'u1',
      email: 'manager@example.com',
      fullName: 'Test Manager',
      status: 'active',
      roles: ['system_admin', 'general_manager'],
    },
  },
  signIn,
  signOut,
}

const signedOut: AuthContextValue = { state: { status: 'signed-out' }, signIn, signOut }
const unconfigured: AuthContextValue = { state: { status: 'unconfigured' }, signIn, signOut }

function renderApp(value: AuthContextValue, initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthContext.Provider value={value}>
        <AppRoutes />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('App shell', () => {
  it('renders the dashboard, navigation and signed-in user', async () => {
    renderApp(signedIn)

    expect(screen.getByRole('heading', { name: /operational dashboard/i })).toBeInTheDocument()
    expect(await screen.findByText(/no items sold yet today/i)).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
    expect(screen.getAllByText('Test Manager').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('renders the reports page with its filters', async () => {
    renderApp(signedIn, '/reports')

    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Sales' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /apply filters/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
  })

  it('renders the not-found page for unknown routes', () => {
    renderApp(signedIn, '/does-not-exist')

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toBeInTheDocument()
  })

  it('redirects signed-out users to the login page', () => {
    renderApp(signedOut)

    expect(screen.getByRole('heading', { name: /^sign in$/i })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /main navigation/i })).toBeNull()
  })

  it('explains how to configure the backend when keys are missing', () => {
    renderApp(unconfigured)

    expect(screen.getByRole('heading', { name: /backend not configured/i })).toBeInTheDocument()
  })
})

describe('AuthState', () => {
  it('exposes the documented states', () => {
    const states: AuthState[] = [
      { status: 'loading' },
      { status: 'unconfigured' },
      { status: 'signed-out' },
      { status: 'disabled', email: 'x@example.com' },
      {
        status: 'signed-in',
        user: { id: '1', email: 'a@b.c', fullName: 'A', status: 'active', roles: [] },
      },
    ]

    expect(states.map((state) => state.status)).toEqual([
      'loading',
      'unconfigured',
      'signed-out',
      'disabled',
      'signed-in',
    ])
  })
})
