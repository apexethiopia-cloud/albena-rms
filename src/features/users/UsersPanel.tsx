import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  RotateCw,
  ShieldCheck,
  UserCog,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import { listOutlets, type Outlet } from '@/features/outlets/api'
import {
  assignUserRole,
  grantOutletScope,
  listOutletScopes,
  listRoles,
  listUsers,
  revokeOutletScope,
  revokeUserRole,
  setUserStatus,
  type OutletScope,
  type Role,
  type UserRow,
} from './api'
import { validateRoleRevocation, validateRoleSelection } from './validation'

export function UsersPanel() {
  const { state, refreshUser } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Status and role changes go through admin RPCs that check `is_admin()`. The database is the boundary (ADR-003).
  const canManage = user ? hasRole(user.roles, 'system_admin') : false

  const [users, setUsers] = useState<UserRow[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({})
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [scopeUserId, setScopeUserId] = useState<string | null>(null)
  const [scopeRows, setScopeRows] = useState<OutletScope[] | null>(null)
  const [scopePendingOutletId, setScopePendingOutletId] = useState<string | null>(null)
  const [scopeError, setScopeError] = useState<string | null>(null)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([listUsers(), listRoles(), listOutlets()])
      .then(([userRows, roleRows, outletRows]) => {
        if (cancelled) return
        setUsers(userRows)
        setRoles(roleRows)
        setOutlets(outletRows)
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

  const roleCodes = useMemo(() => roles.map((role) => role.code), [roles])
  const activeOutlets = useMemo(() => outlets.filter((outlet) => outlet.is_active), [outlets])

  const selectedUser = users.find((row) => row.id === scopeUserId) ?? null
  const grantedOutletIds = useMemo(
    () => new Set((scopeRows ?? []).map((scope) => scope.outlet_id)),
    [scopeRows],
  )
  const scopeOutlets = useMemo(() => {
    const visible = activeOutlets.slice()
    for (const scope of scopeRows ?? []) {
      if (!visible.some((outlet) => outlet.id === scope.outlet_id)) {
        const outlet = outlets.find((candidate) => candidate.id === scope.outlet_id)
        if (outlet) visible.push(outlet)
      }
    }
    return visible
  }, [activeOutlets, outlets, scopeRows])

  const toggleStatus = async (row: UserRow) => {
    const next = row.status === 'active' ? 'disabled' : 'active'
    setPendingId(row.id)
    setActionError(null)
    setNotice(null)

    try {
      await setUserStatus(row.id, next)
      setNotice(
        `${row.full_name} ${next === 'active' ? 'reactivated' : 'disabled'}.`,
      )
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setPendingId(null)
    }
  }

  const assignRole = async (row: UserRow) => {
    const roleCode = roleDrafts[row.id] ?? ''
    const result = validateRoleSelection(
      roleCode,
      roleCodes,
      row.roles.map((assigned) => assigned.code),
    )

    if (!result.valid) {
      setActionError(result.error)
      return
    }

    setPendingId(row.id)
    setActionError(null)
    setNotice(null)

    try {
      await assignUserRole(row.id, roleCode)
      const roleName = roles.find((role) => role.code === roleCode)?.name ?? roleCode
      setNotice(`${roleName} assigned to ${row.full_name}.`)
      setRoleDrafts((current) => ({ ...current, [row.id]: '' }))
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setPendingId(null)
    }
  }

  const revokeRole = async (row: UserRow, roleCode: string) => {
    const assigned = row.roles.map((assignedRole) => assignedRole.code)
    const result = validateRoleRevocation(roleCode, assigned)

    if (!result.valid) {
      setActionError(result.error)
      setConfirmRevoke(null)
      return
    }

    setPendingId(row.id)
    setActionError(null)
    setNotice(null)

    try {
      await revokeUserRole(row.id, roleCode)
      const roleName = roles.find((role) => role.code === roleCode)?.name ?? roleCode
      setNotice(`${roleName} revoked from ${row.full_name}.`)
      setConfirmRevoke(null)

      // The database is authoritative, but the signed-in user's role cache is
      // loaded only on session events. Refresh it after a self-change.
      if (row.id === user?.id) await refreshUser?.()
      reload()
    } catch (error) {
      setActionError(toMessage(error))
      setConfirmRevoke(null)
    } finally {
      setPendingId(null)
    }
  }

  const openScopes = async (row: UserRow) => {
    if (scopeUserId === row.id) {
      setScopeUserId(null)
      setScopeRows(null)
      setScopeError(null)
      return
    }

    setScopeUserId(row.id)
    setScopeRows(null)
    setScopeError(null)

    try {
      setScopeRows(await listOutletScopes(row.id))
    } catch (error) {
      setScopeError(toMessage(error))
    }
  }

  const toggleScope = async (row: UserRow, outlet: Outlet, granted: boolean) => {
    setScopePendingOutletId(outlet.id)
    setScopeError(null)
    setNotice(null)

    try {
      if (granted) {
        await grantOutletScope(row.id, outlet.id, user?.id ?? null)
      } else {
        await revokeOutletScope(row.id, outlet.id)
      }
      setScopeRows(await listOutletScopes(row.id))
      setNotice(`${row.full_name}: ${outlet.name} access ${granted ? 'granted' : 'revoked'}.`)
    } catch (error) {
      setScopeError(toMessage(error))
    } finally {
      setScopePendingOutletId(null)
    }
  }

  return (
    <section aria-labelledby="users-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="users-heading" className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <UserCog className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Users, roles and outlet access
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Account creation happens in Supabase Auth (dashboard or the owner script). This page
              manages account status, role assignment and revocation, and per-outlet access.
            </p>
          </div>

          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <RotateCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
            Refresh
          </button>
        </div>

        {!canManage && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              Read-only. Changing account status, roles or outlet access requires the System
              Administrator role, and the database rejects the write without it.
            </span>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}

        {actionError && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{actionError}</span>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {users.length} account{users.length === 1 ? '' : 's'} ·{' '}
            {users.filter((row) => row.status === 'active').length} active
          </p>
        </div>

        {loading && users.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading users…
          </div>
        ) : loadError ? (
          <div role="alert" className="px-5 py-8 text-center">
            <AlertCircle className="mx-auto h-5 w-5 text-red-500" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-900">Could not load users</p>
            <p className="mt-1 text-sm text-slate-600">{loadError}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Try again
            </button>
          </div>
        ) : users.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No profiles yet. New Supabase Auth users get a profile automatically.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <caption className="sr-only">User accounts, roles and outlet access</caption>
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    User
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Roles
                  </th>
                  {canManage && (
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Assign role
                    </th>
                  )}
                  {canManage && (
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">
                      Account
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 align-top">
                {users.map((row) => {
                  const busy = pendingId === row.id
                  const isScoped = scopeUserId === row.id
                  const activeRevokeKey = confirmRevoke?.startsWith(`${row.id}:`)
                    ? confirmRevoke
                    : null
                  const activeRevokeCode = activeRevokeKey
                    ? activeRevokeKey.slice(row.id.length + 1)
                    : null
                  const activeRevokeName = activeRevokeCode
                    ? (roles.find((role) => role.code === activeRevokeCode)?.name ??
                      activeRevokeCode)
                    : null

                  return (
                    <tr key={row.id} className={cn(row.status === 'disabled' && 'bg-slate-50/60')}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{row.full_name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Joined {formatDate(row.created_at)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            row.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-200 text-slate-600',
                          )}
                        >
                          {row.status === 'active' ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {row.roles.length === 0 ? (
                          <span className="text-xs text-slate-500">No roles</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1">
                            {row.roles.map((role) => (
                              <span
                                key={role.code}
                                title={role.code}
                                className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
                              >
                                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                                {role.name}
                                {canManage && (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmRevoke(`${row.id}:${role.code}`)}
                                    disabled={busy}
                                    aria-label={`Revoke ${role.name} from ${row.full_name}`}
                                    title={`Revoke ${role.name}`}
                                    className="ml-0.5 rounded-full px-1 font-bold text-brand-600 transition hover:bg-brand-100 disabled:opacity-50"
                                  >
                                    ×
                                  </button>
                                )}
                              </span>
                            ))}
                            {canManage && activeRevokeCode && activeRevokeName && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                                Revoke {activeRevokeName}?
                                <button
                                  type="button"
                                  onClick={() => void revokeRole(row, activeRevokeCode)}
                                  disabled={busy}
                                  aria-label={`Confirm revoke ${activeRevokeName} from ${row.full_name}`}
                                  className="rounded px-1 font-semibold underline disabled:opacity-50"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmRevoke(null)}
                                  aria-label={`Cancel revoke ${activeRevokeName} from ${row.full_name}`}
                                  className="rounded px-1 font-medium underline"
                                >
                                  Cancel
                                </button>
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1">
                            <select
                              aria-label={`Role for ${row.full_name}`}
                              value={roleDrafts[row.id] ?? ''}
                              onChange={(event) =>
                                setRoleDrafts((current) => ({
                                  ...current,
                                  [row.id]: event.target.value,
                                }))
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-brand-500"
                            >
                              <option value="">Select role…</option>
                              {roles.map((role) => (
                                <option key={role.code} value={role.code}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => void assignRole(row)}
                              disabled={busy}
                              aria-label={`Assign role to ${row.full_name}`}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                              Assign
                            </button>
                          </div>
                        </td>
                      )}
                      {canManage && (
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void openScopes(row)}
                              aria-label={`Manage outlet access for ${row.full_name}`}
                              aria-expanded={isScoped}
                              className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                            >
                              Outlet access
                            </button>
                            <button
                              type="button"
                              onClick={() => void toggleStatus(row)}
                              disabled={busy}
                              aria-label={`${
                                row.status === 'active' ? 'Deactivate' : 'Reactivate'
                              } ${row.full_name}`}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                            >
                              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                              {row.status === 'active' ? 'Deactivate' : 'Reactivate'}
                            </button>
                          </div>
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

      {canManage && selectedUser && (
        <div className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Outlet access for {selectedUser.full_name}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Tick the outlets this account may work with. Changes are saved immediately.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setScopeUserId(null)
                setScopeRows(null)
                setScopeError(null)
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Done
            </button>
          </div>

          {scopeError && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {scopeError}
            </div>
          )}

          {scopeRows === null ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading outlet access…
            </div>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {scopeOutlets.map((outlet) => {
                const granted = grantedOutletIds.has(outlet.id)
                const pending = scopePendingOutletId === outlet.id

                return (
                  <label
                    key={outlet.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={granted}
                      disabled={pending}
                      onChange={(event) =>
                        void toggleScope(selectedUser, outlet, event.target.checked)
                      }
                      aria-label={`Access to ${outlet.name}`}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span>{outlet.name}</span>
                    <span className="text-xs text-slate-500">({outlet.code})</span>
                    {!outlet.is_active && (
                      <span className="ml-auto text-xs text-amber-700">Inactive outlet</span>
                    )}
                    {pending && (
                      <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden="true" />
                    )}
                  </label>
                )
              })}
            </div>
          )}

          {scopeOutlets.length === 0 && (
            <p className="mt-3 text-sm text-slate-500">
              No outlets exist yet. Create one in the outlet panel above.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
