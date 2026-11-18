import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { Purchasing } from '@/pages/Purchasing'

const stockApi = vi.hoisted(() => ({
  listGrns: vi.fn(),
  createGrn: vi.fn(),
  postGrn: vi.fn(),
}))

const suppliersApi = vi.hoisted(() => ({
  listSuppliers: vi.fn(),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
}))

const itemsApi = vi.hoisted(() => ({
  listItems: vi.fn(),
  listUnits: vi.fn(),
  listItemUnitConversions: vi.fn(),
  listCategories: vi.fn(),
  createItem: vi.fn(),
  createItemUnitConversion: vi.fn(),
  updateItem: vi.fn(),
  updateItemUnitConversion: vi.fn(),
}))

const procurementApi = vi.hoisted(() => ({
  listPurchaseRequests: vi.fn(),
  listPurchaseOrders: vi.fn(),
  createPurchaseRequest: vi.fn(),
  submitPurchaseRequest: vi.fn(),
  decidePurchaseRequest: vi.fn(),
  createPurchaseOrder: vi.fn(),
  approvePurchaseOrder: vi.fn(),
  markPurchaseOrderOrdered: vi.fn(),
  closePurchaseOrder: vi.fn(),
}))

vi.mock('@/features/stock/api', () => stockApi)
vi.mock('@/features/suppliers/api', () => suppliersApi)
vi.mock('@/features/items/api', () => itemsApi)
vi.mock('@/features/procurement/api', () => procurementApi)
vi.mock('@/features/locations/api', () => ({
  listLocations: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))

const { listLocations } = await import('@/features/locations/api')

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

const UNITS = [
  { id: 'u-g', code: 'g', name: 'Gram', dimension: 'mass', is_base: true, base_factor: 1 },
  { id: 'u-kg', code: 'kg', name: 'Kilogram', dimension: 'mass', is_base: false, base_factor: 1000 },
]

const ITEMS = [
  {
    id: 'i-tomato',
    code: 'TOMATO',
    name: 'Tomato, fresh',
    category_id: null,
    base_unit_id: 'u-g',
    purchase_unit_id: 'u-kg',
    reorder_level: 5000,
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
  },
]

const LOCATIONS = [
  {
    id: 'l-main',
    code: 'MAIN_STORE',
    name: 'Main Store',
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
  },
]

const DRAFT_GRN = {
  id: 'grn-1',
  grn_number: 'GRN-0001',
  supplier_id: 's1',
  invoice_number: 'INV-77',
  received_date: '2026-11-18',
  location_id: 'l-main',
  notes: null,
  created_by: 'u1',
  created_at: '2026-11-18T10:00:00.000Z',
  posted_by: null,
  posted_at: null,
  grn_lines: [
    {
      id: 'gl-1',
      grn_id: 'grn-1',
      item_id: 'i-tomato',
      unit_id: 'u-kg',
      quantity: 2,
      unit_cost: 120,
      line_total: 240,
      base_quantity: null,
      base_unit_cost: null,
      created_at: '2026-11-18T10:00:00.000Z',
    },
  ],
}

function authValue(roles: string[]): AuthContextValue {
  return {
    state: {
      status: 'signed-in',
      user: {
        id: 'u1',
        email: 'buyer@example.com',
        fullName: 'Test Buyer',
        status: 'active',
        roles,
      },
    },
    signIn: async () => ({ error: null }),
    signOut: async () => {},
  }
}

function renderPage(roles: string[] = ['purchasing_officer']) {
  return render(
    <AuthContext.Provider value={authValue(roles)}>
      <Purchasing />
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()

  stockApi.listGrns.mockResolvedValue([])
  stockApi.createGrn.mockResolvedValue('grn-1')
  stockApi.postGrn.mockResolvedValue(undefined)

  suppliersApi.listSuppliers.mockResolvedValue([SUPPLIER])
  suppliersApi.createSupplier.mockResolvedValue(undefined)
  suppliersApi.updateSupplier.mockResolvedValue(undefined)

  itemsApi.listItems.mockResolvedValue(ITEMS)
  itemsApi.listUnits.mockResolvedValue(UNITS)
  itemsApi.listItemUnitConversions.mockResolvedValue([])
  itemsApi.listCategories.mockResolvedValue([])
  itemsApi.createItem.mockResolvedValue(undefined)
  itemsApi.createItemUnitConversion.mockResolvedValue(undefined)
  itemsApi.updateItem.mockResolvedValue(undefined)
  itemsApi.updateItemUnitConversion.mockResolvedValue(undefined)

  procurementApi.listPurchaseRequests.mockResolvedValue([])
  procurementApi.listPurchaseOrders.mockResolvedValue([])

  vi.mocked(listLocations).mockResolvedValue(LOCATIONS)
})

describe('Purchasing — goods receiving', () => {
  it('lists receiving notes and distinguishes drafts from posted documents', async () => {
    stockApi.listGrns.mockResolvedValue([
      DRAFT_GRN,
      {
        ...DRAFT_GRN,
        id: 'grn-2',
        grn_number: 'GRN-0002',
        posted_by: 'u1',
        posted_at: '2026-11-18T11:00:00.000Z',
        grn_lines: [
          {
            ...DRAFT_GRN.grn_lines[0],
            id: 'gl-2',
            grn_id: 'grn-2',
            base_quantity: 2000,
            base_unit_cost: 0.12,
          },
        ],
      },
    ])

    renderPage()

    const section = await screen.findByRole('region', { name: /goods receiving notes/i })
    expect(await within(section).findByText('GRN-0001')).toBeInTheDocument()
    expect(within(section).getByText('GRN-0002')).toBeInTheDocument()
    expect(within(section).getByText('Draft')).toBeInTheDocument()
    expect(within(section).getByText('Posted')).toBeInTheDocument()
    expect(within(section).getByText(/2 documents · 1 draft/i)).toBeInTheDocument()
  })

  it('creates a GRN draft with normalized header and line values', async () => {
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /goods receiving notes/i })
    await within(section).findByText(/no receiving notes yet/i)
    await user.click(within(section).getByRole('button', { name: /new grn/i }))

    await user.type(screen.getByLabelText('GRN number'), 'grn-0001')
    await user.selectOptions(screen.getByLabelText('Supplier'), 's1')
    await user.type(screen.getByLabelText('Supplier invoice'), 'INV-77')
    await user.selectOptions(screen.getByLabelText('Item for line 1'), 'i-tomato')
    await user.selectOptions(screen.getByLabelText('Unit for line 1'), 'u-kg')
    await user.type(screen.getByLabelText('Quantity for line 1'), '2')
    await user.type(screen.getByLabelText('Unit cost for line 1'), '120')
    await user.click(within(section).getByRole('button', { name: /save draft/i }))

    await waitFor(() => {
      expect(stockApi.createGrn).toHaveBeenCalledWith({
        grnNumber: 'GRN-0001',
        supplierId: 's1',
        invoiceNumber: 'INV-77',
        receivedDate: expect.any(String),
        locationId: 'l-main',
        notes: null,
        lines: [{ itemId: 'i-tomato', unitId: 'u-kg', quantity: 2, unitCost: 120 }],
      })
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/GRN GRN-0001 saved as a draft/i)
  })

  it('blocks an incomplete line before calling the database', async () => {
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /goods receiving notes/i })
    await within(section).findByText(/no receiving notes yet/i)
    await user.click(within(section).getByRole('button', { name: /new grn/i }))
    await user.click(within(section).getByRole('button', { name: /save draft/i }))

    expect(stockApi.createGrn).not.toHaveBeenCalled()
    expect(await within(section).findByText(/enter a grn number/i)).toBeInTheDocument()
    expect(within(section).getByText(/choose a supplier/i)).toBeInTheDocument()
    expect(within(section).getByText(/choose an item/i)).toBeInTheDocument()
  })

  it('posts a draft GRN only after a second confirmation', async () => {
    stockApi.listGrns.mockResolvedValue([DRAFT_GRN])
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /goods receiving notes/i })
    expect(await within(section).findByText('GRN-0001')).toBeInTheDocument()

    await user.click(within(section).getByRole('button', { name: 'Post' }))
    expect(stockApi.postGrn).not.toHaveBeenCalled()

    await user.click(within(section).getByRole('button', { name: /confirm post/i }))
    await waitFor(() => {
      expect(stockApi.postGrn).toHaveBeenCalledWith('grn-1')
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/GRN GRN-0001 posted/i)
  })

  it('shows the database duplicate-posting error', async () => {
    stockApi.listGrns.mockResolvedValue([DRAFT_GRN])
    stockApi.postGrn.mockRejectedValue(
      new Error('That document is already posted. Refresh and try again.'),
    )
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /goods receiving notes/i })
    await within(section).findByText('GRN-0001')
    await user.click(within(section).getByRole('button', { name: 'Post' }))
    await user.click(within(section).getByRole('button', { name: /confirm post/i }))

    expect(await screen.findByText(/already posted/i)).toBeInTheDocument()
  })

  it('hides GRN write controls from a role without posting rights', async () => {
    renderPage(['waiter'])

    const section = await screen.findByRole('region', { name: /goods receiving notes/i })
    expect(within(section).queryByRole('button', { name: /new grn/i })).toBeNull()
    expect(within(section).getByText(/read-only/i)).toBeInTheDocument()
  })
})
