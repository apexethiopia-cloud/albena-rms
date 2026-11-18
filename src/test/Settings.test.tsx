import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { Settings } from '@/pages/Settings'

const api = vi.hoisted(() => ({
  listOutlets: vi.fn(),
  createOutlet: vi.fn(),
  updateOutlet: vi.fn(),
}))

vi.mock('@/features/outlets/api', () => api)

const OUTLET = {
  id: 'o1',
  code: 'MAIN',
  name: 'Main Restaurant',
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

function renderSettings(roles: string[] = ['system_admin']) {
  return render(
    <AuthContext.Provider value={authValue(roles)}>
      <Settings />
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listOutlets.mockResolvedValue([OUTLET])
  api.createOutlet.mockResolvedValue(undefined)
  api.updateOutlet.mockResolvedValue(undefined)
})

describe('Settings — outlets', () => {
  it('lists outlets from the database', async () => {
    renderSettings()

    expect(await screen.findByText('Main Restaurant')).toBeInTheDocument()
    expect(screen.getByText('MAIN')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText(/1 outlet · 1 active/i)).toBeInTheDocument()
  })

  it('shows an error with a retry action when loading fails', async () => {
    api.listOutlets.mockRejectedValue(new Error('You do not have permission.'))

    renderSettings()

    expect(await screen.findByText(/could not load outlets/i)).toBeInTheDocument()
    expect(screen.getByText('You do not have permission.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('creates an outlet after client-side validation', async () => {
    const user = userEvent.setup()
    renderSettings()

    await screen.findByText('Main Restaurant')
    await user.click(screen.getByRole('button', { name: /new outlet/i }))
    await user.type(screen.getByLabelText('Code'), 'terrace')
    await user.type(screen.getByLabelText('Name'), 'Terrace Restaurant')
    await user.click(screen.getByRole('button', { name: /create outlet/i }))

    await waitFor(() => {
      expect(api.createOutlet).toHaveBeenCalledWith({
        code: 'TERRACE',
        name: 'Terrace Restaurant',
      })
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/TERRACE created/i)
  })

  it('blocks submission when the form is invalid', async () => {
    const user = userEvent.setup()
    renderSettings()

    await screen.findByText('Main Restaurant')
    await user.click(screen.getByRole('button', { name: /new outlet/i }))
    await user.click(screen.getByRole('button', { name: /create outlet/i }))

    expect(await screen.findByText('Code is required.')).toBeInTheDocument()
    expect(screen.getByText('Name is required.')).toBeInTheDocument()
    expect(api.createOutlet).not.toHaveBeenCalled()
  })

  it('deactivates an outlet without deleting it', async () => {
    const user = userEvent.setup()
    renderSettings()

    await screen.findByText('Main Restaurant')
    await user.click(screen.getByRole('button', { name: /deactivate/i }))

    await waitFor(() => {
      expect(api.updateOutlet).toHaveBeenCalledWith('o1', { is_active: false })
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/deactivated/i)
  })

  it('edits an existing outlet', async () => {
    const user = userEvent.setup()
    renderSettings()

    await screen.findByText('Main Restaurant')
    await user.click(screen.getByRole('button', { name: /edit/i }))

    const name = screen.getByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Main Dining Room')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(api.updateOutlet).toHaveBeenCalledWith('o1', {
        code: 'MAIN',
        name: 'Main Dining Room',
      })
    })
  })

  it('hides write controls from users without a management role', async () => {
    renderSettings(['waiter'])

    await screen.findByText('Main Restaurant')

    expect(screen.queryByRole('button', { name: /new outlet/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /deactivate/i })).toBeNull()
    expect(screen.getByText(/read-only/i)).toBeInTheDocument()
  })
})
