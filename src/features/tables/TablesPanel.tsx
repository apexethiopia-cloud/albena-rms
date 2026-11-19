import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  LayoutGrid,
  Loader2,
  Plus,
  RotateCw,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import { listOutlets, type Outlet } from '@/features/outlets/api'
import {
  createTable,
  listTables,
  setTableStatus,
  updateTable,
  type RestaurantTable,
  type TableStatus,
} from './api'
import { validateTable, type TableDraft } from './validation'

const STATUS_LABELS: Record<TableStatus, string> = {
  available: 'Available',
  occupied: 'Occupied',
  reserved: 'Reserved',
  cleaning: 'Cleaning',
  closed: 'Closed',
}

const STATUS_STYLES: Record<TableStatus, string> = {
  available: 'bg-emerald-50 text-emerald-700',
  occupied: 'bg-amber-50 text-amber-800',
  reserved: 'bg-sky-50 text-sky-700',
  cleaning: 'bg-indigo-50 text-indigo-700',
  closed: 'bg-slate-100 text-slate-600',
}

const STATUS_ORDER: TableStatus[] = [
  'available',
  'occupied',
  'reserved',
  'cleaning',
  'closed',
]

function emptyForm(outletId = ''): TableDraft {
  return { outletId, code: '', name: '', capacity: '2' }
}

export function TablesPanel() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Mirrors can_manage_table_layout() and can_set_table_status().
  const canManage = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'restaurant_manager')
    : false
  const canSetStatus = user
    ? canManage ||
      hasRole(user.roles, 'waiter') ||
      hasRole(user.roles, 'cashier')
    : false

  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [tables, setTables] = useState<RestaurantTable[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [outletFilter, setOutletFilter] = useState('all')
  const [mode, setMode] = useState<'closed' | 'create' | 'edit'>('closed')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TableDraft>(() => emptyForm())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [statusDraft, setStatusDraft] = useState<Record<string, TableStatus>>({})

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([listOutlets(), listTables()])
      .then(([nextOutlets, nextTables]) => {
        if (cancelled) return
        setOutlets(nextOutlets)
        setTables(nextTables)
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
  const visibleTables = useMemo(() => {
    const scoped =
      outletFilter === 'all'
        ? tables
        : tables.filter((table) => table.outlet_id === outletFilter)
    return [...scoped].sort((left, right) => {
      const outletCompare = (outletById.get(left.outlet_id)?.code ?? '').localeCompare(
        outletById.get(right.outlet_id)?.code ?? '',
      )
      return outletCompare !== 0 ? outletCompare : left.code.localeCompare(right.code)
    })
  }, [tables, outletFilter, outletById])

  const openCreate = () => {
    setMode('create')
    setEditingId(null)
    setForm(
      emptyForm(
        outletFilter !== 'all' ? outletFilter : activeOutlets[0]?.id ?? '',
      ),
    )
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
  }

  const openEdit = (table: RestaurantTable) => {
    setMode('edit')
    setEditingId(table.id)
    setForm({
      outletId: table.outlet_id,
      code: table.code,
      name: table.name,
      capacity: String(table.capacity),
    })
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
  }

  const closeForm = () => {
    setMode('closed')
    setEditingId(null)
    setFieldErrors({})
    setFormError(null)
  }

  const setField = (key: keyof TableDraft) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const result = validateTable(
      form,
      activeOutlets.map((outlet) => outlet.id),
    )
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)
    setNotice(null)

    try {
      const label = result.value.code || 'Table'
      if (mode === 'edit' && editingId) {
        await updateTable(editingId, result.value)
        setNotice(`${label} was updated.`)
      } else {
        await createTable(result.value)
        setNotice(`${label} was added to the layout.`)
      }
      closeForm()
      reload()
    } catch (error) {
      setFormError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (table: RestaurantTable) => {
    setBusyId(table.id)
    setActionError(null)
    setNotice(null)

    try {
      await updateTable(table.id, {
        outletId: table.outlet_id,
        code: table.code,
        name: table.name,
        capacity: table.capacity,
        isActive: !table.is_active,
      })
      setNotice(
        table.is_active
          ? `${table.code} was deactivated. It stays on historical orders.`
          : `${table.code} is active again.`,
      )
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const changeStatus = async (table: RestaurantTable) => {
    const nextStatus = statusDraft[table.id] ?? table.status
    if (nextStatus === table.status) return

    setBusyId(table.id)
    setActionError(null)
    setNotice(null)

    try {
      await setTableStatus(table.id, nextStatus)
      setNotice(`${table.code} is now ${STATUS_LABELS[nextStatus].toLowerCase()}.`)
      setStatusDraft((current) => {
        const next = { ...current }
        delete next[table.id]
        return next
      })
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section aria-labelledby="tables-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="tables-heading"
              className="flex items-center gap-2 text-base font-semibold text-slate-900"
            >
              <LayoutGrid className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Tables
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Table layout and live status per outlet. Opening an order marks a table occupied;
              closing, cancelling or transferring frees it again. A table with an open order cannot
              be set available (TBL-01..04).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Outlet</span>
              <select
                aria-label="Outlet"
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
                onClick={openCreate}
                className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-obsidian hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New table
              </button>
            )}
          </div>
        </div>

        {!canManage && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Read-only layout: tables are managed by the System Administrator, General Manager and
            Restaurant Manager.
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
      </div>

      {mode !== 'closed' && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-surface p-5 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              {mode === 'edit' ? 'Edit table' : 'New table'}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close table form"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Outlet</span>
              <select
                aria-label="Table outlet"
                value={form.outletId}
                onChange={(event) => setField('outletId')(event.target.value)}
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
              <span className="mb-1 block font-medium">Table code</span>
              <input
                aria-label="Table code"
                value={form.code}
                onChange={(event) => setField('code')(event.target.value)}
                placeholder="Auto-generated"
                aria-describedby="table-code-hint"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <span id="table-code-hint" className="mt-1 block text-slate-500">
                Leave blank to generate a code automatically.
              </span>
              {fieldErrors.code && (
                <span className="mt-1 block text-red-600">{fieldErrors.code}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Table name</span>
              <input
                aria-label="Table name"
                value={form.name}
                onChange={(event) => setField('name')(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.name && (
                <span className="mt-1 block text-red-600">{fieldErrors.name}</span>
              )}
            </label>

            <label className="text-xs text-slate-600">
              <span className="mb-1 block font-medium">Seats</span>
              <input
                aria-label="Seats"
                value={form.capacity}
                onChange={(event) => setField('capacity')(event.target.value)}
                inputMode="numeric"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              {fieldErrors.capacity && (
                <span className="mt-1 block text-red-600">{fieldErrors.capacity}</span>
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-obsidian hover:bg-brand-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {mode === 'edit' ? 'Save changes' : 'Save table'}
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

      <div className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
        {loadError ? (
          <div className="flex items-start gap-2 text-sm text-red-700">
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
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading tables…
          </p>
        ) : visibleTables.length === 0 ? (
          <p className="text-sm text-slate-500">
            No tables yet. Add the first table to start seating guests.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleTables.map((table) => {
              const outlet = outletById.get(table.outlet_id)
              const selectedStatus = statusDraft[table.id] ?? table.status
              return (
                <li
                  key={table.id}
                  className={cn(
                    'rounded-lg border border-slate-200 p-4',
                    !table.is_active && 'bg-slate-50/60',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">
                        {table.code} · {table.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {outlet ? `${outlet.code} · ${outlet.name}` : 'Unknown outlet'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_STYLES[table.status],
                      )}
                    >
                      {STATUS_LABELS[table.status]}
                    </span>
                  </div>

                  <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    {table.capacity} {table.capacity === 1 ? 'seat' : 'seats'}
                    {!table.is_active && (
                      <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                        Inactive
                      </span>
                    )}
                  </p>

                  {canManage && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(table)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(table)}
                        disabled={busyId === table.id}
                        className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                      >
                        {table.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  )}

                  {canSetStatus && (
                    <div className="mt-3 flex items-end gap-2">
                      <label className="flex-1 text-xs text-slate-600">
                        <span className="mb-1 block font-medium">Status</span>
                        <select
                          aria-label={`Status for table ${table.code}`}
                          value={selectedStatus}
                          onChange={(event) =>
                            setStatusDraft((current) => ({
                              ...current,
                              [table.id]: event.target.value as TableStatus,
                            }))
                          }
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        >
                          {STATUS_ORDER.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => changeStatus(table)}
                        disabled={busyId === table.id || selectedStatus === table.status}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {busyId === table.id && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        )}
                        Set status
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
