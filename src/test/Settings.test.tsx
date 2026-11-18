import { render, screen, waitFor, within } from '@testing-library/react'
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

vi.mock('@/features/users/api', () => ({
  listUsers: vi.fn().mockResolvedValue([]),
  listRoles: vi.fn().mockResolvedValue([]),
  listOutletScopes: vi.fn().mockResolvedValue([]),
  setUserStatus: vi.fn(),
  assignUserRole: vi.fn(),
  grantOutletScope: vi.fn(),
  revokeOutletScope: vi.fn(),
}))

const settingsApi = vi.hoisted(() => ({
  getBusinessSettings: vi.fn(),
  updateBusinessSettings: vi.fn(),
}))

vi.mock('@/features/settings/api', () => settingsApi)

const OUTLET = {
  id: 'o1',
  code: 'MAIN',
  name: 'Main Restaurant',
  is_active: true,
  created_at: '2026-11-18T08:00:00.000Z',
  updated_at: '2026-11-18T08:00:00.000Z',
}

const BUSINESS_SETTINGS = {
  id: true,
  business_name: 'Albena Restaurant',
  tin: 'TIN-001',
  address: 'Bole, Addis Ababa',
  phone: '+251911000000',
  vat_rate: '15.00',
  receipt_footer: 'Thank you',
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
  settingsApi.getBusinessSettings.mockResolvedValue(BUSINESS_SETTINGS)
  settingsApi.updateBusinessSettings.mockResolvedValue(undefined)
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
    expect(screen.getAllByText('You do not have permission.').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /try again/i }).length).toBeGreaterThan(0)
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
    expect(screen.getAllByText(/read-only/i).length).toBeGreaterThan(0)
  })

  it('hides write controls from a General Manager, because the policy allows admin only', async () => {
    renderSettings(['general_manager'])

    await screen.findByText('Main Restaurant')

    expect(screen.queryByRole('button', { name: /new outlet/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /deactivate/i })).toBeNull()
  })
})

describe('Settings — business and receipts', () => {
  it('loads the identity printed on receipts', async () => {
    renderSettings()

    const section = await screen.findByRole('region', {
      name: /business & receipts/i,
    })

    expect(
      await within(section).findByDisplayValue('Albena Restaurant'),
    ).toBeInTheDocument()
    expect(within(section).getByLabelText('TIN')).toHaveValue('TIN-001')
    expect(within(section).getByLabelText('VAT rate')).toHaveValue('15')
    expect(within(section).getByLabelText('Receipt footer')).toHaveValue('Thank you')
  })

  it('saves the business identity and VAT rate', async () => {
    const user = userEvent.setup()
    renderSettings()

    const section = await screen.findByRole('region', {
      name: /business & receipts/i,
    })
    const name = await within(section).findByLabelText('Business name')
    await user.clear(name)
    await user.type(name, 'Albena Lakeview')

    await user.click(within(section).getByRole('button', { name: /save settings/i }))

    await waitFor(() =>
      expect(settingsApi.updateBusinessSettings).toHaveBeenCalledWith({
        businessName: 'Albena Lakeview',
        tin: 'TIN-001',
        address: 'Bole, Addis Ababa',
        phone: '+251911000000',
        vatRate: 15,
        receiptFooter: 'Thank you',
      }),
    )
    expect(await within(section).findByText(/were saved/i)).toBeInTheDocument()
  })

  it('blocks an invalid VAT rate', async () => {
    const user = userEvent.setup()
    renderSettings()

    const section = await screen.findByRole('region', {
      name: /business & receipts/i,
    })
    const vat = await within(section).findByLabelText('VAT rate')
    await user.clear(vat)
    await user.type(vat, '150')
    await user.click(within(section).getByRole('button', { name: /save settings/i }))

    expect(
      await within(section).findByText(/between 0 and 100/i),
    ).toBeInTheDocument()
    expect(settingsApi.updateBusinessSettings).not.toHaveBeenCalled()
  })

  it('shows the settings read-only for a waiter', async () => {
    renderSettings(['waiter'])

    const section = await screen.findByRole('region', {
      name: /business & receipts/i,
    })

    expect(await within(section).findByText('Albena Restaurant')).toBeInTheDocument()
    expect(
      within(section).queryByRole('button', { name: /save settings/i }),
    ).not.toBeInTheDocument()
    expect(within(section).getByText(/read-only/i)).toBeInTheDocument()
  })
})
