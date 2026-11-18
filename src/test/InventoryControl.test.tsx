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

const categoriesApi = vi.hoisted(() => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
}))

const locationsApi = vi.hoisted(() => ({
  listLocations: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))

vi.mock('@/features/stock/api', () => stockApi)
vi.mock('@/features/items/api', () => itemsApi)
vi.mock('@/features/categories/api', () => categoriesApi)
vi.mock('@/features/locations/api', () => locationsApi)

const UNITS = [
  { id: 'u-g', code: 'g', name: 'Gram', dimension: 'mass', is_base: true, base_factor: 1 },
  { id: 'u-kg', code: 'kg', name: 'Kilogram', dimension: 'mass', is_base: false, base_factor: 1000 },
  { id: 'u-piece', code: 'piece', name: 'Piece', dimension: 'count', is_base: true, base_factor: 1 },
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
    purchase_unit_id: null,
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

const LOW_ROW = {
  item_id: 'i-tomato',
  item_code: 'TOMATO',
  item_name: 'Tomato, fresh',
  base_unit_code: 'g',
  reorder_level: 5000,
  on_hand: 2000,
  shortage: 3000,
  is_low: true,
}

const OK_ROW = {
  item_id: 'i-egg',
  item_code: 'EGG',
  item_name: 'Egg',
  base_unit_code: 'piece',
  reorder_level: 24,
  on_hand: 48,
  shortage: 0,
  is_low: false,
}

function adjustmentDocument(status: 'submitted' | 'approved' | 'posted', id = 'adj-2') {
  return {
    id,
    adjustment_number: 'ADJ-0002',
    kind: 'adjustment',
    adjustment_date: '2026-11-18',
    location_id: 'l-main',
    reason: 'damage',
    notes: null,
    status,
    created_by: 'u1',
    created_at: '2026-11-18T10:00:00.000Z',
    submitted_at: '2026-11-18T10:05:00.000Z',
    decided_by: status === 'submitted' ? null : 'u9',
    decided_by_name: status === 'submitted' ? null : 'General Manager',
    decided_at: status === 'submitted' ? null : '2026-11-18T10:10:00.000Z',
    decision_comment: null,
    posted_by: status === 'posted' ? 'u1' : null,
    posted_at: status === 'posted' ? '2026-11-18T10:15:00.000Z' : null,
    inventory_adjustment_lines: [
      {
        id: 'al-1',
        adjustment_id: id,
        item_id: 'i-tomato',
        unit_id: 'u-g',
        direction: 'out',
        quantity: 500,
        unit_cost: null,
        base_quantity: status === 'posted' ? 500 : null,
        posted_cost: status === 'posted' ? 312.5 : null,
        created_at: '2026-11-18T10:00:00.000Z',
      },
    ],
  }
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
  stockApi.postSiv.mockResolvedValue(undefined)
  stockApi.listInventoryAdjustments.mockResolvedValue([])
  stockApi.createInventoryAdjustment.mockResolvedValue('adj-1')
  stockApi.submitInventoryAdjustment.mockResolvedValue(undefined)
  stockApi.decideInventoryAdjustment.mockResolvedValue(undefined)
  stockApi.postInventoryAdjustment.mockResolvedValue(undefined)
  stockApi.listInventoryCounts.mockResolvedValue([])
  stockApi.createInventoryCount.mockResolvedValue('count-1')
  stockApi.submitInventoryCount.mockResolvedValue(undefined)
  stockApi.decideInventoryCount.mockResolvedValue(undefined)
  stockApi.postInventoryCount.mockResolvedValue(undefined)
  stockApi.listReorderStatus.mockResolvedValue([])

  itemsApi.listItems.mockResolvedValue(ITEMS)
  itemsApi.listUnits.mockResolvedValue(UNITS)
  itemsApi.listCategories.mockResolvedValue([])
  itemsApi.listItemUnitConversions.mockResolvedValue([])
  itemsApi.createItem.mockResolvedValue(undefined)
  itemsApi.createItemUnitConversion.mockResolvedValue(undefined)
  itemsApi.updateItem.mockResolvedValue(undefined)
  itemsApi.updateItemUnitConversion.mockResolvedValue(undefined)

  categoriesApi.listCategories.mockResolvedValue([])
  categoriesApi.createCategory.mockResolvedValue(undefined)
  categoriesApi.updateCategory.mockResolvedValue(undefined)

  locationsApi.listLocations.mockResolvedValue(LOCATIONS)
  locationsApi.createLocation.mockResolvedValue(undefined)
  locationsApi.updateLocation.mockResolvedValue(undefined)
})

describe('Inventory — reorder alerts', () => {
  it('shows items below their reorder level and can reveal the rest', async () => {
    stockApi.listReorderStatus.mockResolvedValue([LOW_ROW, OK_ROW])
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /reorder alerts/i })

    expect(await within(section).findByText('Tomato, fresh')).toBeInTheDocument()
    expect(within(section).getByText(/1 item below reorder level/i)).toBeInTheDocument()
    expect(within(section).getByText(/3,000 g/)).toBeInTheDocument()
    expect(within(section).queryByText('Egg')).not.toBeInTheDocument()

    await user.click(within(section).getByLabelText(/show all tracked items/i))

    expect(within(section).getByText('Egg')).toBeInTheDocument()
    expect(within(section).getByText(/^OK$/)).toBeInTheDocument()
  })
})

describe('Inventory — adjustments and waste', () => {
  it('creates an adjustment draft with a decrease line', async () => {
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /^inventory adjustments$/i })
    await user.click(within(section).getByRole('button', { name: /new adjustment/i }))

    await user.type(within(section).getByLabelText(/adjustment number/i), 'adj-0009')
    await user.selectOptions(within(section).getByLabelText('Location'), 'l-main')
    await user.selectOptions(within(section).getByLabelText(/item for adjustment line 1/i), 'i-tomato')
    await user.type(within(section).getByLabelText(/quantity for adjustment line 1/i), '500')

    await user.click(within(section).getByRole('button', { name: /save draft/i }))

    await waitFor(() =>
      expect(stockApi.createInventoryAdjustment).toHaveBeenCalledWith({
        kind: 'adjustment',
        adjustmentNumber: 'ADJ-0009',
        adjustmentDate: expect.any(String),
        locationId: 'l-main',
        reason: 'damage',
        notes: null,
        lines: [
          {
            itemId: 'i-tomato',
            unitId: 'u-g',
            direction: 'out',
            quantity: 500,
            unitCost: null,
          },
        ],
      }),
    )
    expect(await within(section).findByText(/saved as a draft/i)).toBeInTheDocument()
  })

  it('records waste as a decrease with a waste reason', async () => {
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /^waste records$/i })
    await user.click(within(section).getByRole('button', { name: /new waste record/i }))

    await user.type(within(section).getByLabelText(/waste number/i), 'wst-0004')
    await user.selectOptions(within(section).getByLabelText('Reason'), 'burnt_food')
    await user.selectOptions(within(section).getByLabelText(/item for waste record line 1/i), 'i-egg')
    await user.type(within(section).getByLabelText(/quantity for waste record line 1/i), '3')

    expect(within(section).queryByLabelText(/direction for adjustment line/i)).not.toBeInTheDocument()

    await user.click(within(section).getByRole('button', { name: /save draft/i }))

    await waitFor(() =>
      expect(stockApi.createInventoryAdjustment).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'waste',
          adjustmentNumber: 'WST-0004',
          reason: 'burnt_food',
          lines: [
            {
              itemId: 'i-egg',
              unitId: 'u-piece',
              direction: 'out',
              quantity: 3,
              unitCost: null,
            },
          ],
        }),
      ),
    )
  })

  it('lets a storekeeper submit but not approve, and a manager approve', async () => {
    stockApi.listInventoryAdjustments.mockImplementation((kind: string) =>
      Promise.resolve(kind === 'adjustment' ? [adjustmentDocument('submitted')] : []),
    )

    const { unmount } = renderPage(['storekeeper'])
    const storeSection = await screen.findByRole('region', { name: /^inventory adjustments$/i })
    expect(await within(storeSection).findByText('ADJ-0002')).toBeInTheDocument()
    expect(
      within(storeSection).queryByRole('button', { name: /review decision/i }),
    ).not.toBeInTheDocument()
    unmount()

    const user = userEvent.setup()
    renderPage(['general_manager'])
    const managerSection = await screen.findByRole('region', { name: /^inventory adjustments$/i })
    await user.click(await within(managerSection).findByRole('button', { name: /review decision/i }))
    await user.click(within(managerSection).getByRole('button', { name: /^approve$/i }))

    await waitFor(() =>
      expect(stockApi.decideInventoryAdjustment).toHaveBeenCalledWith('adj-2', 'approved', ''),
    )
  })

  it('posts an approved document after confirmation', async () => {
    stockApi.listInventoryAdjustments.mockImplementation((kind: string) =>
      Promise.resolve(kind === 'adjustment' ? [adjustmentDocument('approved')] : []),
    )

    const user = userEvent.setup()
    renderPage(['storekeeper'])

    const section = await screen.findByRole('region', { name: /^inventory adjustments$/i })
    await user.click(await within(section).findByRole('button', { name: /^post$/i }))
    await user.click(within(section).getByRole('button', { name: /confirm post/i }))

    await waitFor(() => expect(stockApi.postInventoryAdjustment).toHaveBeenCalledWith('adj-2'))
  })

  it('is read-only for a role without inventory management', async () => {
    renderPage(['waiter'])

    const section = await screen.findByRole('region', { name: /^inventory adjustments$/i })
    expect(
      within(section).queryByRole('button', { name: /new adjustment/i }),
    ).not.toBeInTheDocument()
    expect(within(section).getByText(/read-only/i)).toBeInTheDocument()
  })
})

describe('Inventory — counts', () => {
  it('captures the system quantity, the variance and the counted line', async () => {
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /^inventory counts$/i })
    await user.click(within(section).getByRole('button', { name: /new count/i }))

    await user.type(within(section).getByLabelText(/count number/i), 'cnt-0009')
    await user.selectOptions(within(section).getByLabelText('Location'), 'l-main')
    await user.selectOptions(within(section).getByLabelText(/item for count line 1/i), 'i-tomato')

    expect(within(section).getByText('2,000 g')).toBeInTheDocument()

    await user.type(within(section).getByLabelText(/physical quantity for count line 1/i), '1500')

    expect(within(section).getByText('-500 g')).toBeInTheDocument()

    await user.click(within(section).getByRole('button', { name: /save draft/i }))

    await waitFor(() =>
      expect(stockApi.createInventoryCount).toHaveBeenCalledWith(
        expect.objectContaining({
          countNumber: 'CNT-0009',
          locationId: 'l-main',
          counterName: 'Test Storekeeper',
          lines: [{ itemId: 'i-tomato', physicalQuantity: 1500 }],
        }),
      ),
    )
  })

  it('blocks creation for a role without inventory management', async () => {
    renderPage(['waiter'])

    const section = await screen.findByRole('region', { name: /^inventory counts$/i })
    expect(within(section).queryByRole('button', { name: /new count/i })).not.toBeInTheDocument()
    expect(within(section).getByText(/read-only/i)).toBeInTheDocument()
  })
})
