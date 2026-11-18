import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { Purchasing } from '@/pages/Purchasing'

const api = vi.hoisted(() => ({
  listSuppliers: vi.fn(),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
}))

vi.mock('@/features/suppliers/api', () => api)

vi.mock('@/features/items/api', () => ({
  listItems: vi.fn().mockResolvedValue([]),
  listUnits: vi.fn().mockResolvedValue([]),
  listItemUnitConversions: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/features/locations/api', () => ({
  listLocations: vi.fn().mockResolvedValue([]),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))

vi.mock('@/features/stock/api', () => ({
  listGrns: vi.fn().mockResolvedValue([]),
  createGrn: vi.fn(),
  postGrn: vi.fn(),
  listPurchaseOrderReceipts: vi.fn().mockResolvedValue([]),
  listSivs: vi.fn().mockResolvedValue([]),
  listStockBalances: vi.fn().mockResolvedValue([]),
  listStockMovements: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/features/procurement/api', () => ({
  listPurchaseRequests: vi.fn().mockResolvedValue([]),
  listPurchaseOrders: vi.fn().mockResolvedValue([]),
  createPurchaseRequest: vi.fn(),
  submitPurchaseRequest: vi.fn(),
  decidePurchaseRequest: vi.fn(),
  createPurchaseOrder: vi.fn(),
  approvePurchaseOrder: vi.fn(),
  markPurchaseOrderOrdered: vi.fn(),
  closePurchaseOrder: vi.fn(),
}))

const SUPPLIER = {
  id: 's1',
  code: 'FRESH',
  name: 'Fresh Foods PLC',
  contact_name: 'Hanna',
  phone: '+251 911 234 567',
  email: 'orders@freshfoods.et',
  address: 'Bole Road',
  tax_number: 'TIN-001',
  payment_terms: '30 days',
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

function renderPage(roles: string[] = ['system_admin']) {
  return render(
    <AuthContext.Provider value={authValue(roles)}>
      <Purchasing />
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listSuppliers.mockResolvedValue([SUPPLIER])
  api.createSupplier.mockResolvedValue(undefined)
  api.updateSupplier.mockResolvedValue(undefined)
})

describe('Purchasing — suppliers', () => {
  it('lists suppliers from the database', async () => {
    renderPage()

    expect(await screen.findByText('Fresh Foods PLC')).toBeInTheDocument()
    expect(screen.getByText('FRESH')).toBeInTheDocument()
    expect(screen.getByText('Hanna')).toBeInTheDocument()
    expect(screen.getByText(/1 supplier · 1 active/i)).toBeInTheDocument()
  })

  it('tells the owner to apply the migration when the table is missing', async () => {
    api.listSuppliers.mockRejectedValue(
      new Error('This table is not in the database yet. Apply the pending Supabase migration.'),
    )

    renderPage()

    const section = await screen.findByRole('region', { name: 'Suppliers' })
    expect(await within(section).findByText(/could not load suppliers/i)).toBeInTheDocument()
    expect(within(section).getByText(/apply the pending supabase migration/i)).toBeInTheDocument()
  })

  it('creates a supplier with normalized values', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Fresh Foods PLC')
    await user.click(screen.getByRole('button', { name: /new supplier/i }))
    await user.type(screen.getByLabelText('Code'), 'dairy-co')
    await user.type(screen.getByLabelText('Supplier name'), 'Dairy Co')
    await user.type(screen.getByLabelText('Phone'), '+251 911 000 111')
    await user.type(screen.getByLabelText('Email'), 'SALES@Dairy.Co')
    await user.click(screen.getByRole('button', { name: /create supplier/i }))

    await waitFor(() => {
      expect(api.createSupplier).toHaveBeenCalledWith({
        code: 'DAIRY-CO',
        name: 'Dairy Co',
        contactName: '',
        phone: '+251 911 000 111',
        email: 'sales@dairy.co',
        address: '',
        taxNumber: '',
        paymentTerms: '',
      })
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/DAIRY-CO created/i)
  })

  it('blocks an invalid supplier before calling the database', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Fresh Foods PLC')
    await user.click(screen.getByRole('button', { name: /new supplier/i }))
    await user.type(screen.getByLabelText('Email'), 'nope')
    await user.click(screen.getByRole('button', { name: /create supplier/i }))

    expect(await screen.findByText('Code is required.')).toBeInTheDocument()
    expect(screen.getByText('Supplier name is required.')).toBeInTheDocument()
    expect(screen.getByText(/valid email/i)).toBeInTheDocument()
    expect(api.createSupplier).not.toHaveBeenCalled()
  })

  it('edits an existing supplier', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Fresh Foods PLC')
    await user.click(screen.getByRole('button', { name: /edit/i }))

    expect(screen.getByLabelText('Contact name')).toHaveValue('Hanna')
    const name = screen.getByLabelText('Supplier name')
    await user.clear(name)
    await user.type(name, 'Fresh Foods Trading')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(api.updateSupplier).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ name: 'Fresh Foods Trading', code: 'FRESH' }),
      )
    })
  })

  it('deactivates a supplier without deleting it', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Fresh Foods PLC')
    await user.click(screen.getByRole('button', { name: /deactivate/i }))

    await waitFor(() => {
      expect(api.updateSupplier).toHaveBeenCalledWith('s1', { is_active: false })
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/deactivated/i)
  })

  it('allows a purchasing officer to manage suppliers', async () => {
    renderPage(['purchasing_officer'])

    await screen.findByText('Fresh Foods PLC')

    expect(screen.getByRole('button', { name: /new supplier/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument()
  })

  it('hides write controls from a waiter', async () => {
    renderPage(['waiter'])

    await screen.findByText('Fresh Foods PLC')

    const section = screen.getByRole('region', { name: 'Suppliers' })
    expect(within(section).queryByRole('button', { name: /new supplier/i })).toBeNull()
    expect(within(section).queryByRole('button', { name: /edit/i })).toBeNull()
    expect(within(section).getByText(/read-only/i)).toBeInTheDocument()
  })
})
