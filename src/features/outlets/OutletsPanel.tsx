import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import { createOutlet, listOutlets, updateOutlet, type Outlet } from './api'
import { toMessage, validateOutlet } from './validation'

type FormMode = { kind: 'create' } | { kind: 'edit'; outlet: Outlet }

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1 text-xs text-red-700">
      {message}
    </p>
  )
}

export function OutletsPanel() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Convenience only, and deliberately narrower than the master-data policies:
  // the applied `outlets_admin_write` policy allows system_admin only (ADR-003).
  const canManage = user ? hasRole(user.roles, 'system_admin') : false

  const [outlets, setOutlets] = useState<Outlet[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [mode, setMode] = useState<FormMode | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    listOutlets()
      .then((rows) => {
        if (!cancelled) setOutlets(rows)
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

  const closeForm = () => {
    setMode(null)
    setFieldErrors({})
    setFormError(null)
  }

  const openCreate = () => {
    setMode({ kind: 'create' })
    setCode('')
    setName('')
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
  }

  const openEdit = (outlet: Outlet) => {
    setMode({ kind: 'edit', outlet })
    setCode(outlet.code)
    setName(outlet.name)
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!mode) return

    const result = validateOutlet({ code, name })
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)

    try {
      const label = result.normalized.code ? `Outlet ${result.normalized.code}` : 'Outlet'
      if (mode.kind === 'create') {
        await createOutlet(result.normalized)
        setNotice(`${label} created.`)
      } else {
        await updateOutlet(mode.outlet.id, result.normalized)
        setNotice(`${label} updated.`)
      }
      closeForm()
      reload()
    } catch (error) {
      setFormError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (outlet: Outlet) => {
    setPendingId(outlet.id)
    setActionError(null)
    setNotice(null)

    try {
      await updateOutlet(outlet.id, { is_active: !outlet.is_active })
      setNotice(
        `${outlet.code} ${outlet.is_active ? 'deactivated' : 'reactivated'}. ${
          outlet.is_active
            ? 'Historical records and user scopes are kept.'
            : 'Users with this scope can use it again.'
        }`,
      )
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setPendingId(null)
    }
  }

  const activeCount = outlets.filter((outlet) => outlet.is_active).length

  return (
    <section aria-labelledby="outlets-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="outlets-heading" className="text-base font-semibold text-slate-900">
              Outlets
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              One business entity, multiple service outlets (OD-02). Outlets are never deleted, only
              deactivated, so historical records keep their attribution.
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-obsidian transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New outlet
            </button>
          )}
        </div>

        {!canManage && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              Read-only. Changing outlets requires the System Administrator role, and the database
              rejects the write without it.
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

      {mode && (
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-labelledby="outlet-form-heading"
          className="rounded-xl border border-brand-200 bg-surface p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 id="outlet-form-heading" className="text-sm font-semibold text-slate-900">
              {mode.kind === 'create' ? 'New outlet' : `Edit ${mode.outlet.code}`}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close outlet form"
              className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {formError && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {formError}
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="outlet-code" className="block text-sm font-medium text-slate-700">
                Code
              </label>
              <input
                id="outlet-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                aria-invalid={Boolean(fieldErrors.code)}
                aria-describedby={fieldErrors.code ? 'outlet-code-error' : 'outlet-code-hint'}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm uppercase shadow-sm focus:border-brand-500',
                  fieldErrors.code ? 'border-red-400' : 'border-slate-300',
                )}
                placeholder="Auto-generated"
                autoComplete="off"
              />
              <p id="outlet-code-hint" className="mt-1 text-xs text-slate-500">
                Leave blank to generate a code automatically.
              </p>
              <FieldError id="outlet-code-error" message={fieldErrors.code} />
            </div>

            <div>
              <label htmlFor="outlet-name" className="block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                id="outlet-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'outlet-name-error' : undefined}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.name ? 'border-red-400' : 'border-slate-300',
                )}
                placeholder="e.g. Terrace Restaurant"
                autoComplete="off"
              />
              <FieldError id="outlet-name-error" message={fieldErrors.name} />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-obsidian transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {mode.kind === 'create' ? 'Create outlet' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {outlets.length} outlet{outlets.length === 1 ? '' : 's'} · {activeCount} active
          </p>
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

        {loading && outlets.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading outlets…
          </div>
        ) : loadError ? (
          <div role="alert" className="px-5 py-8 text-center">
            <AlertCircle className="mx-auto h-5 w-5 text-red-500" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-900">Could not load outlets</p>
            <p className="mt-1 text-sm text-slate-600">{loadError}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Try again
            </button>
          </div>
        ) : outlets.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No outlets yet. {canManage ? 'Create the first one.' : 'Ask an administrator.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <caption className="sr-only">Outlets of the business entity</caption>
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Code
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Name
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Updated
                  </th>
                  {canManage && (
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outlets.map((outlet) => (
                  <tr key={outlet.id} className={cn(!outlet.is_active && 'bg-slate-50/60')}>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs font-semibold text-slate-700">
                      {outlet.code}
                    </td>
                    <td className="px-5 py-3 text-slate-900">{outlet.name}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          outlet.is_active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-200 text-slate-600',
                        )}
                      >
                        {outlet.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                      {formatDate(outlet.updated_at)}
                    </td>
                    {canManage && (
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(outlet)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(outlet)}
                            disabled={pendingId === outlet.id}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                          >
                            {pendingId === outlet.id && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            )}
                            {outlet.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
