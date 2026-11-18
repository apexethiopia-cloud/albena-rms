import { render, screen, waitFor, within } from '@testing-library/react'
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

const outletsApi = vi.hoisted(() => ({
  listOutlets: vi.fn(),
}))

vi.mock('@/features/menu/api', () => menuApi)
vi.mock('@/features/tables/api', () => tablesApi)
vi.mock('@/features/reservations/api', () => reservationsApi)
vi.mock('@/features/recipes/api', () => recipesApi)
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
})

describe('Operations — menus, tables and reservations', () => {
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
  })
})
