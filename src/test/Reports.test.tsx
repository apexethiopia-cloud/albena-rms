import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { Reports } from '@/pages/Reports'
import type { ReportBundle } from '@/features/reports/api'

const outletsApi = vi.hoisted(() => ({
  listOutlets: vi.fn(),
}))

const reportsApi = vi.hoisted(() => ({
  loadReports: vi.fn(),
}))

vi.mock('@/features/outlets/api', () => outletsApi)
vi.mock('@/features/reports/api', () => reportsApi)

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

const BUNDLE: ReportBundle = {
  salesDaily: [
    {
      business_date: '2026-11-18',
      outlet_id: 'outlet-main',
      outlet_code: 'MAIN',
      outlet_name: 'Main Restaurant',
      receipt_count: 10,
      line_count: 5,
      subtotal: 541,
      vat_amount: 81.15,
      total: 622.15,
      average_receipt: 62.22,
    },
  ],
  salesLines: [
    {
      business_date: '2026-11-18',
      outlet_id: 'outlet-main',
      outlet_code: 'MAIN',
      outlet_name: 'Main Restaurant',
      order_id: 'o-1',
      order_number: 'ORD-MAIN-20261118-0001',
      receipt_id: 'r-1',
      receipt_number: 'RCT-MAIN-20261118-0001',
      order_line_id: 'ol-1',
      waiter_name: 'Test Waiter',
      category_id: 'cat-main',
      category_name: 'Main Course',
      menu_item_id: 'm-1',
      item_code: 'OM-01',
      item_name: 'Cheese omelette',
      quantity: 2,
      unit_price: 180.5,
      line_total: 361,
    },
    {
      business_date: '2026-11-18',
      outlet_id: 'outlet-main',
      outlet_code: 'MAIN',
      outlet_name: 'Main Restaurant',
      order_id: 'o-2',
      order_number: 'ORD-MAIN-20261118-0002',
      receipt_id: 'r-2',
      receipt_number: 'RCT-MAIN-20261118-0002',
      order_line_id: 'ol-2',
      waiter_name: 'Test Waiter',
      category_id: 'cat-bev',
      category_name: 'Beverages',
      menu_item_id: 'm-2',
      item_code: 'BV-01',
      item_name: 'Macchiato',
      quantity: 3,
      unit_price: 60,
      line_total: 180,
    },
  ],
  inventory: [
    {
      item_id: 'item-1',
      item_code: 'RICE',
      item_name: 'Rice',
      category_name: 'Dry goods',
      base_unit_code: 'g',
      reorder_level: 6000,
      on_hand: 5000,
      inventory_value: 250,
      average_unit_cost: 0.05,
      last_movement_at: '2026-10-09T08:00:00.000Z',
      days_since_last_movement: 40,
      is_below_reorder: true,
    },
    {
      item_id: 'item-2',
      item_code: 'COFFEE',
      item_name: 'Coffee beans',
      category_name: 'Beverages',
      base_unit_code: 'g',
      reorder_level: 1000,
      on_hand: 4000,
      inventory_value: 800,
      average_unit_cost: 0.2,
      last_movement_at: '2026-11-16T08:00:00.000Z',
      days_since_last_movement: 2,
      is_below_reorder: false,
    },
  ],
  purchaseRequests: [
    {
      pr_id: 'pr-1',
      pr_number: 'PR-2026-0001',
      request_date: '2026-11-10',
      requester_name: 'Storekeeper',
      status: 'submitted',
      submitted_at: '2026-11-10T09:00:00.000Z',
      decided_by_name: null,
      decided_at: null,
      decision_comment: null,
      line_count: 2,
      total_quantity: 20,
    },
  ],
  purchaseOrders: [
    {
      po_id: 'po-1',
      po_number: 'PO-2026-0001',
      order_date: '2026-11-11',
      expected_date: '2026-11-15',
      status: 'ordered',
      supplier_code: 'SUP-01',
      supplier_name: 'Fresh Foods',
      pr_number: 'PR-2026-0001',
      line_count: 2,
      ordered_value: 5000,
      received_value: 2000,
    },
  ],
  grns: [
    {
      grn_id: 'grn-1',
      grn_number: 'GRN-2026-0001',
      invoice_number: 'INV-9',
      received_date: '2026-11-14',
      supplier_code: 'SUP-01',
      supplier_name: 'Fresh Foods',
      location_code: 'MAIN-STORE',
      location_name: 'Main store',
      po_number: 'PO-2026-0001',
      posted_at: '2026-11-14T10:00:00.000Z',
      line_count: 2,
      total_value: 2000,
    },
  ],
  waste: [
    {
      adjustment_id: 'adj-1',
      adjustment_number: 'ADJ-2026-0001',
      adjustment_date: '2026-11-17',
      location_id: 'loc-1',
      location_code: 'MAIN-STORE',
      location_name: 'Main store',
      reason: 'Spoilage',
      notes: null,
      line_id: 'line-1',
      item_id: 'item-1',
      item_code: 'RICE',
      item_name: 'Rice',
      base_unit_code: 'g',
      entered_unit_code: 'kg',
      quantity: 0.5,
      base_quantity: 500,
      unit_cost: 0.24,
      waste_cost: 120,
    },
  ],
  theoretical: [
    {
      business_date: '2026-11-18',
      outlet_id: 'outlet-main',
      outlet_code: 'MAIN',
      outlet_name: 'Main Restaurant',
      menu_item_id: 'm-1',
      menu_item_code: 'OM-01',
      menu_item_name: 'Cheese omelette',
      portions_sold: 2,
      ingredient_item_id: 'item-3',
      ingredient_code: 'EGG',
      ingredient_name: 'Egg',
      base_unit_code: 'g',
      theoretical_quantity: 200,
      average_unit_cost: 1.5,
      theoretical_cost: 300,
    },
  ],
  variance: [
    {
      business_date: '2026-11-18',
      item_id: 'item-3',
      item_code: 'EGG',
      item_name: 'Egg',
      base_unit_code: 'g',
      theoretical_quantity: 200,
      theoretical_cost: 300,
      issued_quantity: 240,
      issued_cost: 400,
      waste_quantity: 20,
      variance_quantity: 40,
    },
  ],
  kitchen: [
    {
      order_id: 'o-1',
      order_number: 'ORD-MAIN-20261118-0001',
      business_date: '2026-11-18',
      outlet_id: 'outlet-main',
      outlet_code: 'MAIN',
      outlet_name: 'Main Restaurant',
      status: 'served',
      waiter_name: 'Test Waiter',
      opened_at: '2026-11-18T10:00:00.000Z',
      sent_at: '2026-11-18T10:05:00.000Z',
      preparing_at: '2026-11-18T10:08:00.000Z',
      ready_at: '2026-11-18T10:23:30.000Z',
      served_at: '2026-11-18T10:30:00.000Z',
      closed_at: '2026-11-18T11:00:00.000Z',
      cancelled_at: null,
      minutes_to_ready: 18.5,
      minutes_to_serve: 25,
      minutes_open: 60,
    },
  ],
  reservations: [
    {
      reserved_date: '2026-11-18',
      outlet_id: 'outlet-main',
      outlet_code: 'MAIN',
      outlet_name: 'Main Restaurant',
      total_reservations: 4,
      booked: 1,
      confirmed: 1,
      arrived: 2,
      completed: 0,
      cancelled: 0,
      unassigned: 1,
      covers: 12,
      expected_covers: 10,
    },
  ],
}

const signedIn: AuthContextValue = {
  state: {
    status: 'signed-in',
    user: {
      id: 'u1',
      email: 'manager@example.com',
      fullName: 'Test Manager',
      status: 'active',
      roles: ['general_manager'],
    },
  },
  signIn: async () => ({ error: null }),
  signOut: async () => {},
}

function renderReports() {
  return render(
    <AuthContext.Provider value={signedIn}>
      <Reports />
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  outletsApi.listOutlets.mockResolvedValue(OUTLETS)
  reportsApi.loadReports.mockResolvedValue(BUNDLE)
})

describe('Reports page', () => {
  it('renders every report section with the loaded totals', async () => {
    renderReports()

    expect(await screen.findByRole('heading', { name: 'Sales' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Inventory' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Purchasing' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cost and waste' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kitchen performance' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Reservations' })).toBeInTheDocument()

    const sales = screen.getByRole('region', { name: 'Sales' })
    expect(within(sales).getAllByText(/622\.15/).length).toBeGreaterThan(0)
    expect(within(sales).getByTestId('sales-reconciliation')).toHaveTextContent(/reconciled/i)
    expect(within(sales).getByText('Cheese omelette')).toBeInTheDocument()
    expect(within(sales).getByText('Main Course')).toBeInTheDocument()

    const inventory = screen.getByRole('region', { name: 'Inventory' })
    expect(within(inventory).getByText('Rice')).toBeInTheDocument()
    expect(within(inventory).getAllByText(/below reorder/i).length).toBeGreaterThan(0)

    const purchasing = screen.getByRole('region', { name: 'Purchasing' })
    expect(within(purchasing).getAllByText('PO-2026-0001').length).toBeGreaterThan(0)
    expect(within(purchasing).getAllByText(/5,000\.00/).length).toBeGreaterThan(0)

    const cost = screen.getByRole('region', { name: 'Cost and waste' })
    expect(within(cost).getAllByText(/120\.00/).length).toBeGreaterThan(0)
    expect(within(cost).getByText('Egg')).toBeInTheDocument()

    const kitchen = screen.getByRole('region', { name: 'Kitchen performance' })
    expect(within(kitchen).getAllByText(/18\.5 min/).length).toBeGreaterThan(0)

    const reservations = screen.getByRole('region', { name: 'Reservations' })
    expect(within(reservations).getByText('10')).toBeInTheDocument()
  })

  it('rejects an inverted date range without reloading', async () => {
    const user = userEvent.setup()
    renderReports()

    await screen.findByRole('heading', { name: 'Sales' })
    const callsBefore = reportsApi.loadReports.mock.calls.length

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2999-01-01' } })
    await user.click(screen.getByRole('button', { name: /apply filters/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/on or before/i)
    expect(reportsApi.loadReports.mock.calls.length).toBe(callsBefore)
  })

  it('passes the selected outlet to the report loader', async () => {
    const user = userEvent.setup()
    renderReports()

    await screen.findByRole('heading', { name: 'Sales' })
    await user.selectOptions(screen.getByLabelText('Outlet'), 'outlet-main')
    await user.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() =>
      expect(reportsApi.loadReports).toHaveBeenLastCalledWith(expect.any(Object), 'outlet-main'),
    )
    expect(screen.getByText(/for the selected outlet/i)).toBeInTheDocument()
  })

  it('filters inventory by the chosen idle-days threshold', async () => {
    const user = userEvent.setup()
    renderReports()

    const inventory = await screen.findByRole('region', { name: 'Inventory' })
    expect(within(inventory).getByText('Coffee beans')).toBeInTheDocument()

    await user.type(within(inventory).getByLabelText(/idle for at least/i), '10')

    expect(within(inventory).getByText('Rice')).toBeInTheDocument()
    expect(within(inventory).queryByText('Coffee beans')).toBeNull()
  })

  it('shows a retryable error when the views are unavailable', async () => {
    reportsApi.loadReports.mockRejectedValueOnce(
      new Error('This table is not in the database yet. Apply the pending Supabase migration.'),
    )

    renderReports()

    expect(
      await screen.findByText(/apply the pending supabase migration/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
