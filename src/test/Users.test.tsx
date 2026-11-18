import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { Settings } from '@/pages/Settings'

const usersApi = vi.hoisted(() => ({
  listUsers: vi.fn(),
  listRoles: vi.fn(),
  listOutletScopes: vi.fn(),
  setUserStatus: vi.fn(),
  assignUserRole: vi.fn(),
  grantOutletScope: vi.fn(),
  revokeOutletScope: vi.fn(),
}))

const outletsApi = vi.hoisted(() => ({
  listOutlets: vi.fn(),
  createOutlet: vi.fn(),
  updateOutlet: vi.fn(),
}))

vi.mock('@/features/users/api', () => usersApi)
vi.mock('@/features/outlets/api', () => outletsApi)

const ADMIN = {
  id: 'u-admin',
  full_name: 'Ana Admin',
  status: 'active' as const,
  created_at: '2026-11-18T08:00:00.000Z',
  updated_at: '2026-11-18T08:00:00.000Z',
  roles: [{ code: 'system_admin', name: 'System Administrator' }],
}

const GM = {
  id: 'u-gm',
  full_name: 'Girma Manager',
  status: 'active' as const,
  created_at: '2026-11-18T08:00:00.000Z',
  updated_at: '2026-11-18T08:00:00.000Z',
  roles: [{ code: 'general_manager', name: 'General Manager' }],
}

const WAITER = {
  id: 'u-waiter',
  full_name: 'Woineshet Waiter',
  status: 'disabled' as const,
  created_at: '2026-11-18T08:00:00.000Z',
  updated_at: '2026-11-18T08:00:00.000Z',
  roles: [{ code: 'waiter', name: 'Waiter' }],
}

const ROLES = [
  { id: 'r1', code: 'system_admin', name: 'System Administrator', description: null },
  { id: 'r2', code: 'general_manager', name: 'General Manager', description: null },
  { id: 'r3', code: 'restaurant_manager', name: 'Restaurant Manager', description: null },
  { id: 'r4', code: 'waiter', name: 'Waiter', description: null },
]

const OUTLETS = [
  {
    id: 'o-main',
    code: 'MAIN',
    name: 'Main Restaurant',
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
  },
  {
    id: 'o-coffee',
    code: 'COFFEE',
    name: 'Coffee Shop',
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
  },
]

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

function renderSettings(roles: string[] = ['system_admin']) {
  return render(
    <AuthContext.Provider value={authValue(roles)}>
      <Settings />
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  outletsApi.listOutlets.mockResolvedValue(OUTLETS)
  outletsApi.createOutlet.mockResolvedValue(undefined)
  outletsApi.updateOutlet.mockResolvedValue(undefined)
  usersApi.listUsers.mockResolvedValue([ADMIN, GM, WAITER])
  usersApi.listRoles.mockResolvedValue(ROLES)
  usersApi.listOutletScopes.mockResolvedValue([
    { outlet_id: 'o-main', code: 'MAIN', name: 'Main Restaurant', is_active: true },
  ])
  usersApi.setUserStatus.mockResolvedValue(undefined)
  usersApi.assignUserRole.mockResolvedValue(undefined)
  usersApi.grantOutletScope.mockResolvedValue(undefined)
  usersApi.revokeOutletScope.mockResolvedValue(undefined)
})

describe('Settings — users', () => {
  it('lists accounts with their roles and statuses', async () => {
    renderSettings()

    expect(await screen.findByText('Girma Manager')).toBeInTheDocument()
    expect(screen.getByText('Woineshet Waiter')).toBeInTheDocument()
    expect(screen.getAllByText('General Manager').length).toBeGreaterThan(0)
    expect(screen.getByText(/3 accounts · 2 active/i)).toBeInTheDocument()
  })

  it('shows an error with a retry action when loading fails', async () => {
    usersApi.listUsers.mockRejectedValue(new Error('You do not have permission.'))

    renderSettings()

    expect(await screen.findByText(/could not load users/i)).toBeInTheDocument()
    expect(screen.getByText('You do not have permission.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('disables an account without deleting it', async () => {
    const user = userEvent.setup()
    renderSettings()

    await screen.findByText('Girma Manager')
    await user.click(screen.getByRole('button', { name: 'Deactivate Girma Manager' }))

    await waitFor(() => {
      expect(usersApi.setUserStatus).toHaveBeenCalledWith('u-gm', 'disabled')
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/Girma Manager disabled/i)
  })

  it('reactivates a disabled account', async () => {
    const user = userEvent.setup()
    renderSettings()

    await screen.findByText('Woineshet Waiter')
    await user.click(screen.getByRole('button', { name: 'Reactivate Woineshet Waiter' }))

    await waitFor(() => {
      expect(usersApi.setUserStatus).toHaveBeenCalledWith('u-waiter', 'active')
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/Woineshet Waiter reactivated/i)
  })

  it('assigns a role through the admin RPC', async () => {
    const user = userEvent.setup()
    renderSettings()

    await screen.findByText('Woineshet Waiter')
    await user.selectOptions(
      screen.getByLabelText('Role for Woineshet Waiter'),
      'restaurant_manager',
    )
    await user.click(screen.getByRole('button', { name: 'Assign role to Woineshet Waiter' }))

    await waitFor(() => {
      expect(usersApi.assignUserRole).toHaveBeenCalledWith('u-waiter', 'restaurant_manager')
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      /Restaurant Manager assigned to Woineshet Waiter/i,
    )
  })

  it('blocks assigning a role the account already has', async () => {
    const user = userEvent.setup()
    renderSettings()

    await screen.findByText('Ana Admin')
    await user.selectOptions(screen.getByLabelText('Role for Ana Admin'), 'system_admin')
    await user.click(screen.getByRole('button', { name: 'Assign role to Ana Admin' }))

    expect(await screen.findByText('That role is already assigned.')).toBeInTheDocument()
    expect(usersApi.assignUserRole).not.toHaveBeenCalled()
  })

  it('grants and revokes outlet access', async () => {
    const user = userEvent.setup()
    renderSettings()

    await screen.findByText('Girma Manager')
    await user.click(
      screen.getByRole('button', { name: 'Manage outlet access for Girma Manager' }),
    )

    expect(
      await screen.findByRole('heading', { name: /outlet access for Girma Manager/i }),
    ).toBeInTheDocument()

    const coffee = await screen.findByLabelText('Access to Coffee Shop')
    expect(coffee).not.toBeChecked()
    await user.click(coffee)

    await waitFor(() => {
      expect(usersApi.grantOutletScope).toHaveBeenCalledWith('u-gm', 'o-coffee', 'u1')
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/Coffee Shop access granted/i)

    const main = await screen.findByLabelText('Access to Main Restaurant')
    expect(main).toBeChecked()
    await user.click(main)

    await waitFor(() => {
      expect(usersApi.revokeOutletScope).toHaveBeenCalledWith('u-gm', 'o-main')
    })
  })

  it('shows the database permission error when a change is rejected', async () => {
    usersApi.setUserStatus.mockRejectedValue(
      new Error('You do not have permission to change user accounts.'),
    )
    const user = userEvent.setup()
    renderSettings()

    await screen.findByText('Girma Manager')
    await user.click(screen.getByRole('button', { name: 'Deactivate Girma Manager' }))

    expect(
      await screen.findByText('You do not have permission to change user accounts.'),
    ).toBeInTheDocument()
  })

  it('hides write controls from a non-admin manager', async () => {
    renderSettings(['general_manager'])

    await screen.findByText('Girma Manager')

    expect(screen.queryByRole('button', { name: /manage outlet access/i })).toBeNull()
    expect(screen.queryByLabelText(/^role for /i)).toBeNull()
    expect(screen.queryByRole('button', { name: /deactivate|reactivate/i })).toBeNull()
    expect(screen.getAllByText(/read-only/i).length).toBeGreaterThan(0)
  })
})
