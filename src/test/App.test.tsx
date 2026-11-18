import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '@/App'
import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
} from '@/features/auth/auth-context'

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
  it('renders the dashboard, navigation and signed-in user', () => {
    renderApp(signedIn)

    expect(screen.getByRole('heading', { name: /project dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
    expect(screen.getAllByText('Test Manager').length).toBeGreaterThan(0)
    expect(screen.getByText('manager@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('renders a placeholder page for a planned module', () => {
    renderApp(signedIn, '/inventory')

    expect(screen.getByRole('heading', { name: 'Inventory' })).toBeInTheDocument()
    expect(screen.getByText(/scheduled for phase/i)).toBeInTheDocument()
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
