import { mapDbError, type DbErrorLike } from '@/lib/errors'
import { requireSupabase } from '@/lib/supabase'
import {
  asNumber,
  businessToday,
  DEFAULT_DELAY_MINUTES,
  minutesSince,
  percentOf,
  sumBy,
  type Aggregate,
  type DateRange,
  type Numberish,
} from './validation'

export type { DateRange, Numberish }

export type SalesDailyRow = {
  business_date: string
  outlet_id: string
  outlet_code: string
  outlet_name: string
  receipt_count: number
  line_count: number
  subtotal: Numberish
  vat_amount: Numberish
  total: Numberish
  average_receipt: Numberish
}

export type SalesLineRow = {
  business_date: string
  outlet_id: string
  outlet_code: string
  outlet_name: string
  order_id: string
  order_number: string
  receipt_id: string
  receipt_number: string
  order_line_id: string
  waiter_name: string
  category_id: string | null
  category_name: string
  menu_item_id: string | null
  item_code: string
  item_name: string
  quantity: number
  unit_price: Numberish
  line_total: Numberish
}

export type InventoryReportRow = {
  item_id: string
  item_code: string
  item_name: string
  category_name: string | null
  base_unit_code: string
  reorder_level: Numberish
  on_hand: Numberish
  inventory_value: Numberish
  average_unit_cost: Numberish | null
  last_movement_at: string | null
  days_since_last_movement: number | null
  is_below_reorder: boolean
}

export type PurchaseRequestReportRow = {
  pr_id: string
  pr_number: string
  request_date: string
  requester_name: string
  status: string
  submitted_at: string | null
  decided_by_name: string | null
  decided_at: string | null
  decision_comment: string | null
  line_count: number
  total_quantity: Numberish
}

export type PurchaseOrderReportRow = {
  po_id: string
  po_number: string
  order_date: string
  expected_date: string | null
  status: string
  supplier_code: string
  supplier_name: string
  pr_number: string | null
  line_count: number
  ordered_value: Numberish
  received_value: Numberish
}

export type GrnReportRow = {
  grn_id: string
  grn_number: string
  invoice_number: string
  received_date: string
  supplier_code: string
  supplier_name: string
  location_code: string
  location_name: string
  po_number: string | null
  posted_at: string | null
  line_count: number
  total_value: Numberish
}

export type WasteReportRow = {
  adjustment_id: string
  adjustment_number: string
  adjustment_date: string
  location_id: string
  location_code: string
  location_name: string
  reason: string
  notes: string | null
  line_id: string
  item_id: string
  item_code: string
  item_name: string
  base_unit_code: string
  entered_unit_code: string
  quantity: Numberish
  base_quantity: Numberish | null
  unit_cost: Numberish | null
  waste_cost: Numberish
}

export type TheoreticalConsumptionRow = {
  business_date: string
  outlet_id: string
  outlet_code: string
  outlet_name: string
  menu_item_id: string
  menu_item_code: string
  menu_item_name: string
  portions_sold: number
  ingredient_item_id: string
  ingredient_code: string
  ingredient_name: string
  base_unit_code: string
  theoretical_quantity: Numberish
  average_unit_cost: Numberish
  theoretical_cost: Numberish
}

export type ConsumptionVarianceRow = {
  business_date: string
  item_id: string
  item_code: string
  item_name: string
  base_unit_code: string
  theoretical_quantity: Numberish
  theoretical_cost: Numberish
  issued_quantity: Numberish
  issued_cost: Numberish
  waste_quantity: Numberish
  variance_quantity: Numberish
}

export type KitchenPerformanceRow = {
  order_id: string
  order_number: string
  business_date: string
  outlet_id: string
  outlet_code: string
  outlet_name: string
  status: string
  waiter_name: string
  opened_at: string
  sent_at: string
  preparing_at: string | null
  ready_at: string | null
  served_at: string | null
  closed_at: string | null
  cancelled_at: string | null
  minutes_to_ready: Numberish | null
  minutes_to_serve: Numberish | null
  minutes_open: Numberish | null
}

export type ReservationDailyRow = {
  reserved_date: string
  outlet_id: string
  outlet_code: string
  outlet_name: string
  total_reservations: number
  booked: number
  confirmed: number
  arrived: number
  completed: number
  cancelled: number
  unassigned: number
  covers: number
  expected_covers: number
}

const PAGE_SIZE = 1000
const MAX_ROWS = 50_000

type Page<T> = { data: T[] | null; error: DbErrorLike | null }

async function fetchPaged<T>(
  run: (from: number, to: number) => PromiseLike<Page<T>>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await run(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(mapDbError(error))
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
  throw new Error('This report returned too many rows. Narrow the date range and try again.')
}

// ---------------------------------------------------------------------------
// Sales (RPT-01)
// ---------------------------------------------------------------------------
const SALES_DAILY_COLUMNS = `
  business_date, outlet_id, outlet_code, outlet_name, receipt_count, line_count,
  subtotal, vat_amount, total, average_receipt
`

export async function listSalesDaily(
  range: DateRange,
  outletId?: string | null,
): Promise<SalesDailyRow[]> {
  return fetchPaged<SalesDailyRow>((from, to) => {
    let query = requireSupabase()
      .from('sales_daily')
      .select(SALES_DAILY_COLUMNS)
      .gte('business_date', range.from)
      .lte('business_date', range.to)
      .order('business_date', { ascending: true })
      .order('outlet_code', { ascending: true })
      .range(from, to)
    if (outletId) query = query.eq('outlet_id', outletId)
    return query
  })
}

const SALES_LINE_COLUMNS = `
  business_date, outlet_id, outlet_code, outlet_name, order_id, order_number,
  receipt_id, receipt_number, order_line_id, waiter_name, category_id,
  category_name, menu_item_id, item_code, item_name, quantity, unit_price,
  line_total
`

export async function listSalesLines(
  range: DateRange,
  outletId?: string | null,
): Promise<SalesLineRow[]> {
  return fetchPaged<SalesLineRow>((from, to) => {
    let query = requireSupabase()
      .from('sales_lines')
      .select(SALES_LINE_COLUMNS)
      .gte('business_date', range.from)
      .lte('business_date', range.to)
      .order('business_date', { ascending: true })
      .order('order_line_id', { ascending: true })
      .range(from, to)
    if (outletId) query = query.eq('outlet_id', outletId)
    return query
  })
}

// ---------------------------------------------------------------------------
// Inventory (RPT-02)
// ---------------------------------------------------------------------------
const INVENTORY_COLUMNS = `
  item_id, item_code, item_name, category_name, base_unit_code, reorder_level,
  on_hand, inventory_value, average_unit_cost, last_movement_at,
  days_since_last_movement, is_below_reorder
`

/**
 * The inventory ledger has no outlet dimension yet: stock locations are not
 * mapped to outlets (open item). The report is therefore company-wide.
 */
export async function listInventoryReport(): Promise<InventoryReportRow[]> {
  return fetchPaged<InventoryReportRow>((from, to) =>
    requireSupabase()
      .from('inventory_report')
      .select(INVENTORY_COLUMNS)
      .order('item_code', { ascending: true })
      .range(from, to),
  )
}

// ---------------------------------------------------------------------------
// Purchasing (RPT-03)
// ---------------------------------------------------------------------------
const PR_COLUMNS = `
  pr_id, pr_number, request_date, requester_name, status, submitted_at,
  decided_by_name, decided_at, decision_comment, line_count, total_quantity
`

export async function listPurchaseRequestReport(
  range: DateRange,
): Promise<PurchaseRequestReportRow[]> {
  return fetchPaged<PurchaseRequestReportRow>((from, to) =>
    requireSupabase()
      .from('purchase_request_report')
      .select(PR_COLUMNS)
      .gte('request_date', range.from)
      .lte('request_date', range.to)
      .order('request_date', { ascending: true })
      .order('pr_number', { ascending: true })
      .range(from, to),
  )
}

const PO_COLUMNS = `
  po_id, po_number, order_date, expected_date, status, supplier_code,
  supplier_name, pr_number, line_count, ordered_value, received_value
`

export async function listPurchaseOrderReport(
  range: DateRange,
): Promise<PurchaseOrderReportRow[]> {
  return fetchPaged<PurchaseOrderReportRow>((from, to) =>
    requireSupabase()
      .from('purchase_order_report')
      .select(PO_COLUMNS)
      .gte('order_date', range.from)
      .lte('order_date', range.to)
      .order('order_date', { ascending: true })
      .order('po_number', { ascending: true })
      .range(from, to),
  )
}

const GRN_COLUMNS = `
  grn_id, grn_number, invoice_number, received_date, supplier_code,
  supplier_name, location_code, location_name, po_number, posted_at,
  line_count, total_value
`

export async function listGrnReport(range: DateRange): Promise<GrnReportRow[]> {
  return fetchPaged<GrnReportRow>((from, to) =>
    requireSupabase()
      .from('grn_report')
      .select(GRN_COLUMNS)
      .gte('received_date', range.from)
      .lte('received_date', range.to)
      .order('received_date', { ascending: true })
      .order('grn_number', { ascending: true })
      .range(from, to),
  )
}

// ---------------------------------------------------------------------------
// Cost and waste (RPT-04, RPT-05)
// ---------------------------------------------------------------------------
const WASTE_COLUMNS = `
  adjustment_id, adjustment_number, adjustment_date, location_id, location_code,
  location_name, reason, notes, line_id, item_id, item_code, item_name,
  base_unit_code, entered_unit_code, quantity, base_quantity, unit_cost,
  waste_cost
`

export async function listWasteReport(range: DateRange): Promise<WasteReportRow[]> {
  return fetchPaged<WasteReportRow>((from, to) =>
    requireSupabase()
      .from('waste_report')
      .select(WASTE_COLUMNS)
      .gte('adjustment_date', range.from)
      .lte('adjustment_date', range.to)
      .order('adjustment_date', { ascending: true })
      .order('adjustment_number', { ascending: true })
      .order('line_id', { ascending: true })
      .range(from, to),
  )
}

const THEORETICAL_COLUMNS = `
  business_date, outlet_id, outlet_code, outlet_name, menu_item_id,
  menu_item_code, menu_item_name, portions_sold, ingredient_item_id,
  ingredient_code, ingredient_name, base_unit_code, theoretical_quantity,
  average_unit_cost, theoretical_cost
`

export async function listTheoreticalConsumption(
  range: DateRange,
  outletId?: string | null,
): Promise<TheoreticalConsumptionRow[]> {
  return fetchPaged<TheoreticalConsumptionRow>((from, to) => {
    let query = requireSupabase()
      .from('theoretical_consumption')
      .select(THEORETICAL_COLUMNS)
      .gte('business_date', range.from)
      .lte('business_date', range.to)
      .order('business_date', { ascending: true })
      .order('menu_item_id', { ascending: true })
      .order('ingredient_item_id', { ascending: true })
      .range(from, to)
    if (outletId) query = query.eq('outlet_id', outletId)
    return query
  })
}

const VARIANCE_COLUMNS = `
  business_date, item_id, item_code, item_name, base_unit_code,
  theoretical_quantity, theoretical_cost, issued_quantity, issued_cost,
  waste_quantity, variance_quantity
`

export async function listConsumptionVariance(
  range: DateRange,
): Promise<ConsumptionVarianceRow[]> {
  return fetchPaged<ConsumptionVarianceRow>((from, to) =>
    requireSupabase()
      .from('consumption_variance')
      .select(VARIANCE_COLUMNS)
      .gte('business_date', range.from)
      .lte('business_date', range.to)
      .order('business_date', { ascending: true })
      .order('item_id', { ascending: true })
      .range(from, to),
  )
}

// ---------------------------------------------------------------------------
// Kitchen (RPT-06, KDS-04)
// ---------------------------------------------------------------------------
const KITCHEN_COLUMNS = `
  order_id, order_number, business_date, outlet_id, outlet_code, outlet_name,
  status, waiter_name, opened_at, sent_at, preparing_at, ready_at, served_at,
  closed_at, cancelled_at, minutes_to_ready, minutes_to_serve, minutes_open
`

export async function listKitchenPerformance(
  range: DateRange,
  outletId?: string | null,
): Promise<KitchenPerformanceRow[]> {
  return fetchPaged<KitchenPerformanceRow>((from, to) => {
    let query = requireSupabase()
      .from('kitchen_performance')
      .select(KITCHEN_COLUMNS)
      .gte('business_date', range.from)
      .lte('business_date', range.to)
      .order('business_date', { ascending: true })
      .order('order_id', { ascending: true })
      .range(from, to)
    if (outletId) query = query.eq('outlet_id', outletId)
    return query
  })
}

// ---------------------------------------------------------------------------
// Reservations (RPT-07)
// ---------------------------------------------------------------------------
const RESERVATION_DAILY_COLUMNS = `
  reserved_date, outlet_id, outlet_code, outlet_name, total_reservations,
  booked, confirmed, arrived, completed, cancelled, unassigned, covers,
  expected_covers
`

export async function listReservationDaily(
  range: DateRange,
  outletId?: string | null,
): Promise<ReservationDailyRow[]> {
  return fetchPaged<ReservationDailyRow>((from, to) => {
    let query = requireSupabase()
      .from('reservation_daily')
      .select(RESERVATION_DAILY_COLUMNS)
      .gte('reserved_date', range.from)
      .lte('reserved_date', range.to)
      .order('reserved_date', { ascending: true })
      .order('outlet_code', { ascending: true })
      .range(from, to)
    if (outletId) query = query.eq('outlet_id', outletId)
    return query
  })
}

// ---------------------------------------------------------------------------
// Full report bundle (RPT-09 applies the same date range and outlet everywhere)
// ---------------------------------------------------------------------------
export type ReportBundle = {
  salesDaily: SalesDailyRow[]
  salesLines: SalesLineRow[]
  inventory: InventoryReportRow[]
  purchaseRequests: PurchaseRequestReportRow[]
  purchaseOrders: PurchaseOrderReportRow[]
  grns: GrnReportRow[]
  waste: WasteReportRow[]
  theoretical: TheoreticalConsumptionRow[]
  variance: ConsumptionVarianceRow[]
  kitchen: KitchenPerformanceRow[]
  reservations: ReservationDailyRow[]
}

export async function loadReports(
  range: DateRange,
  outletId?: string | null,
): Promise<ReportBundle> {
  const [
    salesDaily,
    salesLines,
    inventory,
    purchaseRequests,
    purchaseOrders,
    grns,
    waste,
    theoretical,
    variance,
    kitchen,
    reservations,
  ] = await Promise.all([
    listSalesDaily(range, outletId),
    listSalesLines(range, outletId),
    listInventoryReport(),
    listPurchaseRequestReport(range),
    listPurchaseOrderReport(range),
    listGrnReport(range),
    listWasteReport(range),
    listTheoreticalConsumption(range, outletId),
    listConsumptionVariance(range),
    listKitchenPerformance(range, outletId),
    listReservationDaily(range, outletId),
  ])

  return {
    salesDaily,
    salesLines,
    inventory,
    purchaseRequests,
    purchaseOrders,
    grns,
    waste,
    theoretical,
    variance,
    kitchen,
    reservations,
  }
}

// ---------------------------------------------------------------------------
// Operational dashboard (RPT-08)
// ---------------------------------------------------------------------------
export type DashboardTableRow = {
  id: string
  outlet_id: string
  status: string
}

export type LowStockRow = {
  item_id: string
  on_hand: Numberish
  reorder_level: Numberish
  is_low: boolean
}

async function listDashboardTables(outletId?: string | null): Promise<DashboardTableRow[]> {
  let query = requireSupabase()
    .from('restaurant_tables')
    .select('id, outlet_id, status')
    .eq('is_active', true)
  if (outletId) query = query.eq('outlet_id', outletId)
  const { data, error } = await query
  if (error) throw new Error(mapDbError(error))
  return (data ?? []) as unknown as DashboardTableRow[]
}

async function listLowStock(): Promise<LowStockRow[]> {
  const { data, error } = await requireSupabase()
    .from('stock_reorder_status')
    .select('item_id, on_hand, reorder_level, is_low')
  if (error) throw new Error(mapDbError(error))
  return (data ?? []) as unknown as LowStockRow[]
}

export type DashboardSnapshot = {
  businessDate: string
  sales: { receipts: number; subtotal: number; vat: number; total: number }
  kitchenQueue: number
  delayedOrders: number
  delayMinutes: number
  tables: { total: number; occupied: number; available: number }
  lowStockCount: number
  inventoryValue: number
  topItems: Aggregate[]
  foodCostPct: number | null
  wasteCost: number
  wastePct: number | null
  reservations: { total: number; expectedCovers: number; arrived: number }
}

/**
 * Loads today's operational numbers from the Phase 7 views. The delayed-ticket
 * count uses the default UI threshold (20 minutes), not a stored rule.
 */
export async function loadDashboard(
  outletId?: string | null,
  now: Date = new Date(),
): Promise<DashboardSnapshot> {
  const today = businessToday(now)
  const range: DateRange = { from: today, to: today }

  const [salesRows, kitchenRows, tableRows, lowStockRows, inventoryRows, lineRows, theoreticalRows, wasteRows, reservationRows] =
    await Promise.all([
      listSalesDaily(range, outletId),
      listKitchenPerformance(range, outletId),
      listDashboardTables(outletId),
      listLowStock(),
      listInventoryReport(),
      listSalesLines(range, outletId),
      listTheoreticalConsumption(range, outletId),
      listWasteReport(range),
      listReservationDaily(range, outletId),
    ])

  const subtotal = sumBy(salesRows, (row) => row.subtotal)
  const vat = sumBy(salesRows, (row) => row.vat_amount)
  const total = sumBy(salesRows, (row) => row.total)
  const receipts = salesRows.reduce((count, row) => count + row.receipt_count, 0)

  const activeKitchen = kitchenRows.filter((row) =>
    ['sent_to_kitchen', 'preparing', 'ready'].includes(row.status),
  )
  const delayedOrders = activeKitchen.filter((row) => {
    if (row.status !== 'sent_to_kitchen' && row.status !== 'preparing') return false
    const minutes = minutesSince(row.sent_at, now)
    return minutes !== null && minutes > DEFAULT_DELAY_MINUTES
  }).length

  const itemTotals = new Map<string, Aggregate>()
  for (const line of lineRows) {
    const current = itemTotals.get(line.item_code) ?? {
      key: line.item_code,
      label: line.item_name,
      quantity: 0,
      value: 0,
    }
    current.quantity += line.quantity
    current.value += asNumber(line.line_total)
    itemTotals.set(line.item_code, current)
  }
  const topItems = [...itemTotals.values()]
    .sort((a, b) => b.quantity - a.quantity || b.value - a.value)
    .slice(0, 5)

  const theoreticalCost = sumBy(theoreticalRows, (row) => row.theoretical_cost)
  const wasteCost = sumBy(wasteRows, (row) => row.waste_cost)

  return {
    businessDate: today,
    sales: { receipts, subtotal, vat, total },
    kitchenQueue: activeKitchen.length,
    delayedOrders,
    delayMinutes: DEFAULT_DELAY_MINUTES,
    tables: {
      total: tableRows.length,
      occupied: tableRows.filter((row) => row.status === 'occupied').length,
      available: tableRows.filter((row) => row.status === 'available').length,
    },
    lowStockCount: lowStockRows.filter((row) => row.is_low).length,
    inventoryValue: sumBy(inventoryRows, (row) => row.inventory_value),
    topItems,
    foodCostPct: percentOf(theoreticalCost, subtotal),
    wasteCost,
    wastePct: percentOf(wasteCost, subtotal),
    reservations: {
      total: reservationRows.reduce((count, row) => count + row.total_reservations, 0),
      expectedCovers: reservationRows.reduce((count, row) => count + row.expected_covers, 0),
      arrived: reservationRows.reduce((count, row) => count + row.arrived, 0),
    },
  }
}
