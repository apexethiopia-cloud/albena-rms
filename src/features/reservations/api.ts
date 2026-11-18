import { requireSupabase } from '@/lib/supabase'
import {
  describeReservationDbError,
  type NormalizedReservation,
} from './validation'

export type Numberish = number | string

export type ReservationStatus =
  | 'booked'
  | 'confirmed'
  | 'arrived'
  | 'cancelled'
  | 'completed'

export type Reservation = {
  id: string
  reservation_number: string
  outlet_id: string
  guest_name: string
  guest_phone: string
  reserved_date: string
  reserved_time: string
  party_size: number
  table_id: string | null
  special_requests: string | null
  status: ReservationStatus
  created_by: string | null
  created_at: string
  updated_at: string
  status_updated_by: string | null
  status_updated_at: string | null
  restaurant_tables: { code: string; name: string } | null
}

export type ReservationSlotLoad = {
  outlet_id: string
  reserved_date: string
  reserved_time: string
  active_reservations: number
  active_tables: number
}

const RESERVATION_COLUMNS = `
  id, reservation_number, outlet_id, guest_name, guest_phone, reserved_date,
  reserved_time, party_size, table_id, special_requests, status, created_by,
  created_at, updated_at, status_updated_by, status_updated_at,
  restaurant_tables (code, name)
`

export async function listReservations(): Promise<Reservation[]> {
  const { data, error } = await requireSupabase()
    .from('reservations')
    .select(RESERVATION_COLUMNS)
    .order('reserved_date', { ascending: true })
    .order('reserved_time', { ascending: true })

  if (error) throw new Error(describeReservationDbError(error))
  return (data ?? []) as unknown as Reservation[]
}

export async function listReservationSlotLoad(): Promise<ReservationSlotLoad[]> {
  const { data, error } = await requireSupabase()
    .from('reservation_slot_load')
    .select('outlet_id, reserved_date, reserved_time, active_reservations, active_tables')

  if (error) throw new Error(describeReservationDbError(error))
  return (data ?? []) as unknown as ReservationSlotLoad[]
}

export async function createReservation(input: NormalizedReservation): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_reservation', {
    p_outlet_id: input.outletId,
    p_guest_name: input.guestName,
    p_guest_phone: input.guestPhone,
    p_reserved_date: input.reservedDate,
    p_reserved_time: input.reservedTime,
    p_party_size: input.partySize,
    p_table_id: input.tableId,
    p_special_requests: input.specialRequests,
  })

  if (error) throw new Error(describeReservationDbError(error))
  if (!data) {
    throw new Error(
      'The reservation was saved but no reference was returned. Refresh the list.',
    )
  }
  return data as string
}

export async function assignReservationTable(
  id: string,
  tableId: string | null,
): Promise<void> {
  const { error } = await requireSupabase().rpc('assign_reservation_table', {
    p_reservation_id: id,
    p_table_id: tableId,
  })

  if (error) throw new Error(describeReservationDbError(error))
}

export async function setReservationStatus(
  id: string,
  status: ReservationStatus,
): Promise<void> {
  const { error } = await requireSupabase().rpc('set_reservation_status', {
    p_reservation_id: id,
    p_status: status,
  })

  if (error) throw new Error(describeReservationDbError(error))
}
