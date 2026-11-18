import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { LocationsPanel } from '@/features/locations/LocationsPanel'

const api = vi.hoisted(() => ({
  listLocations: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))

vi.mock('@/features/locations/api', () => api)

const LOCATION = {
  id: 'l1',
  code: 'MAIN_STORE',
  name: 'Main Store',
  is_active: true,
  created_at: '2026-11-18T08:00:00.000Z',
  updated_at: '2026-11-18T08:00:00.000Z',
}

function authValue(roles: string[]): AuthContextValue {
  return {
    state: {
      status: 'signed-in',
      user: {
        id: 'u1',
        email: 'admin@example.com',
        fullName: 'Test Admin',
        status: 'active',
        roles,
      },
    },
    signIn: async () => ({ error: null }),
    signOut: async () => {},
  }
}

function renderPanel(roles: string[] = ['system_admin']) {
  return render(
    <AuthContext.Provider value={authValue(roles)}>
      <LocationsPanel />
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listLocations.mockResolvedValue([LOCATION])
  api.createLocation.mockResolvedValue(undefined)
  api.updateLocation.mockResolvedValue(undefined)
})

describe('Locations panel', () => {
  it('lists stock locations', async () => {
    renderPanel()

    expect(await screen.findByText('Main Store')).toBeInTheDocument()
    expect(screen.getByText('MAIN_STORE')).toBeInTheDocument()
    expect(screen.getByText(/1 location · 1 active/i)).toBeInTheDocument()
  })

  it('creates a stock location with normalized values', async () => {
    const user = userEvent.setup()
    renderPanel()

    await screen.findByText('Main Store')
    await user.click(screen.getByRole('button', { name: /new location/i }))
    await user.type(screen.getByLabelText('Code'), 'BAR_STORE')
    await user.type(screen.getByLabelText('Name'), 'Bar Store')
    await user.click(screen.getByRole('button', { name: /create location/i }))

    await waitFor(() => {
      expect(api.createLocation).toHaveBeenCalledWith({ code: 'BAR_STORE', name: 'Bar Store' })
    })
  })

  it('blocks an invalid location before calling the database', async () => {
    const user = userEvent.setup()
    renderPanel()

    await screen.findByText('Main Store')
    await user.click(screen.getByRole('button', { name: /new location/i }))
    await user.click(screen.getByRole('button', { name: /create location/i }))

    expect(await screen.findByText('Code is required.')).toBeInTheDocument()
    expect(screen.getByText('Name is required.')).toBeInTheDocument()
    expect(api.createLocation).not.toHaveBeenCalled()
  })

  it('deactivates a location without deleting it', async () => {
    const user = userEvent.setup()
    renderPanel()

    await screen.findByText('Main Store')
    await user.click(screen.getByRole('button', { name: /deactivate/i }))

    await waitFor(() => {
      expect(api.updateLocation).toHaveBeenCalledWith('l1', { is_active: false })
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/deactivated/i)
  })

  it('hides write controls from a storekeeper', async () => {
    renderPanel(['storekeeper'])

    await screen.findByText('Main Store')

    expect(screen.queryByRole('button', { name: /new location/i })).toBeNull()
    expect(screen.getByText(/read-only/i)).toBeInTheDocument()
  })
})
