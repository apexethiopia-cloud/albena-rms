import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Loader2,
  Plus,
  RotateCw,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import { formatDate, toIsoDate } from '@/lib/format'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import { listOutlets, type Outlet } from '@/features/outlets/api'
import { listTables, type RestaurantTable } from '@/features/tables/api'
import {
  assignReservationTable,
  createReservation,
  listReservationSlotLoad,
  listReservations,
  setReservationStatus,
  type Reservation,
  type ReservationSlotLoad,
  type ReservationStatus,
} from './api'
import {
  normalizeTime,
  validateReservation,
  type ReservationDraft,
} from './validation'

const STATUS_LABELS: Record<ReservationStatus, string> = {
  booked: 'Booked',
  confirmed: 'Confirmed',
  arrived: 'Arrived',
  cancelled: 'Cancelled',
  completed: 'Completed',
}

const STATUS_STYLES: Record<ReservationStatus, string> = {
  booked: 'bg-sky-50 text-sky-700',
  confirmed: 'bg-indigo-50 text-indigo-700',
  arrived: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
  completed: 'bg-slate-100 text-slate-600',
}

type StatusAction = { status: ReservationStatus; label: string }

/** Mirrors set_reservation_status() transition rules. */
function nextActions(status: ReservationStatus): StatusAction[] {
  if (status === 'booked') {
    return [
      { status: 'confirmed', label: 'Confirm' },
      { status: 'arrived', label: 'Mark arrived' },
      { status: 'cancelled', label: 'Cancel' },
    ]
  }
  if (status === 'confirmed') {
    return [
      { status: 'arrived', label: 'Mark arrived' },
      { status: 'cancelled', label: 'Cancel' },
    ]
  }
  if (status === 'arrived') {
    return [
      { status: 'completed', label: 'Complete' },
      { status: 'cancelled', label: 'Cancel' },
    ]
  }
  return []
}

function emptyForm(outletId = ''): ReservationDraft {
  return {
    outletId,
    guestName: '',
    guestPhone: '',
    reservedDate: toIsoDate(new Date()),
    reservedTime: '19:00',
    partySize: '2',
    tableId: '',
    specialRequests: '',
  }
}

export function ReservationsPanel() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Mirrors can_manage_reservations(): System Administrator, General Manager,
  // Restaurant Manager and Waiter.
  const canManage = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'restaurant_manager') ||
      hasRole(user.roles, 'waiter')
    : false

  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [slotLoad, setSlotLoad] = useState<ReservationSlotLoad[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [outletFilter, setOutletFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ReservationDraft>(() => emptyForm())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [tableDraft, setTableDraft] = useState<Record<string, string>>({})

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([
      listOutlets(),
      listTables(),
      listReservations(),
      listReservationSlotLoad(),
    ])
      .then(([nextOutlets, nextTables, nextReservations, nextSlotLoad]) => {
        if (cancelled) return
        setOutlets(nextOutlets)
        setTables(nextTables)
        setReservations(nextReservations)
        setSlotLoad(nextSlotLoad)
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(toMessage(error))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const activeOutlets = useMemo(
    () => outlets.filter((outlet) => outlet.is_active),
    [outlets],
  )
  const outletById = useMemo(
    () => new Map(outlets.map((outlet) => [outlet.id, outlet])),
    [outlets],
  )
  const tableById = useMemo(
    () => new Map(tables.map((table) => [table.id, table])),
    [tables],
  )
  const formOutletTables = useMemo(
    () =>
      tables.filter(
        (table) => table.outlet_id === form.outletId && table.is_active,
      ),
    [tables, form.outletId],
  )

  const visibleReservations = useMemo(
    () =>
      outletFilter === 'all'
        ? reservations
        : reservations.filter(
            (reservation) => reservation.outlet_id === outletFilter,
          ),
    [reservations, outletFilter],
  )

  const overbookedSlots = useMemo(
    () =>
      slotLoad.filter(
        (slot) =>
          (outletFilter === 'all' || slot.outlet_id === outletFilter) &&
          slot.active_reservations > slot.active_tables,
      ),
    [slotLoad, outletFilter],
  )

  const openForm = () => {
    setShowForm(true)
    setForm(
      emptyForm(
        outletFilter !== 'all' ? outletFilter : activeOutlets[0]?.id ?? '',
      ),
    )
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
  }

  const closeForm = () => {
    setShowForm(false)
    setFieldErrors({})
    setFormError(null)
  }

  const setField = (key: keyof ReservationDraft) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const result = validateReservation(
      form,
      activeOutlets.map((outlet) => outlet.id),
      tables,
    )
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)
    setNotice(null)

    try {
      await createReservation(result.value)
      setNotice(
        `Reservation for ${result.value.guestName} on ${formatDate(
          result.value.reservedDate,
        )} at ${result.value.reservedTime} was recorded.`,
      )
      closeForm()
      reload()
    } catch (error) {
      setFormError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const runStatusChange = async (
    reservation: Reservation,
    status: ReservationStatus,
  ) => {
    setBusyId(reservation.id)
    setActionError(null)
    setNotice(null)

    try {
      await setReservationStatus(reservation.id, status)
      setNotice(
        `${reservation.reservation_number} is now ${STATUS_LABELS[status].toLowerCase()}.`,
      )
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const runAssignTable = async (reservation: Reservation) => {
    const raw = tableDraft[reservation.id]
    const nextTableId = raw === undefined ? reservation.table_id ?? '' : raw

    setBusyId(reservation.id)
    setActionError(null)
    setNotice(null)

    try {
      await assignReservationTable(reservation.id, nextTableId || null)
      setNotice(
        nextTableId
          ? `${reservation.reservation_number} was assigned to ${
              tableById.get(nextTableId)?.code ?? 'the table'
            }.`
          : `${reservation.reservation_number} no longer has a table.`,
      )
      setTableDraft((current) => {
        const next = { ...current }
        delete next[reservation.id]
        return next
      })
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const reservationOutletTables = (reservation: Reservation) =>
    tables.filter(
      (table) => table.outlet_id === reservation.outlet_id && table.is_active,
    )

  return (
    <section aria-labelledby="reservations-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="reservations-heading"
              className="flex items-center gap-2 text-base font-semibold text-slate-900"
            >
              <CalendarCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Reservations
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Guest name and phone are kept on the reservation only; there is no guest profile or
              visit history. Table assignment is optional, one active reservation per table and
              exact slot is enforced, and the panel warns when a slot has more reservations than
              active tables (RES-01..04, OD-09, OD-10).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Outlet</span>
              <select
                aria-label="Reservation outlet filter"
                value={outletFilter}
                onChange={(event) => setOutletFilter(event.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="all">All outlets</option>
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.code} · {outlet.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="mt-5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
            >
              <RotateCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
              Refresh
            </button>
            {canManage && (
              <button
                type="button"
                onClick={openForm}
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New reservation
              </button>
            )}
          </div>
        </div>

        {!canManage && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Read-only: reservations are managed by the System Administrator, General Manager,
            Restaurant Manager and Waiter.
          </p>
        )}

        {notice && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {notice}
          </p>
        )}
        {actionError && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </p>
        )}

        {overbookedSlots.length > 0 && (
          <div role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Some slots have more reservations than tables
            </p>
            <ul className="mt-1 space-y-0.5 text-xs">
              {overbookedSlots.map((slot) => (
                <li key={`${slot.outlet_id}-${slot.reserved_date}-${slot.reserved_time}`}>
                  {formatDate(slot.reserved_date)} at {normalizeTime(slot.reserved_time)} ·{' '}
                  {outletById.get(slot.outlet_id)?.code ?? 'Outlet'} ·{' '}
                  {slot.active_reservations} reservations for {slot.active_tables} tables
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-semibold text-slate-900">New reservation</h3>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close reservation form"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Outlet</span>
              <select
                aria-label="Reservation outlet"
                value={form.outletId}
                onChange={(event) => {
                  setField('outletId')(event.target.value)
                  setField('tableId')('')
                }}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">Choose an outlet</option>
                {activeOutlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.code} · {outlet.name}
                  </option>
                ))}
              </select>
              {fieldErrors.outletId && (
                <span className="mt-1 block text-red-600">{fieldErrors.outletId}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Guest name</span>
              <input
                aria-label="Guest name"
                value={form.guestName}
                onChange={(event) => setField('guestName')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.guestName && (
                <span className="mt-1 block text-red-600">{fieldErrors.guestName}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Guest phone</span>
              <input
                aria-label="Guest phone"
                value={form.guestPhone}
                onChange={(event) => setField('guestPhone')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.guestPhone && (
                <span className="mt-1 block text-red-600">{fieldErrors.guestPhone}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Party size</span>
              <input
                aria-label="Party size"
                value={form.partySize}
                onChange={(event) => setField('partySize')(event.target.value)}
                inputMode="numeric"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.partySize && (
                <span className="mt-1 block text-red-600">{fieldErrors.partySize}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Reservation date</span>
              <input
                type="date"
                aria-label="Reservation date"
                value={form.reservedDate}
                onChange={(event) => setField('reservedDate')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.reservedDate && (
                <span className="mt-1 block text-red-600">{fieldErrors.reservedDate}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Reservation time</span>
              <input
                type="time"
                aria-label="Reservation time"
                value={form.reservedTime}
                onChange={(event) => setField('reservedTime')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.reservedTime && (
                <span className="mt-1 block text-red-600">{fieldErrors.reservedTime}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Table (optional)</span>
              <select
                aria-label="Reservation table (optional)"
                value={form.tableId}
                onChange={(event) => setField('tableId')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">No table yet</option>
                {formOutletTables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.code} · {table.name} ({table.capacity} seats)
                  </option>
                ))}
              </select>
              {fieldErrors.tableId && (
                <span className="mt-1 block text-red-600">{fieldErrors.tableId}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Special requests</span>
              <input
                aria-label="Special requests"
                value={form.specialRequests}
                onChange={(event) => setField('specialRequests')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.specialRequests && (
                <span className="mt-1 block text-red-600">{fieldErrors.specialRequests}</span>
              )}
            </label>
          </div>

          {formError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save reservation
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {loadError ? (
          <div className="flex items-start gap-2 p-5 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4" aria-hidden="true" />
            <div>
              <p>{loadError}</p>
              <button
                type="button"
                onClick={reload}
                className="mt-2 rounded-md border border-red-200 px-2 py-1 text-xs font-medium hover:bg-red-50"
              >
                Try again
              </button>
            </div>
          </div>
        ) : loading ? (
          <p className="flex items-center gap-2 p-5 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading reservations…
          </p>
        ) : visibleReservations.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            No reservations yet. Record the first booking to start the diary.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Reservation</th>
                  <th scope="col" className="px-5 py-3 font-medium">Guest</th>
                  <th scope="col" className="px-5 py-3 font-medium">When</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Party</th>
                  <th scope="col" className="px-5 py-3 font-medium">Table</th>
                  <th scope="col" className="px-5 py-3 font-medium">Status</th>
                  {canManage && (
                    <th scope="col" className="px-5 py-3 text-right font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleReservations.map((reservation) => {
                  const outlet = outletById.get(reservation.outlet_id)
                  const assignable = reservationOutletTables(reservation)
                  const selectedTable =
                    tableDraft[reservation.id] ?? reservation.table_id ?? ''
                  const closed =
                    reservation.status === 'cancelled' ||
                    reservation.status === 'completed'

                  return (
                    <tr key={reservation.id}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">
                          {reservation.reservation_number}
                        </p>
                        <p className="text-xs text-slate-500">
                          {outlet ? `${outlet.code} · ${outlet.name}` : 'Unknown outlet'}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-slate-900">{reservation.guest_name}</p>
                        <p className="text-xs text-slate-500">{reservation.guest_phone}</p>
                        {reservation.special_requests && (
                          <p className="mt-1 text-xs text-slate-500">
                            {reservation.special_requests}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-700">
                        <p>{formatDate(reservation.reserved_date)}</p>
                        <p className="text-xs text-slate-500">
                          {normalizeTime(reservation.reserved_time)}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                        {reservation.party_size}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {canManage && !closed ? (
                          <div className="flex items-center gap-1">
                            <select
                              aria-label={`Table for reservation ${reservation.reservation_number}`}
                              value={selectedTable}
                              onChange={(event) =>
                                setTableDraft((current) => ({
                                  ...current,
                                  [reservation.id]: event.target.value,
                                }))
                              }
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                            >
                              <option value="">No table</option>
                              {assignable.map((table) => (
                                <option key={table.id} value={table.id}>
                                  {table.code}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => runAssignTable(reservation)}
                              disabled={
                                busyId === reservation.id ||
                                selectedTable === (reservation.table_id ?? '')
                              }
                              className="rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                            >
                              Assign table
                            </button>
                          </div>
                        ) : (
                          (reservation.restaurant_tables?.code ??
                            tableById.get(reservation.table_id ?? '')?.code ??
                            'No table')
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            STATUS_STYLES[reservation.status],
                          )}
                        >
                          {STATUS_LABELS[reservation.status]}
                        </span>
                      </td>
                      {canManage && (
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          {nextActions(reservation.status).map((action) => (
                            <button
                              key={action.status}
                              type="button"
                              onClick={() => runStatusChange(reservation, action.status)}
                              disabled={busyId === reservation.id}
                              className={cn(
                                'ml-1 rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50',
                                action.status === 'cancelled'
                                  ? 'text-red-700 hover:bg-red-50'
                                  : 'text-brand-700 hover:bg-brand-50',
                              )}
                            >
                              {action.label}
                            </button>
                          ))}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
