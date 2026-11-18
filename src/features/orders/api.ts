import { requireSupabase } from '@/lib/supabase'
import { describeOrderDbError, type NormalizedOrder } from './validation'

export type Numberish = number | string

export type OrderStatus =
  | 'pending'
  | 'sent_to_kitchen'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'closed'
  | 'cancelled'

export type OrderLine = {
  id: string
  order_id: string
  menu_item_id: string | null
  item_code: string
  item_name: string
  unit_price: Numberish
  quantity: number
  line_total: Numberish
  special_instructions: string | null
}

export type Order = {
  id: string
  order_number: string
  outlet_id: string
  table_id: string | null
  waiter_id: string | null
  waiter_name: string
  status: OrderStatus
  revision: number
  notes: string | null
  opened_at: string
  updated_at: string
  sent_at: string | null
  preparing_at: string | null
  ready_at: string | null
  served_at: string | null
  closed_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  subtotal: Numberish | null
  vat_amount: Numberish | null
  total: Numberish | null
  order_lines: OrderLine[]
  restaurant_tables: { code: string; name: string } | null
}

export type Receipt = {
  id: string
  receipt_number: string
  order_id: string
  outlet_id: string
  issued_at: string
  business_name: string
  business_tin: string | null
  business_address: string | null
  business_phone: string | null
  vat_rate: Numberish
  subtotal: Numberish
  vat_amount: Numberish
  total: Numberish
  table_code: string | null
  waiter_name: string
  line_count: number
}

const ORDER_COLUMNS = `
  id, order_number, outlet_id, table_id, waiter_id, waiter_name, status, revision,
  notes, opened_at, updated_at, sent_at, preparing_at, ready_at, served_at,
  closed_at, cancelled_at, cancel_reason, subtotal, vat_amount, total,
  order_lines (
    id, order_id, menu_item_id, item_code, item_name, unit_price, quantity,
    line_total, special_instructions
  ),
  restaurant_tables (code, name)
`

export async function listOrders(): Promise<Order[]> {
  const { data, error } = await requireSupabase()
    .from('orders')
    .select(ORDER_COLUMNS)
    .order('opened_at', { ascending: false })

  if (error) throw new Error(describeOrderDbError(error))
  return (data ?? []) as unknown as Order[]
}

export async function listKitchenOrders(): Promise<Order[]> {
  const { data, error } = await requireSupabase()
    .from('orders')
    .select(ORDER_COLUMNS)
    .in('status', ['sent_to_kitchen', 'preparing', 'ready'])
    .order('sent_at', { ascending: true })

  if (error) throw new Error(describeOrderDbError(error))
  return (data ?? []) as unknown as Order[]
}

export async function createOrder(input: NormalizedOrder): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_order', {
    p_outlet_id: input.outletId,
    p_table_id: input.tableId,
    p_notes: input.notes,
    p_lines: input.lines.map((line) => ({
      menu_item_id: line.menuItemId,
      quantity: line.quantity,
      special_instructions: line.specialInstructions,
    })),
  })

  if (error) throw new Error(describeOrderDbError(error))
  if (!data) throw new Error('The order was saved but no reference was returned. Refresh the list.')
  return data as string
}

export async function updateOrder(
  id: string,
  expectedRevision: number,
  input: NormalizedOrder,
): Promise<void> {
  const { error } = await requireSupabase().rpc('update_order', {
    p_order_id: id,
    p_expected_revision: expectedRevision,
    p_table_id: input.tableId,
    p_notes: input.notes,
    p_lines: input.lines.map((line) => ({
      menu_item_id: line.menuItemId,
      quantity: line.quantity,
      special_instructions: line.specialInstructions,
    })),
  })

  if (error) throw new Error(describeOrderDbError(error))
}

export async function setOrderStatus(
  id: string,
  status: OrderStatus,
  expectedRevision: number,
): Promise<void> {
  const { error } = await requireSupabase().rpc('set_order_status', {
    p_order_id: id,
    p_status: status,
    p_expected_revision: expectedRevision,
  })

  if (error) throw new Error(describeOrderDbError(error))
}

export async function cancelOrder(
  id: string,
  reason: string,
  expectedRevision: number,
): Promise<void> {
  const { error } = await requireSupabase().rpc('cancel_order', {
    p_order_id: id,
    p_reason: reason,
    p_expected_revision: expectedRevision,
  })

  if (error) throw new Error(describeOrderDbError(error))
}

export async function transferOrder(
  id: string,
  tableId: string,
  expectedRevision: number,
): Promise<void> {
  const { error } = await requireSupabase().rpc('transfer_order', {
    p_order_id: id,
    p_table_id: tableId,
    p_expected_revision: expectedRevision,
  })

  if (error) throw new Error(describeOrderDbError(error))
}

export async function splitOrder(
  id: string,
  lineIds: string[],
  newTableId: string | null,
  expectedRevision: number,
): Promise<string> {
  const { data, error } = await requireSupabase().rpc('split_order', {
    p_order_id: id,
    p_line_ids: lineIds,
    p_new_table_id: newTableId,
    p_expected_revision: expectedRevision,
  })

  if (error) throw new Error(describeOrderDbError(error))
  if (!data) throw new Error('The split order was saved but no reference was returned.')
  return data as string
}

export async function mergeOrders(
  sourceId: string,
  targetId: string,
  expectedRevisionSource: number,
  expectedRevisionTarget: number,
): Promise<void> {
  const { error } = await requireSupabase().rpc('merge_orders', {
    p_source_order_id: sourceId,
    p_target_order_id: targetId,
    p_expected_revision_source: expectedRevisionSource,
    p_expected_revision_target: expectedRevisionTarget,
  })

  if (error) throw new Error(describeOrderDbError(error))
}

/** Closing the order issues the receipt and returns its id. */
export async function closeOrder(id: string, expectedRevision: number): Promise<string> {
  const { data, error } = await requireSupabase().rpc('close_order', {
    p_order_id: id,
    p_expected_revision: expectedRevision,
  })

  if (error) throw new Error(describeOrderDbError(error))
  if (!data) throw new Error('The order closed but no receipt reference was returned.')
  return data as string
}

const RECEIPT_COLUMNS = `
  id, receipt_number, order_id, outlet_id, issued_at, business_name, business_tin,
  business_address, business_phone, vat_rate, subtotal, vat_amount, total,
  table_code, waiter_name, line_count
`

export async function getReceipt(id: string): Promise<Receipt> {
  const { data, error } = await requireSupabase()
    .from('receipts')
    .select(RECEIPT_COLUMNS)
    .eq('id', id)
    .single()

  if (error) throw new Error(describeOrderDbError(error))
  return data as unknown as Receipt
}

export async function getReceiptByOrder(orderId: string): Promise<Receipt | null> {
  const { data, error } = await requireSupabase()
    .from('receipts')
    .select(RECEIPT_COLUMNS)
    .eq('order_id', orderId)
    .maybeSingle()

  if (error) throw new Error(describeOrderDbError(error))
  return (data as unknown as Receipt | null) ?? null
}

/**
 * Realtime subscription for the kitchen display (KDS-03). The database is
 * still the source of truth: the callback only asks the panel to refetch.
 */
export function subscribeToOrderChanges(onChange: () => void): () => void {
  const channel = requireSupabase()
    .channel('kitchen-orders')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'order_lines' },
      () => onChange(),
    )
    .subscribe()

  return () => {
    void requireSupabase().removeChannel(channel)
  }
}
