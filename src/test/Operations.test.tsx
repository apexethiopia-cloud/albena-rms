import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { Operations } from '@/pages/Operations'

const menuApi = vi.hoisted(() => ({
  listMenuCategories: vi.fn(),
  listMenuItems: vi.fn(),
  createMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
}))

const tablesApi = vi.hoisted(() => ({
  listTables: vi.fn(),
  createTable: vi.fn(),
  updateTable: vi.fn(),
  setTableStatus: vi.fn(),
}))

const reservationsApi = vi.hoisted(() => ({
  listReservations: vi.fn(),
  listReservationSlotLoad: vi.fn(),
  createReservation: vi.fn(),
  assignReservationTable: vi.fn(),
  setReservationStatus: vi.fn(),
}))

const recipesApi = vi.hoisted(() => ({
  listRecipes: vi.fn(),
}))

const ordersApi = vi.hoisted(() => ({
  listOrders: vi.fn(),
  listKitchenOrders: vi.fn(),
  createOrder: vi.fn(),
  updateOrder: vi.fn(),
  setOrderStatus: vi.fn(),
  cancelOrder: vi.fn(),
  transferOrder: vi.fn(),
  splitOrder: vi.fn(),
  mergeOrders: vi.fn(),
  closeOrder: vi.fn(),
  getReceipt: vi.fn(),
  getReceiptByOrder: vi.fn(),
  subscribeToOrderChanges: vi.fn(),
}))

const outletsApi = vi.hoisted(() => ({
  listOutlets: vi.fn(),
}))

vi.mock('@/features/menu/api', () => menuApi)
vi.mock('@/features/tables/api', () => tablesApi)
vi.mock('@/features/reservations/api', () => reservationsApi)
vi.mock('@/features/recipes/api', () => recipesApi)
vi.mock('@/features/orders/api', () => ordersApi)
vi.mock('@/features/outlets/api', () => outletsApi)

const OUTLETS = [
  {
    id: 'outlet-main',
    code: 'MAIN',
    name: 'Main Restaurant',
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
  },
  {
    id: 'outlet-terrace',
    code: 'TERRACE',
    name: 'Terrace',
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
  },
]

const CATEGORIES = [
  { id: 'cat-main', name: 'Main Course', sort_order: 20, is_active: true },
]

const MENU_ITEMS = [
  {
    id: 'm-1',
    code: 'OM-01',
    name: 'Cheese omelette',
    category_id: 'cat-main',
    selling_price: 180.5,
    recipe_id: 'r-1',
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
    menu_categories: { name: 'Main Course' },
    recipes: { code: 'OML-01', name: 'Cheese omelette' },
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
    outlet_id: 'outlet-terrace',
    code: 'P-01',
    name: 'Patio table',
    capacity: 2,
    status: 'reserved' as const,
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
  },
]

const RESERVATIONS = [
  {
    id: 'res-1',
    reservation_number: 'RES-MAIN-20261118-0001',
    outlet_id: 'outlet-main',
    guest_name: 'Selam Bekele',
    guest_phone: '+251911000000',
    reserved_date: '2026-11-20',
    reserved_time: '19:30:00',
    party_size: 4,
    table_id: null,
    special_requests: null,
    status: 'booked' as const,
    created_by: 'u1',
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
    status_updated_by: null,
    status_updated_at: null,
    restaurant_tables: null,
  },
]

const SLOT_LOAD = [
  {
    outlet_id: 'outlet-main',
    reserved_date: '2026-11-20',
    reserved_time: '19:30:00',
    active_reservations: 3,
    active_tables: 2,
  },
]

const ORDER_LINE = {
  id: 'ol-1',
  order_id: 'o-1',
  menu_item_id: 'm-1',
  item_code: 'OM-01',
  item_name: 'Cheese omelette',
  unit_price: 180.5,
  quantity: 2,
  line_total: 361,
  special_instructions: null,
}

const ORDERS = [
  {
    id: 'o-1',
    order_number: 'ORD-MAIN-20261118-0001',
    outlet_id: 'outlet-main',
    table_id: 'table-1',
    waiter_id: 'u1',
    waiter_name: 'Test Waiter',
    status: 'pending' as const,
    revision: 1,
    notes: null,
    opened_at: '2026-11-18T10:00:00.000Z',
    updated_at: '2026-11-18T10:00:00.000Z',
    sent_at: null,
    preparing_at: null,
    ready_at: null,
    served_at: null,
    closed_at: null,
    cancelled_at: null,
    cancel_reason: null,
    subtotal: null,
    vat_amount: null,
    total: null,
    order_lines: [ORDER_LINE],
    restaurant_tables: { code: 'T-01', name: 'Window table' },
  },
  {
    id: 'o-2',
    order_number: 'ORD-MAIN-20261118-0002',
    outlet_id: 'outlet-main',
    table_id: null,
    waiter_id: 'u1',
    waiter_name: 'Test Waiter',
    status: 'sent_to_kitchen' as const,
    revision: 1,
    notes: null,
    opened_at: '2026-11-18T10:15:00.000Z',
    updated_at: '2026-11-18T10:15:00.000Z',
    sent_at: '2026-11-18T10:16:00.000Z',
    preparing_at: null,
    ready_at: null,
    served_at: null,
    closed_at: null,
    cancelled_at: null,
    cancel_reason: null,
    subtotal: null,
    vat_amount: null,
    total: null,
    order_lines: [
      {
        ...ORDER_LINE,
        id: 'ol-2',
        order_id: 'o-2',
        quantity: 1,
        line_total: 180.5,
      },
    ],
    restaurant_tables: null,
  },
  {
    id: 'o-3',
    order_number: 'ORD-MAIN-20261118-0003',
    outlet_id: 'outlet-main',
    table_id: null,
    waiter_id: 'u1',
    waiter_name: 'Test Waiter',
    status: 'served' as const,
    revision: 2,
    notes: null,
    opened_at: '2026-11-18T11:00:00.000Z',
    updated_at: '2026-11-18T11:30:00.000Z',
    sent_at: '2026-11-18T11:05:00.000Z',
    preparing_at: '2026-11-18T11:10:00.000Z',
    ready_at: '2026-11-18T11:20:00.000Z',
    served_at: '2026-11-18T11:30:00.000Z',
    closed_at: null,
    cancelled_at: null,
    cancel_reason: null,
    subtotal: null,
    vat_amount: null,
    total: null,
    order_lines: [
      {
        ...ORDER_LINE,
        id: 'ol-3',
        order_id: 'o-3',
        quantity: 1,
        line_total: 180.5,
      },
    ],
    restaurant_tables: null,
  },
]

const RECEIPT = {
  id: 'receipt-1',
  receipt_number: 'MAIN-20261118-0001',
  order_id: 'o-3',
  outlet_id: 'outlet-main',
  issued_at: '2026-11-18T11:31:00.000Z',
  business_name: 'Albena Restaurant',
  business_tin: 'TIN-001',
  business_address: 'Bole, Addis Ababa',
  business_phone: '+251911000000',
  vat_rate: 15,
  subtotal: 156.96,
  vat_amount: 23.54,
  total: 180.5,
  table_code: null,
  waiter_name: 'Test Waiter',
  line_count: 1,
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
      <Operations />
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()

  menuApi.listMenuItems.mockResolvedValue(MENU_ITEMS)
  menuApi.listMenuCategories.mockResolvedValue(CATEGORIES)
  menuApi.createMenuItem.mockResolvedValue('m-new')
  menuApi.updateMenuItem.mockResolvedValue(undefined)

  tablesApi.listTables.mockResolvedValue(TABLES)
  tablesApi.createTable.mockResolvedValue('table-new')
  tablesApi.updateTable.mockResolvedValue(undefined)
  tablesApi.setTableStatus.mockResolvedValue(undefined)

  reservationsApi.listReservations.mockResolvedValue(RESERVATIONS)
  reservationsApi.listReservationSlotLoad.mockResolvedValue(SLOT_LOAD)
  reservationsApi.createReservation.mockResolvedValue('res-new')
  reservationsApi.assignReservationTable.mockResolvedValue(undefined)
  reservationsApi.setReservationStatus.mockResolvedValue(undefined)

  recipesApi.listRecipes.mockResolvedValue([])
  outletsApi.listOutlets.mockResolvedValue(OUTLETS)

  ordersApi.listOrders.mockResolvedValue(ORDERS)
  ordersApi.listKitchenOrders.mockResolvedValue([ORDERS[1]])
  ordersApi.createOrder.mockResolvedValue('o-new')
  ordersApi.updateOrder.mockResolvedValue(undefined)
  ordersApi.setOrderStatus.mockResolvedValue(undefined)
  ordersApi.cancelOrder.mockResolvedValue(undefined)
  ordersApi.transferOrder.mockResolvedValue(undefined)
  ordersApi.splitOrder.mockResolvedValue('o-split')
  ordersApi.mergeOrders.mockResolvedValue(undefined)
  ordersApi.closeOrder.mockResolvedValue('receipt-1')
  ordersApi.getReceipt.mockResolvedValue(RECEIPT)
  ordersApi.getReceiptByOrder.mockResolvedValue(RECEIPT)
  ordersApi.subscribeToOrderChanges.mockReturnValue(() => {})
})

describe('Operations - menus, tables, reservations, orders and kitchen', () => {
  it('shows menu prices, the table layout and the reservation diary', async () => {
    renderPage()

    const menu = await screen.findByRole('region', { name: /^menu$/i })
    expect(await within(menu).findByText('Cheese omelette')).toBeInTheDocument()
    expect(within(menu).getByText(/180\.50/)).toBeInTheDocument()
    expect(within(menu).getByText('OML-01 · Cheese omelette')).toBeInTheDocument()

    const tables = await screen.findByRole('region', { name: /^tables$/i })
    expect(await within(tables).findByText('T-01 · Window table')).toBeInTheDocument()
    expect(within(tables).getByLabelText('Status for table T-01')).toHaveValue('available')

    const reservations = await screen.findByRole('region', { name: /^reservations$/i })
    expect(await within(reservations).findByText('Selam Bekele')).toBeInTheDocument()
    expect(
      within(reservations).getByText('RES-MAIN-20261118-0001'),
    ).toBeInTheDocument()
    expect(within(reservations).getByText('19:30')).toBeInTheDocument()
  })

  it('warns when a slot has more reservations than active tables', async () => {
    renderPage()

    const reservations = await screen.findByRole('region', { name: /^reservations$/i })

    expect(
      await within(reservations).findByText(
        /more reservations than tables/i,
      ),
    ).toBeInTheDocument()
    expect(
      within(reservations).getByText(/3 reservations for 2 tables/i),
    ).toBeInTheDocument()
  })

  it('changes a table status through the role-gated RPC', async () => {
    const user = userEvent.setup()
    renderPage()

    const tables = await screen.findByRole('region', { name: /^tables$/i })
    const card = (await within(tables).findByText('T-01 · Window table')).closest('li')
    expect(card).not.toBeNull()

    await user.selectOptions(
      within(card as HTMLElement).getByLabelText('Status for table T-01'),
      'cleaning',
    )
    await user.click(within(card as HTMLElement).getByRole('button', { name: /set status/i }))

    await waitFor(() =>
      expect(tablesApi.setTableStatus).toHaveBeenCalledWith('table-1', 'cleaning'),
    )
    expect(await within(tables).findByText(/now cleaning/i)).toBeInTheDocument()
  })

  it('records a reservation with an optional table and guest contact', async () => {
    const user = userEvent.setup()
    renderPage()

    const reservations = await screen.findByRole('region', { name: /^reservations$/i })
    await user.click(within(reservations).getByRole('button', { name: /new reservation/i }))

    await user.type(within(reservations).getByLabelText(/guest name/i), 'Abebe Tadesse')
    await user.type(within(reservations).getByLabelText(/guest phone/i), '+251922000000')
    await user.clear(within(reservations).getByLabelText(/party size/i))
    await user.type(within(reservations).getByLabelText(/party size/i), '6')

    await user.click(
      within(reservations).getByRole('button', { name: /save reservation/i }),
    )

    await waitFor(() =>
      expect(reservationsApi.createReservation).toHaveBeenCalledWith(
        expect.objectContaining({
          outletId: 'outlet-main',
          guestName: 'Abebe Tadesse',
          guestPhone: '+251922000000',
          partySize: 6,
          tableId: null,
        }),
      ),
    )
    expect(
      await within(reservations).findByText(/was recorded/i),
    ).toBeInTheDocument()
  })

  it('moves a reservation through its status lifecycle', async () => {
    const user = userEvent.setup()
    renderPage()

    const reservations = await screen.findByRole('region', { name: /^reservations$/i })
    const row = (await within(reservations).findByText('RES-MAIN-20261118-0001')).closest(
      'tr',
    )
    expect(row).not.toBeNull()

    await user.click(within(row as HTMLElement).getByRole('button', { name: /^confirm$/i }))

    await waitFor(() =>
      expect(reservationsApi.setReservationStatus).toHaveBeenCalledWith('res-1', 'confirmed'),
    )
    expect(await within(reservations).findByText(/now confirmed/i)).toBeInTheDocument()
  })

  it('is read-only for roles without operations permission', async () => {
    renderPage(['storekeeper'])

    const menu = await screen.findByRole('region', { name: /^menu$/i })
    expect(
      within(menu).queryByRole('button', { name: /new menu item/i }),
    ).not.toBeInTheDocument()

    const tables = await screen.findByRole('region', { name: /^tables$/i })
    expect(
      within(tables).queryByRole('button', { name: /new table/i }),
    ).not.toBeInTheDocument()
    expect(
      within(tables).queryByLabelText('Status for table T-01'),
    ).not.toBeInTheDocument()

    const reservations = await screen.findByRole('region', { name: /^reservations$/i })
    expect(
      within(reservations).queryByRole('button', { name: /new reservation/i }),
    ).not.toBeInTheDocument()

    const orders = await screen.findByRole('region', { name: /^orders$/i })
    expect(
      within(orders).queryByRole('button', { name: /new order/i }),
    ).not.toBeInTheDocument()

    const kds = await screen.findByRole('region', { name: /^kitchen display$/i })
    expect(
      within(kds).queryByRole('button', { name: /start preparing/i }),
    ).not.toBeInTheDocument()
  })

  it('opens an order with menu lines', async () => {
    const user = userEvent.setup()
    renderPage()

    const orders = await screen.findByRole('region', { name: /^orders$/i })
    await within(orders).findByText('ORD-MAIN-20261118-0001')

    await user.click(within(orders).getByRole('button', { name: /new order/i }))
    await user.selectOptions(
      within(orders).getByLabelText('Menu item for line 1'),
      'm-1',
    )
    await user.click(within(orders).getByRole('button', { name: /open order/i }))

    await waitFor(() =>
      expect(ordersApi.createOrder).toHaveBeenCalledWith({
        outletId: 'outlet-main',
        tableId: null,
        notes: null,
        lines: [{ menuItemId: 'm-1', quantity: 1, specialInstructions: null }],
      }),
    )
    expect(await within(orders).findByText(/was opened/i)).toBeInTheDocument()
  })

  it('sends a pending order to the kitchen', async () => {
    const user = userEvent.setup()
    renderPage()

    const orders = await screen.findByRole('region', { name: /^orders$/i })
    const card = (await within(orders).findByText('ORD-MAIN-20261118-0001')).closest(
      'li',
    )
    expect(card).not.toBeNull()

    await user.click(
      within(card as HTMLElement).getByRole('button', { name: /send to kitchen/i }),
    )

    await waitFor(() =>
      expect(ordersApi.setOrderStatus).toHaveBeenCalledWith(
        'o-1',
        'sent_to_kitchen',
        1,
      ),
    )
    expect(await within(orders).findByText(/is now sent to kitchen/i)).toBeInTheDocument()
  })

  it('closes a served order and shows the printed receipt', async () => {
    const user = userEvent.setup()
    renderPage()

    const orders = await screen.findByRole('region', { name: /^orders$/i })
    const card = (await within(orders).findByText('ORD-MAIN-20261118-0003')).closest(
      'li',
    )
    expect(card).not.toBeNull()

    await user.click(
      within(card as HTMLElement).getByRole('button', {
        name: /close & print receipt/i,
      }),
    )
    await user.click(
      within(card as HTMLElement).getByRole('button', { name: /confirm close/i }),
    )

    await waitFor(() => expect(ordersApi.closeOrder).toHaveBeenCalledWith('o-3', 2))
    expect(ordersApi.getReceipt).toHaveBeenCalledWith('receipt-1')

    const receipt = await screen.findByRole('dialog', {
      name: /receipt MAIN-20261118-0001/i,
    })
    expect(within(receipt).getByText('Albena Restaurant')).toBeInTheDocument()
    expect(within(receipt).getByText('MAIN-20261118-0001')).toBeInTheDocument()
    expect(within(receipt).getByText('Total (VAT inclusive)')).toBeInTheDocument()
    expect(within(receipt).getAllByText(/180\.50/).length).toBeGreaterThanOrEqual(3)
  })

  it('shows kitchen tickets and refreshes when realtime reports a change', async () => {
    renderPage()

    const kds = await screen.findByRole('region', { name: /^kitchen display$/i })
    expect(await within(kds).findByText('ORD-MAIN-20261118-0002')).toBeInTheDocument()

    const onChange = ordersApi.subscribeToOrderChanges.mock.calls[0][0] as () => void
    await act(async () => {
      onChange()
    })

    await waitFor(() => expect(ordersApi.listKitchenOrders).toHaveBeenCalledTimes(2))
  })

  it('starts preparing a kitchen ticket through the role-gated RPC', async () => {
    const user = userEvent.setup()
    renderPage()

    const kds = await screen.findByRole('region', { name: /^kitchen display$/i })
    const card = (await within(kds).findByText('ORD-MAIN-20261118-0002')).closest('li')
    expect(card).not.toBeNull()

    await user.click(
      within(card as HTMLElement).getByRole('button', { name: /start preparing/i }),
    )

    await waitFor(() =>
      expect(ordersApi.setOrderStatus).toHaveBeenCalledWith('o-2', 'preparing', 1),
    )
  })
})
