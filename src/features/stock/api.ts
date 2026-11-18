import { requireSupabase } from '@/lib/supabase'
import {
  describeStockDbError,
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

const GRN_COLUMNS = `
  id, grn_number, supplier_id, invoice_number, received_date, location_id, notes,
  created_by, created_at, posted_by, posted_at,
  grn_lines (
    id, grn_id, item_id, unit_id, quantity, unit_cost, line_total,
    base_quantity, base_unit_cost, created_at
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

export async function createGrn(input: NormalizedGrn): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_grn', {
    p_grn_number: input.grnNumber,
    p_supplier_id: input.supplierId,
    p_invoice_number: input.invoiceNumber,
    p_received_date: input.receivedDate,
    p_location_id: input.locationId,
    p_notes: input.notes,
    p_lines: input.lines.map((line) => ({
      item_id: line.itemId,
      unit_id: line.unitId,
      quantity: line.quantity,
      unit_cost: line.unitCost,
    })),
  })

  if (error) throw new Error(describeStockDbError(error))
  if (!data) throw new Error('The GRN was saved but no reference was returned. Refresh the list.')
  return data as string
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

export async function createSiv(input: NormalizedSiv): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_siv', {
    p_siv_number: input.sivNumber,
    p_issue_date: input.issueDate,
    p_source_location_id: input.sourceLocationId,
    p_destination_location_id: input.destinationLocationId,
    p_notes: input.notes,
    p_lines: input.lines.map((line) => ({
      item_id: line.itemId,
      unit_id: line.unitId,
      quantity: line.quantity,
    })),
  })

  if (error) throw new Error(describeStockDbError(error))
  if (!data) throw new Error('The SIV was saved but no reference was returned. Refresh the list.')
  return data as string
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
