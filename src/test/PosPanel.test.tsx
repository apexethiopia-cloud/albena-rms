import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { PosPanel } from '@/features/orders/PosPanel'
import { formatCurrency } from '@/lib/format'

const ordersApi = vi.hoisted(() => ({
  createOrder: vi.fn(),
}))

const outletsApi = vi.hoisted(() => ({
  listOutlets: vi.fn(),
}))

const menuApi = vi.hoisted(() => ({
  listMenuItems: vi.fn(),
}))

const tablesApi = vi.hoisted(() => ({
  listTables: vi.fn(),
}))

vi.mock('@/features/orders/api', () => ordersApi)
vi.mock('@/features/outlets/api', () => outletsApi)
vi.mock('@/features/menu/api', () => menuApi)
vi.mock('@/features/tables/api', () => tablesApi)

const OUTLETS = [
  {
    id: 'outlet-main',
    code: 'MAIN',
    name: 'Main Restaurant',
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
  },
]

const MENU_ITEMS = [
  {
    id: 'm-1',
    code: 'OM-01',
    name: 'Cheese omelette',
    category_id: 'cat-main',
    selling_price: 180.5,
    recipe_id: null,
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
    menu_categories: { name: 'Main Course' },
    recipes: null,
  },
  {
    id: 'm-2',
    code: 'DR-01',
    name: 'Sparkling water',
    category_id: 'cat-drinks',
    selling_price: 45,
    recipe_id: null,
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
    menu_categories: { name: 'Drinks' },
    recipes: null,
  },
  {
    id: 'm-3',
    code: 'SP-01',
    name: 'Chef special',
    category_id: null,
    selling_price: 250,
    recipe_id: null,
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
    menu_categories: null,
    recipes: null,
  },
  {
    id: 'm-4',
    code: 'OFF-01',
    name: 'Inactive dish',
    category_id: 'cat-main',
    selling_price: 99,
    recipe_id: null,
    is_active: false,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
    menu_categories: { name: 'Main Course' },
    recipes: null,
  },
]

const TABLES = [
  {
    id: 'table-1',
    outlet_id: 'outlet-main',
    code: 'T-01',
    name: 'Window table',
    capacity: 4,
    status: 'available' as const,
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
  },
  {
    id: 'table-2',
    outlet_id: 'outlet-main',
    code: 'T-02',
    name: 'Patio table',
    capacity: 2,
    status: 'available' as const,
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
  },
]

const ORDER_REFERENCE = 'ORD-MAIN-20261119-0001'

function authValue(roles: string[]): AuthContextValue {
  return {
    state: {
      status: 'signed-in',
      user: {
        id: 'u1',
        email: 'cashier@example.com',
        fullName: 'Test Cashier',
        status: 'active',
        roles,
      },
    },
    signIn: async () => ({ error: null }),
    signOut: async () => {},
  }
}

function renderPanel(roles: string[] = ['cashier']) {
  return render(
    <AuthContext.Provider value={authValue(roles)}>
      <PosPanel />
    </AuthContext.Provider>,
  )
}

async function openPos() {
  const pos = await screen.findByRole('region', { name: /quick pos/i })
  await within(pos).findByRole('button', { name: /add cheese omelette to cart/i })
  return pos
}

beforeEach(() => {
  vi.clearAllMocks()

  outletsApi.listOutlets.mockResolvedValue(OUTLETS)
  menuApi.listMenuItems.mockResolvedValue(MENU_ITEMS)
  tablesApi.listTables.mockResolvedValue(TABLES)
  ordersApi.createOrder.mockResolvedValue(ORDER_REFERENCE)
})

describe('PosPanel', () => {
  it('is hidden from roles that cannot take orders', () => {
    renderPanel(['storekeeper'])

    expect(screen.queryByRole('region', { name: /quick pos/i })).not.toBeInTheDocument()
  })

  it('filters item cards by category and ignores inactive items', async () => {
    const user = userEvent.setup()
    renderPanel()
    const pos = await openPos()

    expect(
      within(pos).getByRole('button', { name: /add sparkling water to cart/i }),
    ).toBeInTheDocument()
    expect(
      within(pos).getByRole('button', { name: /add chef special to cart/i }),
    ).toBeInTheDocument()
    expect(
      within(pos).queryByRole('button', { name: /add inactive dish to cart/i }),
    ).not.toBeInTheDocument()

    await user.click(within(pos).getByRole('button', { name: 'Drinks' }))

    expect(
      within(pos).getByRole('button', { name: /add sparkling water to cart/i }),
    ).toBeInTheDocument()
    expect(
      within(pos).queryByRole('button', { name: /add cheese omelette to cart/i }),
    ).not.toBeInTheDocument()

    await user.click(within(pos).getByRole('button', { name: 'Uncategorised' }))

    expect(
      within(pos).getByRole('button', { name: /add chef special to cart/i }),
    ).toBeInTheDocument()
    expect(
      within(pos).queryByRole('button', { name: /add sparkling water to cart/i }),
    ).not.toBeInTheDocument()
  })

  it('adds a tapped item to the cart and shows a count badge and total', async () => {
    const user = userEvent.setup()
    renderPanel()
    const pos = await openPos()

    await user.click(
      within(pos).getByRole('button', { name: /add cheese omelette to cart/i }),
    )

    expect(
      within(pos).getByLabelText('Cheese omelette quantity in cart'),
    ).toHaveTextContent('1')
    expect(
      within(pos).getByLabelText('Quantity for Cheese omelette'),
    ).toHaveTextContent('1')
    expect(within(pos).getByLabelText('Cart total').textContent).toBe(formatCurrency(180.5))
  })

  it('updates the cart total from the quantity stepper', async () => {
    const user = userEvent.setup()
    renderPanel()
    const pos = await openPos()

    await user.click(
      within(pos).getByRole('button', { name: /add cheese omelette to cart/i }),
    )
    await user.click(
      within(pos).getByRole('button', { name: /increase quantity for cheese omelette/i }),
    )
    await user.click(
      within(pos).getByRole('button', { name: /increase quantity for cheese omelette/i }),
    )

    expect(
      within(pos).getByLabelText('Quantity for Cheese omelette'),
    ).toHaveTextContent('3')
    expect(within(pos).getByLabelText('Cart total').textContent).toBe(
      formatCurrency(180.5 * 3),
    )

    await user.click(
      within(pos).getByRole('button', { name: /decrease quantity for cheese omelette/i }),
    )

    expect(
      within(pos).getByLabelText('Quantity for Cheese omelette'),
    ).toHaveTextContent('2')
    expect(within(pos).getByLabelText('Cart total').textContent).toBe(
      formatCurrency(180.5 * 2),
    )
  })

  it('blocks submission when the outlet and cart are empty', async () => {
    const user = userEvent.setup()
    renderPanel()
    const pos = await openPos()

    await user.click(within(pos).getByRole('button', { name: /open pos order/i }))

    await waitFor(() => expect(ordersApi.createOrder).not.toHaveBeenCalled())
    expect(within(pos).getByText('Choose the outlet.')).toBeInTheDocument()
    expect(within(pos).getByText('Add at least one menu item.')).toBeInTheDocument()
  })

  it('creates an order with the selected items and shows its reference', async () => {
    const user = userEvent.setup()
    renderPanel()
    const pos = await openPos()

    await user.selectOptions(within(pos).getByLabelText('POS outlet'), 'outlet-main')
    await user.selectOptions(within(pos).getByLabelText('POS table (optional)'), 'table-1')
    await user.type(within(pos).getByLabelText('POS notes'), 'No onions')
    await user.click(
      within(pos).getByRole('button', { name: /add cheese omelette to cart/i }),
    )
    await user.click(
      within(pos).getByRole('button', { name: /increase quantity for cheese omelette/i }),
    )
    await user.click(within(pos).getByRole('button', { name: /open pos order/i }))

    await waitFor(() =>
      expect(ordersApi.createOrder).toHaveBeenCalledWith({
        outletId: 'outlet-main',
        tableId: 'table-1',
        notes: 'No onions',
        lines: [{ menuItemId: 'm-1', quantity: 2, specialInstructions: null }],
      }),
    )
    expect(
      await within(pos).findByText(new RegExp(ORDER_REFERENCE)),
    ).toBeInTheDocument()
    expect(
      within(pos).getByLabelText('Cheese omelette quantity in cart'),
    ).toHaveTextContent('0')
    expect(within(pos).getByLabelText('Cart total').textContent).toBe(formatCurrency(0))
  })
})
