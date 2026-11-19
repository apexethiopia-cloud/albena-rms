import { requireSupabase } from '@/lib/supabase'
import {
  describeStockDbError,
  type AdjustmentKind,
  type NormalizedAdjustment,
  type NormalizedCount,
  type NormalizedGrn,
  type NormalizedSiv,
} from './validation'

export type Numberish = number | string

export type GrnLine = {
  id: string
  grn_id: string
  item_id: string
  unit_id: string
  quantity: Numberish
  unit_cost: Numberish
  line_total: Numberish
  base_quantity: Numberish | null
  base_unit_cost: Numberish | null
  po_line_id: string | null
  created_at: string
}

export type Grn = {
  id: string
  grn_number: string
  supplier_id: string
  invoice_number: string
  received_date: string
  location_id: string
  notes: string | null
  po_id: string | null
  created_by: string | null
  created_at: string
  posted_by: string | null
  posted_at: string | null
  grn_lines: GrnLine[]
}

export type SivLine = {
  id: string
  siv_id: string
  item_id: string
  unit_id: string
  quantity: Numberish
  base_quantity: Numberish | null
  posted_cost: Numberish | null
  created_at: string
}

export type Siv = {
  id: string
  siv_number: string
  issue_date: string
  source_location_id: string
  destination_location_id: string
  notes: string | null
  requested_by: string | null
  created_at: string
  posted_by: string | null
  posted_at: string | null
  siv_lines: SivLine[]
}

export type StockBalance = {
  item_id: string
  item_code: string
  item_name: string
  base_unit_code: string
  location_id: string
  location_code: string
  location_name: string
  quantity: Numberish
  total_value: Numberish
  last_movement_at: string | null
}

export type StockMovement = {
  id: string
  posted_at: string
  transaction_type: 'opening' | 'grn' | 'siv' | 'adjustment' | 'waste' | 'production'
  direction: 'in' | 'out'
  item_id: string
  item_code: string
  item_name: string
  base_unit_code: string
  location_id: string
  location_code: string
  location_name: string
  quantity: Numberish
  unit_cost: Numberish
  total_cost: Numberish
  reference_type: string
  reference_id: string
  reference_number: string | null
}

export type ReceiptStatus = 'pending' | 'partial' | 'complete' | 'over'

export type PurchaseOrderReceipt = {
  po_id: string
  po_number: string
  po_status: string
  po_line_id: string
  item_id: string
  item_code: string
  item_name: string
  ordered_unit_id: string
  ordered_unit_code: string
  ordered_quantity: Numberish
  unit_cost: Numberish
  ordered_base_quantity: Numberish
  received_base_quantity: Numberish
  outstanding_base_quantity: Numberish
  receipt_status: ReceiptStatus
}

export type InventoryDocumentStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'posted'

export type AdjustmentLine = {
  id: string
  adjustment_id: string
  item_id: string
  unit_id: string
  direction: 'in' | 'out'
  quantity: Numberish
  unit_cost: Numberish | null
  base_quantity: Numberish | null
  posted_cost: Numberish | null
  created_at: string
}

export type InventoryAdjustment = {
  id: string
  adjustment_number: string
  kind: AdjustmentKind
  adjustment_date: string
  location_id: string
  reason: string
  notes: string | null
  status: InventoryDocumentStatus
  created_by: string | null
  created_at: string
  submitted_at: string | null
  decided_by: string | null
  decided_by_name: string | null
  decided_at: string | null
  decision_comment: string | null
  posted_by: string | null
  posted_at: string | null
  inventory_adjustment_lines: AdjustmentLine[]
}

export type InventoryCountLine = {
  id: string
  count_id: string
  item_id: string
  system_quantity: Numberish
  physical_quantity: Numberish
  variance_quantity: Numberish
  posted_quantity: Numberish | null
  posted_cost: Numberish | null
  created_at: string
}

export type InventoryCount = {
  id: string
  count_number: string
  count_date: string
  location_id: string
  counter_name: string
  notes: string | null
  status: InventoryDocumentStatus
  created_by: string | null
  created_at: string
  submitted_at: string | null
  decided_by: string | null
  decided_by_name: string | null
  decided_at: string | null
  decision_comment: string | null
  posted_by: string | null
  posted_at: string | null
  inventory_count_lines: InventoryCountLine[]
}

export type ReorderStatus = {
  item_id: string
  item_code: string
  item_name: string
  base_unit_code: string
  reorder_level: Numberish
  on_hand: Numberish
  shortage: Numberish
  is_low: boolean
}

const GRN_COLUMNS = `
  id, grn_number, supplier_id, invoice_number, received_date, location_id, notes, po_id,
  created_by, created_at, posted_by, posted_at,
  grn_lines (
    id, grn_id, item_id, unit_id, quantity, unit_cost, line_total,
    base_quantity, base_unit_cost, po_line_id, created_at
  )
`

const SIV_COLUMNS = `
  id, siv_number, issue_date, source_location_id, destination_location_id, notes,
  requested_by, created_at, posted_by, posted_at,
  siv_lines (id, siv_id, item_id, unit_id, quantity, base_quantity, posted_cost, created_at)
`

export async function listGrns(): Promise<Grn[]> {
  const { data, error } = await requireSupabase()
    .from('grns')
    .select(GRN_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw new Error(describeStockDbError(error))
  return (data ?? []) as unknown as Grn[]
}

function grnLines(input: NormalizedGrn) {
  return input.lines.map((line) => ({
    item_id: line.itemId,
    unit_id: line.unitId,
    quantity: line.quantity,
    unit_cost: line.unitCost,
    po_line_id: line.poLineId,
  }))
}

export async function createGrn(input: NormalizedGrn): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_grn', {
    p_supplier_id: input.supplierId,
    p_invoice_number: input.invoiceNumber,
    p_received_date: input.receivedDate,
    p_location_id: input.locationId,
    p_notes: input.notes,
    p_po_id: input.poId,
    p_lines: grnLines(input),
  })

  if (error) throw new Error(describeStockDbError(error))
  if (!data) throw new Error('The GRN was saved but no reference was returned. Refresh the list.')
  return data as string
}

export async function updateGrn(id: string, input: NormalizedGrn): Promise<void> {
  const { error } = await requireSupabase().rpc('update_grn', {
    p_grn_id: id,
    p_supplier_id: input.supplierId,
    p_invoice_number: input.invoiceNumber,
    p_received_date: input.receivedDate,
    p_location_id: input.locationId,
    p_notes: input.notes,
    p_lines: grnLines(input),
  })

  if (error) throw new Error(describeStockDbError(error))
}

export async function deleteGrn(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('delete_grn', { p_grn_id: id })
  if (error) throw new Error(describeStockDbError(error))
}

export async function listPurchaseOrderReceipts(): Promise<PurchaseOrderReceipt[]> {
  const { data, error } = await requireSupabase()
    .from('purchase_order_receipts')
    .select(
      `po_id, po_number, po_status, po_line_id, item_id, item_code, item_name,
       ordered_unit_id, ordered_unit_code, ordered_quantity, unit_cost,
       ordered_base_quantity, received_base_quantity, outstanding_base_quantity,
       receipt_status`,
    )
    .order('po_number', { ascending: true })

  if (error) throw new Error(describeStockDbError(error))
  return (data ?? []) as unknown as PurchaseOrderReceipt[]
}

export async function postGrn(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('post_grn', { p_grn_id: id })
  if (error) throw new Error(describeStockDbError(error))
}

export async function listSivs(): Promise<Siv[]> {
  const { data, error } = await requireSupabase()
    .from('sivs')
    .select(SIV_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw new Error(describeStockDbError(error))
  return (data ?? []) as unknown as Siv[]
}

function sivLines(input: NormalizedSiv) {
  return input.lines.map((line) => ({
    item_id: line.itemId,
    unit_id: line.unitId,
    quantity: line.quantity,
  }))
}

export async function createSiv(input: NormalizedSiv): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_siv', {
    p_issue_date: input.issueDate,
    p_source_location_id: input.sourceLocationId,
    p_destination_location_id: input.destinationLocationId,
    p_notes: input.notes,
    p_lines: sivLines(input),
  })

  if (error) throw new Error(describeStockDbError(error))
  if (!data) throw new Error('The SIV was saved but no reference was returned. Refresh the list.')
  return data as string
}

export async function updateSiv(id: string, input: NormalizedSiv): Promise<void> {
  const { error } = await requireSupabase().rpc('update_siv', {
    p_siv_id: id,
    p_issue_date: input.issueDate,
    p_source_location_id: input.sourceLocationId,
    p_destination_location_id: input.destinationLocationId,
    p_notes: input.notes,
    p_lines: sivLines(input),
  })

  if (error) throw new Error(describeStockDbError(error))
}

export async function deleteSiv(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('delete_siv', { p_siv_id: id })
  if (error) throw new Error(describeStockDbError(error))
}

export async function postSiv(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('post_siv', { p_siv_id: id })
  if (error) throw new Error(describeStockDbError(error))
}

export async function listStockBalances(): Promise<StockBalance[]> {
  const { data, error } = await requireSupabase()
    .from('stock_balances')
    .select(
      'item_id, item_code, item_name, base_unit_code, location_id, location_code, location_name, quantity, total_value, last_movement_at',
    )
    .order('item_name', { ascending: true })
    .order('location_name', { ascending: true })

  if (error) throw new Error(describeStockDbError(error))
  return (data ?? []) as unknown as StockBalance[]
}

export async function listStockMovements(limit = 20): Promise<StockMovement[]> {
  const { data, error } = await requireSupabase()
    .from('stock_ledger_entries')
    .select(
      'id, posted_at, transaction_type, direction, item_id, item_code, item_name, base_unit_code, location_id, location_code, location_name, quantity, unit_cost, total_cost, reference_type, reference_id, reference_number',
    )
    .order('posted_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(describeStockDbError(error))
  return (data ?? []) as unknown as StockMovement[]
}

const ADJUSTMENT_COLUMNS = `
  id, adjustment_number, kind, adjustment_date, location_id, reason, notes, status,
  created_by, created_at, submitted_at, decided_by, decided_by_name, decided_at,
  decision_comment, posted_by, posted_at,
  inventory_adjustment_lines (
    id, adjustment_id, item_id, unit_id, direction, quantity, unit_cost,
    base_quantity, posted_cost, created_at
  )
`

const COUNT_COLUMNS = `
  id, count_number, count_date, location_id, counter_name, notes, status,
  created_by, created_at, submitted_at, decided_by, decided_by_name, decided_at,
  decision_comment, posted_by, posted_at,
  inventory_count_lines (
    id, count_id, item_id, system_quantity, physical_quantity, variance_quantity,
    posted_quantity, posted_cost, created_at
  )
`

export async function listInventoryAdjustments(
  kind: AdjustmentKind,
): Promise<InventoryAdjustment[]> {
  const { data, error } = await requireSupabase()
    .from('inventory_adjustments')
    .select(ADJUSTMENT_COLUMNS)
    .eq('kind', kind)
    .order('created_at', { ascending: false })

  if (error) throw new Error(describeStockDbError(error))
  return (data ?? []) as unknown as InventoryAdjustment[]
}

function adjustmentLines(input: NormalizedAdjustment) {
  return input.lines.map((line) => ({
    item_id: line.itemId,
    unit_id: line.unitId,
    direction: line.direction,
    quantity: line.quantity,
    unit_cost: line.unitCost,
  }))
}

export async function createInventoryAdjustment(
  input: NormalizedAdjustment,
): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_inventory_adjustment', {
    p_kind: input.kind,
    p_adjustment_date: input.adjustmentDate,
    p_location_id: input.locationId,
    p_reason: input.reason,
    p_notes: input.notes,
    p_lines: adjustmentLines(input),
  })

  if (error) throw new Error(describeStockDbError(error))
  if (!data) {
    throw new Error('The document was saved but no reference was returned. Refresh the list.')
  }
  return data as string
}

export async function updateInventoryAdjustment(
  id: string,
  input: NormalizedAdjustment,
): Promise<void> {
  const { error } = await requireSupabase().rpc('update_inventory_adjustment', {
    p_adjustment_id: id,
    p_adjustment_date: input.adjustmentDate,
    p_location_id: input.locationId,
    p_reason: input.reason,
    p_notes: input.notes,
    p_lines: adjustmentLines(input),
  })

  if (error) throw new Error(describeStockDbError(error))
}

export async function deleteInventoryAdjustment(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('delete_inventory_adjustment', {
    p_adjustment_id: id,
  })
  if (error) throw new Error(describeStockDbError(error))
}

export async function submitInventoryAdjustment(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('submit_inventory_adjustment', {
    p_adjustment_id: id,
  })
  if (error) throw new Error(describeStockDbError(error))
}

export async function decideInventoryAdjustment(
  id: string,
  decision: 'approved' | 'rejected',
  comment: string,
): Promise<void> {
  const { error } = await requireSupabase().rpc('decide_inventory_adjustment', {
    p_adjustment_id: id,
    p_decision: decision,
    p_comment: comment,
  })
  if (error) throw new Error(describeStockDbError(error))
}

export async function postInventoryAdjustment(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('post_inventory_adjustment', {
    p_adjustment_id: id,
  })
  if (error) throw new Error(describeStockDbError(error))
}

export async function listInventoryCounts(): Promise<InventoryCount[]> {
  const { data, error } = await requireSupabase()
    .from('inventory_counts')
    .select(COUNT_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw new Error(describeStockDbError(error))
  return (data ?? []) as unknown as InventoryCount[]
}

function countLines(input: NormalizedCount) {
  return input.lines.map((line) => ({
    item_id: line.itemId,
    physical_quantity: line.physicalQuantity,
  }))
}

export async function createInventoryCount(input: NormalizedCount): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_inventory_count', {
    p_count_date: input.countDate,
    p_location_id: input.locationId,
    p_counter_name: input.counterName,
    p_notes: input.notes,
    p_lines: countLines(input),
  })

  if (error) throw new Error(describeStockDbError(error))
  if (!data) {
    throw new Error('The count was saved but no reference was returned. Refresh the list.')
  }
  return data as string
}

export async function updateInventoryCount(id: string, input: NormalizedCount): Promise<void> {
  const { error } = await requireSupabase().rpc('update_inventory_count', {
    p_count_id: id,
    p_count_date: input.countDate,
    p_location_id: input.locationId,
    p_counter_name: input.counterName,
    p_notes: input.notes,
    p_lines: countLines(input),
  })

  if (error) throw new Error(describeStockDbError(error))
}

export async function deleteInventoryCount(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('delete_inventory_count', { p_count_id: id })
  if (error) throw new Error(describeStockDbError(error))
}

export async function submitInventoryCount(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('submit_inventory_count', { p_count_id: id })
  if (error) throw new Error(describeStockDbError(error))
}

export async function decideInventoryCount(
  id: string,
  decision: 'approved' | 'rejected',
  comment: string,
): Promise<void> {
  const { error } = await requireSupabase().rpc('decide_inventory_count', {
    p_count_id: id,
    p_decision: decision,
    p_comment: comment,
  })
  if (error) throw new Error(describeStockDbError(error))
}

export async function postInventoryCount(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('post_inventory_count', { p_count_id: id })
  if (error) throw new Error(describeStockDbError(error))
}

export async function listReorderStatus(): Promise<ReorderStatus[]> {
  const { data, error } = await requireSupabase()
    .from('stock_reorder_status')
    .select(
      'item_id, item_code, item_name, base_unit_code, reorder_level, on_hand, shortage, is_low',
    )
    .order('is_low', { ascending: false })
    .order('item_name', { ascending: true })

  if (error) throw new Error(describeStockDbError(error))
  return (data ?? []) as unknown as ReorderStatus[]
}
