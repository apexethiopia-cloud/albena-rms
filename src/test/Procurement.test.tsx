import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { Purchasing } from '@/pages/Purchasing'

const procurementApi = vi.hoisted(() => ({
  listPurchaseRequests: vi.fn(),
  listPurchaseOrders: vi.fn(),
  createPurchaseRequest: vi.fn(),
  updatePurchaseRequest: vi.fn(),
  deletePurchaseRequest: vi.fn(),
  submitPurchaseRequest: vi.fn(),
  decidePurchaseRequest: vi.fn(),
  createPurchaseOrder: vi.fn(),
  updatePurchaseOrder: vi.fn(),
  deletePurchaseOrder: vi.fn(),
  approvePurchaseOrder: vi.fn(),
  markPurchaseOrderOrdered: vi.fn(),
  closePurchaseOrder: vi.fn(),
}))

const stockApi = vi.hoisted(() => ({
  listGrns: vi.fn(),
  createGrn: vi.fn(),
  postGrn: vi.fn(),
  listPurchaseOrderReceipts: vi.fn(),
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
  createItem: vi.fn(),
  createItemUnitConversion: vi.fn(),
  updateItem: vi.fn(),
  updateItemUnitConversion: vi.fn(),
}))

vi.mock('@/features/procurement/api', () => procurementApi)
vi.mock('@/features/stock/api', () => stockApi)
vi.mock('@/features/suppliers/api', () => suppliersApi)
vi.mock('@/features/items/api', () => itemsApi)
vi.mock('@/features/locations/api', () => ({
  listLocations: vi.fn().mockResolvedValue([]),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))

const SUPPLIER = {
  id: 's1',
  code: 'FRESH',
  name: 'Fresh Foods PLC',
  contact_name: 'Hanna',
  phone: null,
  email: null,
  address: null,
  tax_number: null,
  payment_terms: null,
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

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pr-1',
    pr_number: 'PR-0001',
    request_date: '2026-11-18',
    requested_by: 'u1',
    requester_name: 'Test Buyer',
    notes: null,
    status: 'draft',
    submitted_at: null,
    decided_by: null,
    decided_by_name: null,
    decided_at: null,
    decision_comment: null,
    created_at: '2026-11-18T10:00:00.000Z',
    updated_at: '2026-11-18T10:00:00.000Z',
    purchase_request_lines: [
      {
        id: 'prl-1',
        pr_id: 'pr-1',
        item_id: 'i-tomato',
        unit_id: 'u-kg',
        quantity: 2,
        created_at: '2026-11-18T10:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 'po-1',
    po_number: 'PO-0001',
    supplier_id: 's1',
    pr_id: 'pr-1',
    order_date: '2026-11-18',
    expected_date: null,
    notes: null,
    status: 'draft',
    created_by: 'u1',
    created_at: '2026-11-18T10:00:00.000Z',
    approved_by: null,
    approved_at: null,
    ordered_at: null,
    closed_at: null,
    updated_at: '2026-11-18T10:00:00.000Z',
    purchase_order_lines: [
      {
        id: 'pol-1',
        po_id: 'po-1',
        item_id: 'i-tomato',
        unit_id: 'u-kg',
        quantity: 2,
        unit_cost: 120,
        line_total: 240,
        created_at: '2026-11-18T10:00:00.000Z',
      },
    ],
    ...overrides,
  }
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

  procurementApi.listPurchaseRequests.mockResolvedValue([])
  procurementApi.listPurchaseOrders.mockResolvedValue([])
  procurementApi.createPurchaseRequest.mockResolvedValue('pr-2')
  procurementApi.updatePurchaseRequest.mockResolvedValue(undefined)
  procurementApi.deletePurchaseRequest.mockResolvedValue(undefined)
  procurementApi.submitPurchaseRequest.mockResolvedValue(undefined)
  procurementApi.decidePurchaseRequest.mockResolvedValue(undefined)
  procurementApi.createPurchaseOrder.mockResolvedValue('po-2')
  procurementApi.updatePurchaseOrder.mockResolvedValue(undefined)
  procurementApi.deletePurchaseOrder.mockResolvedValue(undefined)
  procurementApi.approvePurchaseOrder.mockResolvedValue(undefined)
  procurementApi.markPurchaseOrderOrdered.mockResolvedValue(undefined)
  procurementApi.closePurchaseOrder.mockResolvedValue(undefined)

  stockApi.listGrns.mockResolvedValue([])
  stockApi.createGrn.mockResolvedValue('grn-1')
  stockApi.postGrn.mockResolvedValue(undefined)
  stockApi.listPurchaseOrderReceipts.mockResolvedValue([])

  suppliersApi.listSuppliers.mockResolvedValue([SUPPLIER])
  suppliersApi.createSupplier.mockResolvedValue(undefined)
  suppliersApi.updateSupplier.mockResolvedValue(undefined)

  itemsApi.listItems.mockResolvedValue(ITEMS)
  itemsApi.listUnits.mockResolvedValue(UNITS)
  itemsApi.listItemUnitConversions.mockResolvedValue([])
  itemsApi.createItem.mockResolvedValue(undefined)
  itemsApi.createItemUnitConversion.mockResolvedValue(undefined)
  itemsApi.updateItem.mockResolvedValue(undefined)
  itemsApi.updateItemUnitConversion.mockResolvedValue(undefined)
})

describe('Purchasing — purchase requests', () => {
  it('lists requests with their status and recorded decision', async () => {
    procurementApi.listPurchaseRequests.mockResolvedValue([
      request(),
      request({ id: 'pr-2', pr_number: 'PR-0002', status: 'submitted' }),
      request({
        id: 'pr-3',
        pr_number: 'PR-0003',
        status: 'approved',
        decided_by: 'u2',
        decided_by_name: 'Ada Manager',
        decided_at: '2026-11-18T12:00:00.000Z',
        decision_comment: 'Approved for the weekend menu',
      }),
    ])

    renderPage()

    const section = await screen.findByRole('region', { name: /purchase requests/i })
    const draft = await within(section).findByRole('row', { name: /PR-0001/ })
    const submitted = within(section).getByRole('row', { name: /PR-0002/ })
    const approved = within(section).getByRole('row', { name: /PR-0003/ })

    expect(within(draft).getByText('Draft')).toBeInTheDocument()
    expect(within(submitted).getByText('Submitted')).toBeInTheDocument()
    expect(within(approved).getByText('Approved')).toBeInTheDocument()
    expect(within(approved).getByText(/Ada Manager/)).toBeInTheDocument()
    expect(within(approved).getByText(/weekend menu/i)).toBeInTheDocument()
    expect(within(section).getByText(/3 requests · 1 approved/i)).toBeInTheDocument()
  })

  it('creates a draft request with normalized values', async () => {
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /purchase requests/i })
    await within(section).findByText(/no purchase requests yet/i)
    await user.click(within(section).getByRole('button', { name: /new request/i }))

    expect(
      within(section).getByText(/number assigned automatically when saved/i),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Request number')).toBeNull()
    await user.selectOptions(screen.getByLabelText('Item for request line 1'), 'i-tomato')
    await user.selectOptions(screen.getByLabelText('Unit for request line 1'), 'u-kg')
    await user.type(screen.getByLabelText('Quantity for request line 1'), '2')
    await user.click(within(section).getByRole('button', { name: /save draft/i }))

    await waitFor(() => {
      expect(procurementApi.createPurchaseRequest).toHaveBeenCalledWith({
        requestDate: expect.any(String),
        notes: null,
        lines: [{ itemId: 'i-tomato', unitId: 'u-kg', quantity: 2 }],
      })
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/saved as a draft/i)
  })

  it('blocks an incomplete request before calling the database', async () => {
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /purchase requests/i })
    await within(section).findByText(/no purchase requests yet/i)
    await user.click(within(section).getByRole('button', { name: /new request/i }))
    await user.click(within(section).getByRole('button', { name: /save draft/i }))

    expect(procurementApi.createPurchaseRequest).not.toHaveBeenCalled()
    expect(within(section).getByText(/quantity greater than zero/i)).toBeInTheDocument()
  })

  it('edits a draft request through the update RPC', async () => {
    procurementApi.listPurchaseRequests.mockResolvedValue([request()])
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /purchase requests/i })
    const row = await within(section).findByRole('row', { name: /PR-0001/ })
    await user.click(within(row).getByRole('button', { name: 'Edit' }))

    const form = await screen.findByRole('form', { name: /edit purchase request/i })
    expect(within(form).getByLabelText('Request date')).toHaveValue('2026-11-18')
    expect(within(form).getByLabelText('Quantity for request line 1')).toHaveValue(2)
    await user.type(within(form).getByLabelText('Notes'), 'Editor notes')
    await user.click(within(form).getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(procurementApi.updatePurchaseRequest).toHaveBeenCalledWith('pr-1', {
        requestDate: '2026-11-18',
        notes: 'Editor notes',
        lines: [{ itemId: 'i-tomato', unitId: 'u-kg', quantity: 2 }],
      })
    })
    expect(procurementApi.createPurchaseRequest).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent(/PR PR-0001 updated/i)
  })

  it('deletes a draft request only after confirmation', async () => {
    procurementApi.listPurchaseRequests.mockResolvedValue([request()])
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /purchase requests/i })
    const row = await within(section).findByRole('row', { name: /PR-0001/ })
    const callsBeforeDelete = procurementApi.listPurchaseRequests.mock.calls.length
    await user.click(within(row).getByRole('button', { name: 'Delete' }))

    const dialog = await screen.findByRole('alertdialog', { name: /delete PR-0001/i })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(procurementApi.deletePurchaseRequest).not.toHaveBeenCalled()

    await user.click(within(row).getByRole('button', { name: 'Delete' }))
    const confirm = await screen.findByRole('alertdialog', { name: /delete PR-0001/i })
    await user.click(within(confirm).getByRole('button', { name: /delete request/i }))

    await waitFor(() => {
      expect(procurementApi.deletePurchaseRequest).toHaveBeenCalledWith('pr-1')
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/PR PR-0001 deleted/i)
    await waitFor(() => {
      expect(procurementApi.listPurchaseRequests.mock.calls.length).toBeGreaterThan(
        callsBeforeDelete,
      )
    })
  })

  it('never offers edit or delete for requests past draft', async () => {
    procurementApi.listPurchaseRequests.mockResolvedValue([
      request({ id: 'pr-2', pr_number: 'PR-0002', status: 'submitted' }),
      request({ id: 'pr-3', pr_number: 'PR-0003', status: 'approved' }),
      request({ id: 'pr-4', pr_number: 'PR-0004', status: 'rejected' }),
    ])
    renderPage()

    const section = await screen.findByRole('region', { name: /purchase requests/i })
    for (const number of ['PR-0002', 'PR-0003', 'PR-0004']) {
      const row = await within(section).findByRole('row', { name: new RegExp(number) })
      expect(within(row).queryByRole('button', { name: 'Edit' })).toBeNull()
      expect(within(row).queryByRole('button', { name: 'Delete' })).toBeNull()
    }
  })

  it('submits a draft request for approval', async () => {
    procurementApi.listPurchaseRequests.mockResolvedValue([request()])
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /purchase requests/i })
    const row = await within(section).findByRole('row', { name: /PR-0001/ })
    await user.click(within(row).getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(procurementApi.submitPurchaseRequest).toHaveBeenCalledWith('pr-1')
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      /PR PR-0001 submitted for approval/i,
    )
  })

  it('lets the general manager approve with a comment', async () => {
    procurementApi.listPurchaseRequests.mockResolvedValue([
      request({ status: 'submitted' }),
    ])
    const user = userEvent.setup()
    renderPage(['general_manager'])

    const section = await screen.findByRole('region', { name: /purchase requests/i })
    const row = await within(section).findByRole('row', { name: /PR-0001/ })
    await user.click(within(row).getByRole('button', { name: 'Approve' }))

    expect(within(section).getByText(/decide PR-0001/i)).toBeInTheDocument()
    await user.type(
      within(section).getByLabelText('Decision comment'),
      'Approved for the weekend menu',
    )
    await user.click(within(section).getByRole('button', { name: /approve request/i }))

    await waitFor(() => {
      expect(procurementApi.decidePurchaseRequest).toHaveBeenCalledWith(
        'pr-1',
        'approved',
        'Approved for the weekend menu',
      )
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/PR PR-0001 approved/i)
  })

  it('hides approval from a purchasing officer and offers PO creation for approved requests', async () => {
    procurementApi.listPurchaseRequests.mockResolvedValue([
      request({ id: 'pr-2', pr_number: 'PR-0002', status: 'submitted' }),
      request({ id: 'pr-3', pr_number: 'PR-0003', status: 'approved' }),
    ])
    renderPage(['purchasing_officer'])

    const section = await screen.findByRole('region', { name: /purchase requests/i })
    const submitted = await within(section).findByRole('row', { name: /PR-0002/ })
    const approved = within(section).getByRole('row', { name: /PR-0003/ })

    expect(within(submitted).queryByRole('button', { name: 'Approve' })).toBeNull()
    expect(within(approved).getByRole('button', { name: /create po/i })).toBeInTheDocument()
  })

  it('shows a read-only notice to a waiter', async () => {
    renderPage(['waiter'])

    const section = await screen.findByRole('region', { name: /purchase requests/i })
    expect(within(section).queryByRole('button', { name: /new request/i })).toBeNull()
    expect(within(section).getByText(/read-only/i)).toBeInTheDocument()
  })
})

describe('Purchasing — purchase orders', () => {
  it('seeds an order from an approved request and saves the draft', async () => {
    procurementApi.listPurchaseRequests.mockResolvedValue([
      request({ status: 'approved' }),
    ])
    const user = userEvent.setup()
    renderPage(['purchasing_officer'])

    const requests = await screen.findByRole('region', { name: /purchase requests/i })
    const requestRow = await within(requests).findByRole('row', { name: /PR-0001/ })
    await user.click(within(requestRow).getByRole('button', { name: /create po/i }))

    const form = await screen.findByRole('form', { name: /new purchase order/i })
    expect(screen.getByText(/creating a purchase order for PR-0001/i)).toBeInTheDocument()
    expect(
      within(form).getByText(/number assigned automatically when saved/i),
    ).toBeInTheDocument()
    expect(within(form).queryByLabelText('PO number')).toBeNull()

    await user.selectOptions(within(form).getByLabelText('Supplier'), 's1')
    await user.type(within(form).getByLabelText('Unit cost for order line 1'), '120')
    await user.click(within(form).getByRole('button', { name: /save draft/i }))

    await waitFor(() => {
      expect(procurementApi.createPurchaseOrder).toHaveBeenCalledWith({
        supplierId: 's1',
        prId: 'pr-1',
        orderDate: expect.any(String),
        expectedDate: null,
        notes: null,
        lines: [{ itemId: 'i-tomato', unitId: 'u-kg', quantity: 2, unitCost: 120 }],
      })
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/saved as a draft/i)
  })

  it('edits a draft order through the update RPC', async () => {
    procurementApi.listPurchaseRequests.mockResolvedValue([request({ status: 'approved' })])
    procurementApi.listPurchaseOrders.mockResolvedValue([order()])
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /purchase orders/i })
    const row = await within(section).findByRole('row', { name: /PO-0001/ })
    await user.click(within(row).getByRole('button', { name: 'Edit' }))

    const form = await screen.findByRole('form', { name: /edit purchase order/i })
    expect(within(form).getByLabelText('Supplier')).toHaveValue('s1')
    expect(within(form).getByLabelText('Unit cost for order line 1')).toHaveValue(120)
    expect(within(form).getByLabelText(/source request/i)).toBeDisabled()
    await user.clear(within(form).getByLabelText('Unit cost for order line 1'))
    await user.type(within(form).getByLabelText('Unit cost for order line 1'), '150')
    await user.click(within(form).getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(procurementApi.updatePurchaseOrder).toHaveBeenCalledWith('po-1', {
        supplierId: 's1',
        prId: 'pr-1',
        orderDate: '2026-11-18',
        expectedDate: null,
        notes: null,
        lines: [{ itemId: 'i-tomato', unitId: 'u-kg', quantity: 2, unitCost: 150 }],
      })
    })
    expect(procurementApi.createPurchaseOrder).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent(/PO PO-0001 updated/i)
  })

  it('deletes a draft order only after confirmation', async () => {
    procurementApi.listPurchaseOrders.mockResolvedValue([order()])
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /purchase orders/i })
    const row = await within(section).findByRole('row', { name: /PO-0001/ })
    const callsBeforeDelete = procurementApi.listPurchaseOrders.mock.calls.length
    await user.click(within(row).getByRole('button', { name: 'Delete' }))

    const dialog = await screen.findByRole('alertdialog', { name: /delete PO-0001/i })
    await user.click(within(dialog).getByRole('button', { name: /delete order/i }))

    await waitFor(() => {
      expect(procurementApi.deletePurchaseOrder).toHaveBeenCalledWith('po-1')
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/PO PO-0001 deleted/i)
    await waitFor(() => {
      expect(procurementApi.listPurchaseOrders.mock.calls.length).toBeGreaterThan(
        callsBeforeDelete,
      )
    })
  })

  it('never offers edit or delete for orders past draft', async () => {
    procurementApi.listPurchaseOrders.mockResolvedValue([
      order({ id: 'po-2', po_number: 'PO-0002', status: 'approved' }),
      order({ id: 'po-3', po_number: 'PO-0003', status: 'ordered' }),
      order({ id: 'po-4', po_number: 'PO-0004', status: 'closed' }),
    ])
    renderPage()

    const section = await screen.findByRole('region', { name: /purchase orders/i })
    for (const number of ['PO-0002', 'PO-0003', 'PO-0004']) {
      const row = await within(section).findByRole('row', { name: new RegExp(number) })
      expect(within(row).queryByRole('button', { name: 'Edit' })).toBeNull()
      expect(within(row).queryByRole('button', { name: 'Delete' })).toBeNull()
    }
  })

  it('advances an order through approval, ordering and closing', async () => {
    procurementApi.listPurchaseOrders.mockResolvedValue([
      order(),
      order({ id: 'po-2', po_number: 'PO-0002', status: 'approved' }),
      order({ id: 'po-3', po_number: 'PO-0003', status: 'ordered' }),
    ])
    const user = userEvent.setup()
    renderPage(['general_manager'])

    const section = await screen.findByRole('region', { name: /purchase orders/i })
    const draft = await within(section).findByRole('row', { name: /PO-0001/ })
    const approved = within(section).getByRole('row', { name: /PO-0002/ })
    const ordered = within(section).getByRole('row', { name: /PO-0003/ })

    await user.click(within(draft).getByRole('button', { name: 'Approve' }))
    await waitFor(() => {
      expect(procurementApi.approvePurchaseOrder).toHaveBeenCalledWith('po-1')
    })

    await user.click(within(approved).getByRole('button', { name: /mark ordered/i }))
    await waitFor(() => {
      expect(procurementApi.markPurchaseOrderOrdered).toHaveBeenCalledWith('po-2')
    })

    await user.click(within(ordered).getByRole('button', { name: 'Close' }))
    await waitFor(() => {
      expect(procurementApi.closePurchaseOrder).toHaveBeenCalledWith('po-3')
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/closed/i)
  })

  it('lists orders with supplier, source request and status', async () => {
    procurementApi.listPurchaseRequests.mockResolvedValue([
      request({ status: 'approved' }),
    ])
    procurementApi.listPurchaseOrders.mockResolvedValue([
      order(),
      order({ id: 'po-2', po_number: 'PO-0002', pr_id: null, status: 'ordered' }),
    ])

    renderPage()

    const section = await screen.findByRole('region', { name: /purchase orders/i })
    const first = await within(section).findByRole('row', { name: /PO-0001/ })
    const second = within(section).getByRole('row', { name: /PO-0002/ })

    expect(within(first).getByText('Fresh Foods PLC')).toBeInTheDocument()
    expect(within(first).getByText('PR-0001')).toBeInTheDocument()
    expect(within(first).getByText('Draft')).toBeInTheDocument()
    expect(within(second).getByText('Ordered')).toBeInTheDocument()
    expect(within(section).getByText(/2 orders · 2 open/i)).toBeInTheDocument()
  })

  it('shows a read-only notice to a waiter', async () => {
    renderPage(['waiter'])

    const section = await screen.findByRole('region', { name: /purchase orders/i })
    expect(within(section).queryByRole('button', { name: /new po/i })).toBeNull()
    expect(within(section).getByText(/read-only/i)).toBeInTheDocument()
  })
})
