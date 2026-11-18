import { requireSupabase } from '@/lib/supabase'
import {
  describeProcurementDbError,
  type NormalizedPurchaseOrder,
  type NormalizedPurchaseRequest,
  type PurchaseOrderStatus,
  type PurchaseRequestStatus,
} from './validation'

export type Numberish = number | string

export type PurchaseRequestLine = {
  id: string
  pr_id: string
  item_id: string
  unit_id: string
  quantity: Numberish
  created_at: string
}

export type PurchaseRequest = {
  id: string
  pr_number: string
  request_date: string
  requested_by: string | null
  requester_name: string
  notes: string | null
  status: PurchaseRequestStatus
  submitted_at: string | null
  decided_by: string | null
  decided_by_name: string | null
  decided_at: string | null
  decision_comment: string | null
  created_at: string
  updated_at: string
  purchase_request_lines: PurchaseRequestLine[]
}

export type PurchaseOrderLine = {
  id: string
  po_id: string
  item_id: string
  unit_id: string
  quantity: Numberish
  unit_cost: Numberish
  line_total: Numberish
  created_at: string
}

export type PurchaseOrder = {
  id: string
  po_number: string
  supplier_id: string
  pr_id: string | null
  order_date: string
  expected_date: string | null
  notes: string | null
  status: PurchaseOrderStatus
  created_by: string | null
  created_at: string
  approved_by: string | null
  approved_at: string | null
  ordered_at: string | null
  closed_at: string | null
  updated_at: string
  purchase_order_lines: PurchaseOrderLine[]
}

const REQUEST_COLUMNS = `
  id, pr_number, request_date, requested_by, requester_name, notes, status,
  submitted_at, decided_by, decided_by_name, decided_at, decision_comment,
  created_at, updated_at,
  purchase_request_lines (id, pr_id, item_id, unit_id, quantity, created_at)
`

const ORDER_COLUMNS = `
  id, po_number, supplier_id, pr_id, order_date, expected_date, notes, status,
  created_by, created_at, approved_by, approved_at, ordered_at, closed_at, updated_at,
  purchase_order_lines (id, po_id, item_id, unit_id, quantity, unit_cost, line_total, created_at)
`

export async function listPurchaseRequests(): Promise<PurchaseRequest[]> {
  const { data, error } = await requireSupabase()
    .from('purchase_requests')
    .select(REQUEST_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw new Error(describeProcurementDbError(error))
  return (data ?? []) as unknown as PurchaseRequest[]
}

export async function createPurchaseRequest(
  input: NormalizedPurchaseRequest,
): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_purchase_request', {
    p_pr_number: input.prNumber,
    p_request_date: input.requestDate,
    p_notes: input.notes,
    p_lines: input.lines.map((line) => ({
      item_id: line.itemId,
      unit_id: line.unitId,
      quantity: line.quantity,
    })),
  })

  if (error) throw new Error(describeProcurementDbError(error))
  if (!data) {
    throw new Error('The request was saved but no reference was returned. Refresh the list.')
  }
  return data as string
}

export async function submitPurchaseRequest(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('submit_purchase_request', { p_pr_id: id })
  if (error) throw new Error(describeProcurementDbError(error))
}

export async function decidePurchaseRequest(
  id: string,
  decision: 'approved' | 'rejected',
  comment: string,
): Promise<void> {
  const { error } = await requireSupabase().rpc('decide_purchase_request', {
    p_pr_id: id,
    p_decision: decision,
    p_comment: comment,
  })

  if (error) throw new Error(describeProcurementDbError(error))
}

export async function listPurchaseOrders(): Promise<PurchaseOrder[]> {
  const { data, error } = await requireSupabase()
    .from('purchase_orders')
    .select(ORDER_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw new Error(describeProcurementDbError(error))
  return (data ?? []) as unknown as PurchaseOrder[]
}

export async function createPurchaseOrder(input: NormalizedPurchaseOrder): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_purchase_order', {
    p_po_number: input.poNumber,
    p_supplier_id: input.supplierId,
    p_pr_id: input.prId,
    p_order_date: input.orderDate,
    p_expected_date: input.expectedDate,
    p_notes: input.notes,
    p_lines: input.lines.map((line) => ({
      item_id: line.itemId,
      unit_id: line.unitId,
      quantity: line.quantity,
      unit_cost: line.unitCost,
    })),
  })

  if (error) throw new Error(describeProcurementDbError(error))
  if (!data) {
    throw new Error(
      'The purchase order was saved but no reference was returned. Refresh the list.',
    )
  }
  return data as string
}

export async function approvePurchaseOrder(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('approve_purchase_order', { p_po_id: id })
  if (error) throw new Error(describeProcurementDbError(error))
}

export async function markPurchaseOrderOrdered(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('mark_purchase_order_ordered', { p_po_id: id })
  if (error) throw new Error(describeProcurementDbError(error))
}

export async function closePurchaseOrder(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('close_purchase_order', { p_po_id: id })
  if (error) throw new Error(describeProcurementDbError(error))
}
