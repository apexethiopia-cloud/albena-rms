import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { Inventory } from '@/pages/Inventory'

const stockApi = vi.hoisted(() => ({
  listStockBalances: vi.fn(),
  listStockMovements: vi.fn(),
  listSivs: vi.fn(),
  createSiv: vi.fn(),
  updateSiv: vi.fn(),
  deleteSiv: vi.fn(),
  postSiv: vi.fn(),
  listInventoryAdjustments: vi.fn(),
  createInventoryAdjustment: vi.fn(),
  submitInventoryAdjustment: vi.fn(),
  decideInventoryAdjustment: vi.fn(),
  postInventoryAdjustment: vi.fn(),
  listInventoryCounts: vi.fn(),
  createInventoryCount: vi.fn(),
  submitInventoryCount: vi.fn(),
  decideInventoryCount: vi.fn(),
  postInventoryCount: vi.fn(),
  listReorderStatus: vi.fn(),
}))

const itemsApi = vi.hoisted(() => ({
  listItems: vi.fn(),
  listUnits: vi.fn(),
  listCategories: vi.fn(),
  listItemUnitConversions: vi.fn(),
  createItem: vi.fn(),
  createItemUnitConversion: vi.fn(),
  updateItem: vi.fn(),
  updateItemUnitConversion: vi.fn(),
}))

vi.mock('@/features/stock/api', () => stockApi)
vi.mock('@/features/items/api', () => itemsApi)
vi.mock('@/features/categories/api', () => ({
  listCategories: vi.fn().mockResolvedValue([]),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
}))
vi.mock('@/features/locations/api', () => ({
  listLocations: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))

const { listLocations } = await import('@/features/locations/api')

const UNITS = [
  { id: 'u-g', code: 'g', name: 'Gram', dimension: 'mass', is_base: true, base_factor: 1 },
  { id: 'u-kg', code: 'kg', name: 'Kilogram', dimension: 'mass', is_base: false, base_factor: 1000 },
  { id: 'u-piece', code: 'piece', name: 'Piece', dimension: 'count', is_base: true, base_factor: 1 },
  { id: 'u-box', code: 'box', name: 'Box', dimension: 'count', is_base: false, base_factor: null },
]

const ITEMS = [
  {
    id: 'i-tomato',
    code: 'TOMATO',
    name: 'Tomato, fresh',
    category_id: null,
    base_unit_id: 'u-g',
    purchase_unit_id: null,
    reorder_level: 5000,
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
  },
  {
    id: 'i-egg',
    code: 'EGG',
    name: 'Egg',
    category_id: null,
    base_unit_id: 'u-piece',
    purchase_unit_id: 'u-box',
    reorder_level: 24,
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
  {
    id: 'l-kitchen',
    code: 'KITCHEN_STORE',
    name: 'Kitchen Store',
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
  },
]

const BALANCE = {
  item_id: 'i-tomato',
  item_code: 'TOMATO',
  item_name: 'Tomato, fresh',
  base_unit_code: 'g',
  location_id: 'l-main',
  location_code: 'MAIN_STORE',
  location_name: 'Main Store',
  quantity: 2000,
  total_value: 1250,
  last_movement_at: '2026-11-18T10:00:00.000Z',
}

const DRAFT_SIV = {
  id: 'siv-1',
  siv_number: 'SIV-0001',
  issue_date: '2026-11-18',
  source_location_id: 'l-main',
  destination_location_id: 'l-kitchen',
  notes: null,
  requested_by: 'u1',
  created_at: '2026-11-18T10:00:00.000Z',
  posted_by: null,
  posted_at: null,
  siv_lines: [
    {
      id: 'sl-1',
      siv_id: 'siv-1',
      item_id: 'i-tomato',
      unit_id: 'u-g',
      quantity: 2000,
      base_quantity: null,
      posted_cost: null,
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
        email: 'store@example.com',
        fullName: 'Test Storekeeper',
        status: 'active',
        roles,
      },
    },
    signIn: async () => ({ error: null }),
    signOut: async () => {},
  }
}

function renderPage(roles: string[] = ['storekeeper']) {
  return render(
    <AuthContext.Provider value={authValue(roles)}>
      <Inventory />
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  stockApi.listStockBalances.mockResolvedValue([BALANCE])
  stockApi.listStockMovements.mockResolvedValue([])
  stockApi.listSivs.mockResolvedValue([])
  stockApi.createSiv.mockResolvedValue('siv-1')
  stockApi.updateSiv.mockResolvedValue(undefined)
  stockApi.deleteSiv.mockResolvedValue(undefined)
  stockApi.postSiv.mockResolvedValue(undefined)
  stockApi.listInventoryAdjustments.mockResolvedValue([])
  stockApi.listInventoryCounts.mockResolvedValue([])
  stockApi.listReorderStatus.mockResolvedValue([])
  stockApi.createInventoryAdjustment.mockResolvedValue('adj-1')
  stockApi.submitInventoryAdjustment.mockResolvedValue(undefined)
  stockApi.decideInventoryAdjustment.mockResolvedValue(undefined)
  stockApi.postInventoryAdjustment.mockResolvedValue(undefined)
  stockApi.createInventoryCount.mockResolvedValue('count-1')
  stockApi.submitInventoryCount.mockResolvedValue(undefined)
  stockApi.decideInventoryCount.mockResolvedValue(undefined)
  stockApi.postInventoryCount.mockResolvedValue(undefined)

  itemsApi.listItems.mockResolvedValue(ITEMS)
  itemsApi.listUnits.mockResolvedValue(UNITS)
  itemsApi.listCategories.mockResolvedValue([])
  itemsApi.listItemUnitConversions.mockResolvedValue([
    { item_id: 'i-egg', unit_id: 'u-box', base_factor: 12 },
  ])
  itemsApi.createItem.mockResolvedValue(undefined)
  itemsApi.createItemUnitConversion.mockResolvedValue(undefined)
  itemsApi.updateItem.mockResolvedValue(undefined)
  itemsApi.updateItemUnitConversion.mockResolvedValue(undefined)

  vi.mocked(listLocations).mockResolvedValue(LOCATIONS)
})

describe('Inventory — stock ledger', () => {
  it('shows ledger-derived balances and movement history', async () => {
    renderPage()

    const section = await screen.findByRole('region', { name: /stock balances and ledger/i })
    const row = await within(section).findByRole('row', { name: /tomato, fresh/i })
    expect(within(row).getByText('Main Store')).toBeInTheDocument()
    expect(within(row).getByText(/2,000 g/)).toBeInTheDocument()
    expect(within(row).getByText(/1,250\.00/)).toBeInTheDocument()
    expect(within(section).getByText(/1 item with stock/i)).toBeInTheDocument()
    expect(within(section).getByText(/no stock movements yet/i)).toBeInTheDocument()
  })

  it('creates a SIV draft with normalized values', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('region', { name: /store issue vouchers/i })
    await user.click(screen.getByRole('button', { name: /new siv/i }))

    expect(screen.getByText(/number assigned automatically when saved/i)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Item for SIV line 1'), 'i-tomato')
    await user.clear(screen.getByLabelText('Quantity for SIV line 1'))
    await user.type(screen.getByLabelText('Quantity for SIV line 1'), '2')
    await user.click(screen.getByRole('button', { name: /save draft/i }))

    await waitFor(() => {
      expect(stockApi.createSiv).toHaveBeenCalledWith({
        issueDate: expect.any(String),
        sourceLocationId: 'l-main',
        destinationLocationId: 'l-kitchen',
        notes: null,
        lines: [{ itemId: 'i-tomato', unitId: 'u-g', quantity: 2 }],
      })
    })
  })

  it('prefills a draft SIV and updates it through the update RPC', async () => {
    stockApi.listSivs.mockResolvedValue([DRAFT_SIV])
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /store issue vouchers/i })
    await user.click(await within(section).findByRole('button', { name: /edit siv siv-0001/i }))
    expect(within(section).getByText('Edit store issue voucher')).toBeInTheDocument()
    expect(screen.queryByLabelText('SIV number')).toBeNull()
    expect(screen.getByLabelText('Source location')).toHaveValue('l-main')
    expect(screen.getByLabelText('Destination location')).toHaveValue('l-kitchen')
    expect(screen.getByLabelText('Quantity for SIV line 1')).toHaveValue('2000')

    await user.clear(screen.getByLabelText('Quantity for SIV line 1'))
    await user.type(screen.getByLabelText('Quantity for SIV line 1'), '1000')
    await user.click(within(section).getByRole('button', { name: /save draft/i }))

    await waitFor(() => {
      expect(stockApi.updateSiv).toHaveBeenCalledWith('siv-1', {
        issueDate: '2026-11-18',
        sourceLocationId: 'l-main',
        destinationLocationId: 'l-kitchen',
        notes: null,
        lines: [{ itemId: 'i-tomato', unitId: 'u-g', quantity: 1000 }],
      })
    })
    expect(stockApi.createSiv).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent(/SIV draft updated/i)
  })

  it('keeps source and destination validation when editing a SIV', async () => {
    stockApi.listSivs.mockResolvedValue([DRAFT_SIV])
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /store issue vouchers/i })
    await user.click(await within(section).findByRole('button', { name: /edit siv siv-0001/i }))
    await user.selectOptions(screen.getByLabelText('Destination location'), 'l-main')
    await user.click(within(section).getByRole('button', { name: /save draft/i }))

    expect(stockApi.updateSiv).not.toHaveBeenCalled()
    expect(within(section).getByText(/different/i)).toBeInTheDocument()
  })

  it('deletes a draft SIV only after confirmation', async () => {
    stockApi.listSivs.mockResolvedValue([DRAFT_SIV])
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /store issue vouchers/i })
    await user.click(await within(section).findByRole('button', { name: /delete siv siv-0001/i }))
    expect(within(section).getByText('Delete this draft?')).toBeInTheDocument()
    expect(stockApi.deleteSiv).not.toHaveBeenCalled()

    await user.click(within(section).getByRole('button', { name: /confirm delete/i }))
    await waitFor(() => {
      expect(stockApi.deleteSiv).toHaveBeenCalledWith('siv-1')
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/SIV SIV-0001 deleted/i)
  })

  it('hides edit and delete actions on a posted SIV', async () => {
    stockApi.listSivs.mockResolvedValue([
      {
        ...DRAFT_SIV,
        id: 'siv-2',
        siv_number: 'SIV-0002',
        posted_by: 'u1',
        posted_at: '2026-11-18T11:00:00.000Z',
      },
    ])
    renderPage()

    const section = await screen.findByRole('region', { name: /store issue vouchers/i })
    expect(await within(section).findByText('SIV-0002')).toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: /edit siv siv-0002/i })).toBeNull()
    expect(within(section).queryByRole('button', { name: /delete siv siv-0002/i })).toBeNull()
  })

  it('posts a draft SIV only after a second confirmation', async () => {
    stockApi.listSivs.mockResolvedValue([DRAFT_SIV])
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /store issue vouchers/i })
    expect(await within(section).findByText('SIV-0001')).toBeInTheDocument()

    await user.click(within(section).getByRole('button', { name: 'Post' }))
    expect(stockApi.postSiv).not.toHaveBeenCalled()

    await user.click(within(section).getByRole('button', { name: /confirm post/i }))
    await waitFor(() => {
      expect(stockApi.postSiv).toHaveBeenCalledWith('siv-1')
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/SIV SIV-0001 posted/i)
  })

  it('shows the database negative-stock error when posting is rejected', async () => {
    stockApi.listSivs.mockResolvedValue([DRAFT_SIV])
    stockApi.postSiv.mockRejectedValue(
      new Error(
        'Insufficient stock for item i-tomato at location l-main: requested 2000 base units, available 0 base units',
      ),
    )
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /store issue vouchers/i })
    await within(section).findByText('SIV-0001')
    await user.click(within(section).getByRole('button', { name: 'Post' }))
    await user.click(within(section).getByRole('button', { name: /confirm post/i }))

    expect(await screen.findByText(/insufficient stock/i)).toBeInTheDocument()
  })

  it('hides SIV write controls from a role without posting rights', async () => {
    renderPage(['waiter'])

    const section = await screen.findByRole('region', { name: /store issue vouchers/i })
    expect(screen.queryByRole('button', { name: /new siv/i })).toBeNull()
    expect(within(section).getByText(/read-only/i)).toBeInTheDocument()
  })
})
