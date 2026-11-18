import { requireSupabase } from '@/lib/supabase'
import {
  describeProductionDbError,
  type NormalizedProduction,
} from './validation'

export type Numberish = number | string

export type ProductionInput = {
  id: string
  production_id: string
  item_id: string
  unit_id: string
  quantity: Numberish
  base_quantity: Numberish
  posted_cost: Numberish | null
  created_at: string
}

export type ProductionOrder = {
  id: string
  order_number: string
  production_date: string
  location_id: string
  output_item_id: string
  output_unit_id: string
  output_quantity: Numberish
  output_base_quantity: Numberish
  expected_output_quantity: Numberish | null
  yield_percentage: Numberish | null
  responsible_name: string
  notes: string | null
  status: 'draft' | 'posted'
  created_by: string | null
  created_at: string
  posted_by: string | null
  posted_at: string | null
  production_inputs: ProductionInput[]
}

const PRODUCTION_COLUMNS = `
  id, order_number, production_date, location_id, output_item_id, output_unit_id,
  output_quantity, output_base_quantity, expected_output_quantity, yield_percentage,
  responsible_name, notes, status, created_by, created_at, posted_by, posted_at,
  production_inputs (
    id, production_id, item_id, unit_id, quantity, base_quantity, posted_cost, created_at
  )
`

export async function listProductionOrders(): Promise<ProductionOrder[]> {
  const { data, error } = await requireSupabase()
    .from('production_orders')
    .select(PRODUCTION_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw new Error(describeProductionDbError(error))
  return (data ?? []) as unknown as ProductionOrder[]
}

export async function createProductionOrder(input: NormalizedProduction): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_production_order', {
    p_order_number: input.orderNumber,
    p_production_date: input.productionDate,
    p_location_id: input.locationId,
    p_output_item_id: input.outputItemId,
    p_output_unit_id: input.outputUnitId,
    p_output_quantity: input.outputQuantity,
    p_expected_output_quantity: input.expectedOutputQuantity,
    p_responsible_name: input.responsibleName,
    p_notes: input.notes,
    p_inputs: input.inputs.map((line) => ({
      item_id: line.itemId,
      unit_id: line.unitId,
      quantity: line.quantity,
    })),
  })

  if (error) throw new Error(describeProductionDbError(error))
  if (!data) {
    throw new Error('The production order was saved but no reference was returned. Refresh the list.')
  }
  return data as string
}

export async function postProductionOrder(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('post_production_order', {
    p_production_id: id,
  })

  if (error) throw new Error(describeProductionDbError(error))
}
