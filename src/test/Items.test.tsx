import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { Inventory } from '@/pages/Inventory'

const api = vi.hoisted(() => ({
  listItems: vi.fn(),
  listUnits: vi.fn(),
  listCategories: vi.fn(),
  listItemUnitConversions: vi.fn(),
  createItem: vi.fn(),
  createItemUnitConversion: vi.fn(),
  updateItem: vi.fn(),
  updateItemUnitConversion: vi.fn(),
}))

const stockApi = vi.hoisted(() => ({
  listStockBalances: vi.fn(),
  listStockMovements: vi.fn(),
  listSivs: vi.fn(),
  createSiv: vi.fn(),
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

vi.mock('@/features/items/api', () => api)
vi.mock('@/features/stock/api', () => stockApi)
vi.mock('@/features/locations/api', () => ({
  listLocations: vi.fn().mockResolvedValue([]),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))

const UNITS = [
  {
    id: 'unit-g',
    code: 'g',
    name: 'Gram',
    dimension: 'mass',
    is_base: true,
    base_factor: 1,
  },
  {
    id: 'unit-kg',
    code: 'kg',
    name: 'Kilogram',
    dimension: 'mass',
    is_base: false,
    base_factor: 1000,
  },
  {
    id: 'unit-piece',
    code: 'piece',
    name: 'Piece',
    dimension: 'count',
    is_base: true,
    base_factor: 1,
  },
  {
    id: 'unit-box',
    code: 'box',
    name: 'Box',
    dimension: 'count',
    is_base: false,
    base_factor: null,
  },
]

const CATEGORIES = [{ id: 'cat-veg', name: 'Vegetables', is_active: true }]

const ITEM = {
  id: 'i1',
  code: 'TOMATO',
  name: 'Tomato, fresh',
  category_id: 'cat-veg',
  base_unit_id: 'unit-g',
  purchase_unit_id: null,
  reorder_level: 5000,
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
      <Inventory />
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listItems.mockResolvedValue([ITEM])
  api.listUnits.mockResolvedValue(UNITS)
  api.listCategories.mockResolvedValue(CATEGORIES)
  api.listItemUnitConversions.mockResolvedValue([])
  api.createItem.mockResolvedValue(undefined)
  api.createItemUnitConversion.mockResolvedValue(undefined)
  api.updateItem.mockResolvedValue(undefined)
  api.updateItemUnitConversion.mockResolvedValue(undefined)
  stockApi.listStockBalances.mockResolvedValue([])
  stockApi.listStockMovements.mockResolvedValue([])
  stockApi.listSivs.mockResolvedValue([])
  stockApi.createSiv.mockResolvedValue('siv-1')
  stockApi.postSiv.mockResolvedValue(undefined)
  stockApi.listInventoryAdjustments.mockResolvedValue([])
  stockApi.listInventoryCounts.mockResolvedValue([])
  stockApi.listReorderStatus.mockResolvedValue([])
})

describe('Inventory — items', () => {
  it('lists items with their category and base unit', async () => {
    renderPage()

    expect(await screen.findByText('Tomato, fresh')).toBeInTheDocument()
    expect(screen.getByText('TOMATO')).toBeInTheDocument()
    expect(screen.getByText('Vegetables')).toBeInTheDocument()
    expect(screen.getByText('Gram (g)')).toBeInTheDocument()
    expect(screen.getByText(/5,000 g/)).toBeInTheDocument()
    expect(screen.getByText(/1 item · 1 active/i)).toBeInTheDocument()
  })

  it('shows a clear error when loading fails', async () => {
    api.listItems.mockRejectedValue(new Error('This table is not in the database yet.'))

    renderPage()

    const section = await screen.findByRole('region', { name: 'Items' })
    expect(await within(section).findByText(/could not load items/i)).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('creates an item in its base unit', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Tomato, fresh')
    await user.click(screen.getByRole('button', { name: /new item/i }))
    await user.type(screen.getByLabelText('Code'), 'onion')
    await user.type(screen.getByLabelText('Item name'), 'Onion, red')
    await user.selectOptions(screen.getByLabelText('Category'), 'cat-veg')
    await user.selectOptions(screen.getByLabelText('Base unit'), 'unit-g')
    await user.clear(screen.getByLabelText('Reorder level'))
    await user.type(screen.getByLabelText('Reorder level'), '2500')
    await user.click(screen.getByRole('button', { name: /create item/i }))

    await waitFor(() => {
      expect(api.createItem).toHaveBeenCalledWith({
        code: 'ONION',
        name: 'Onion, red',
        categoryId: 'cat-veg',
        baseUnitId: 'unit-g',
        purchaseUnitId: null,
        reorderLevel: 2500,
      })
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/ONION created/i)
  })

  it('warns that a box factor is item-specific', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Tomato, fresh')
    await user.click(screen.getByRole('button', { name: /new item/i }))
    await user.selectOptions(screen.getByLabelText('Purchase unit'), 'unit-box')

    expect(await screen.findByText(/no universal size/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/purchase unit factor/i)).toBeInTheDocument()
  })

  it('creates an item and records its purchase unit factor', async () => {
    api.createItem.mockResolvedValue('new-item-id')
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Tomato, fresh')
    await user.click(screen.getByRole('button', { name: /new item/i }))
    await user.type(screen.getByLabelText('Code'), 'COFFEE_BEAN')
    await user.type(screen.getByLabelText('Item name'), 'Coffee Bean')
    await user.selectOptions(screen.getByLabelText('Purchase unit'), 'unit-box')
    await user.type(screen.getByLabelText(/purchase unit factor/i), '20')

    await user.click(screen.getByRole('button', { name: /create item/i }))

    await waitFor(() => {
      expect(api.createItemUnitConversion).toHaveBeenCalledWith('new-item-id', 'unit-box', 20)
    })
  })

  it('blocks an invalid item before calling the database', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Tomato, fresh')
    await user.click(screen.getByRole('button', { name: /new item/i }))
    await user.clear(screen.getByLabelText('Reorder level'))
    await user.type(screen.getByLabelText('Reorder level'), 'abc')
    await user.click(screen.getByRole('button', { name: /create item/i }))

    expect(await screen.findByText('Code is required.')).toBeInTheDocument()
    expect(screen.getByText('Item name is required.')).toBeInTheDocument()
    expect(screen.getByText(/non-negative number/i)).toBeInTheDocument()
    expect(api.createItem).not.toHaveBeenCalled()
  })

  it('edits an item', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Tomato, fresh')
    await user.click(screen.getByRole('button', { name: /edit/i }))

    expect(screen.getByLabelText('Reorder level')).toHaveValue('5000')
    await user.clear(screen.getByLabelText('Item name'))
    await user.type(screen.getByLabelText('Item name'), 'Tomato, vine')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(api.updateItem).toHaveBeenCalledWith(
        'i1',
        expect.objectContaining({ name: 'Tomato, vine', code: 'TOMATO' }),
      )
    })
  })

  it('deactivates an item without deleting it', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Tomato, fresh')
    await user.click(screen.getByRole('button', { name: /deactivate/i }))

    await waitFor(() => {
      expect(api.updateItem).toHaveBeenCalledWith('i1', { is_active: false })
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/deactivated/i)
  })

  it('lets a storekeeper manage items', async () => {
    renderPage(['storekeeper'])

    await screen.findByText('Tomato, fresh')

    expect(screen.getByRole('button', { name: /new item/i })).toBeInTheDocument()
  })

  it('hides write controls from a waiter', async () => {
    renderPage(['waiter'])

    await screen.findByText('Tomato, fresh')

    expect(screen.queryByRole('button', { name: /new item/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull()
    expect(screen.getAllByText(/read-only/i).length).toBeGreaterThan(0)
  })
})
