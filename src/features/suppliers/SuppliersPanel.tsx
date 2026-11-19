import { useEffect, useState, type FormEvent } from 'react'
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
import { toMessage } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import { createSupplier, listSuppliers, updateSupplier, type Supplier } from './api'
import { validateSupplier, type SupplierInput } from './validation'

type FormMode = { kind: 'create' } | { kind: 'edit'; supplier: Supplier }

const EMPTY: SupplierInput = {
  code: '',
  name: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  taxNumber: '',
  paymentTerms: '',
}

function fromSupplier(supplier: Supplier): SupplierInput {
  return {
    code: supplier.code,
    name: supplier.name,
    contactName: supplier.contact_name ?? '',
    phone: supplier.phone ?? '',
    email: supplier.email ?? '',
    address: supplier.address ?? '',
    taxNumber: supplier.tax_number ?? '',
    paymentTerms: supplier.payment_terms ?? '',
  }
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  type = 'text',
  wide = false,
  autoComplete = 'off',
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  placeholder?: string
  type?: string
  wide?: boolean
  autoComplete?: string
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={cn(wide && 'sm:col-span-2')}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn(
          'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
          error ? 'border-red-400' : 'border-slate-300',
        )}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

export function SuppliersPanel() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Mirrors `suppliers_write` in migration 0003. The database is the boundary (ADR-003).
  const canManage = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'purchasing_officer')
    : false

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [mode, setMode] = useState<FormMode | null>(null)
  const [form, setForm] = useState<SupplierInput>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    listSuppliers()
      .then((rows) => {
        if (!cancelled) setSuppliers(rows)
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

  const reload = () => setReloadToken((token) => token + 1)

  const setField = (key: keyof SupplierInput) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const closeForm = () => {
    setMode(null)
    setFieldErrors({})
    setFormError(null)
  }

  const openCreate = () => {
    setMode({ kind: 'create' })
    setForm(EMPTY)
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
  }

  const openEdit = (supplier: Supplier) => {
    setMode({ kind: 'edit', supplier })
    setForm(fromSupplier(supplier))
    setFieldErrors({})
    setFormError(null)
    setNotice(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!mode) return

    const result = validateSupplier(form)
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)

    try {
      const label = result.normalized.code ? `Supplier ${result.normalized.code}` : 'Supplier'
      if (mode.kind === 'create') {
        await createSupplier(result.normalized)
        setNotice(`${label} created.`)
      } else {
        await updateSupplier(mode.supplier.id, result.normalized)
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

  const toggleActive = async (supplier: Supplier) => {
    setPendingId(supplier.id)
    setActionError(null)
    setNotice(null)

    try {
      await updateSupplier(supplier.id, { is_active: !supplier.is_active })
      setNotice(
        `${supplier.code} ${supplier.is_active ? 'deactivated' : 'reactivated'}. ${
          supplier.is_active
            ? 'Purchase history keeps referencing it.'
            : 'It can be selected on new purchase documents again.'
        }`,
      )
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setPendingId(null)
    }
  }

  const activeCount = suppliers.filter((supplier) => supplier.is_active).length

  return (
    <section aria-labelledby="suppliers-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="suppliers-heading" className="text-base font-semibold text-slate-900">
              Suppliers
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Supplier master data used by purchase requests, purchase orders and goods receiving.
              Suppliers are deactivated, never deleted, so history stays intact.
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-obsidian transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New supplier
            </button>
          )}
        </div>

        {!canManage && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              Read-only. Changing suppliers requires the System Administrator, General Manager or
              Purchasing Officer role, and the database rejects the write without it.
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
          aria-labelledby="supplier-form-heading"
          className="rounded-xl border border-brand-200 bg-surface p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 id="supplier-form-heading" className="text-sm font-semibold text-slate-900">
              {mode.kind === 'create' ? 'New supplier' : `Edit ${mode.supplier.code}`}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close supplier form"
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
            <Field
              id="supplier-code"
              label="Code"
              value={form.code}
              onChange={setField('code')}
              error={fieldErrors.code}
              placeholder="Auto-generated"
              hint="Leave blank to generate a code automatically."
            />
            <Field
              id="supplier-name"
              label="Supplier name"
              value={form.name}
              onChange={setField('name')}
              error={fieldErrors.name}
            />
            <Field
              id="supplier-contact"
              label="Contact name"
              value={form.contactName}
              onChange={setField('contactName')}
              error={fieldErrors.contactName}
              autoComplete="name"
            />
            <Field
              id="supplier-phone"
              label="Phone"
              type="tel"
              value={form.phone}
              onChange={setField('phone')}
              error={fieldErrors.phone}
              autoComplete="tel"
            />
            <Field
              id="supplier-email"
              label="Email"
              type="email"
              value={form.email}
              onChange={setField('email')}
              error={fieldErrors.email}
              autoComplete="email"
            />
            <Field
              id="supplier-tax"
              label="Tax number"
              value={form.taxNumber}
              onChange={setField('taxNumber')}
              error={fieldErrors.taxNumber}
            />
            <Field
              id="supplier-terms"
              label="Payment terms"
              value={form.paymentTerms}
              onChange={setField('paymentTerms')}
              error={fieldErrors.paymentTerms}
              hint="For example: 30 days from invoice date."
            />
            <Field
              id="supplier-address"
              label="Address"
              value={form.address}
              onChange={setField('address')}
              error={fieldErrors.address}
              wide
              autoComplete="street-address"
            />
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-obsidian transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {mode.kind === 'create' ? 'Create supplier' : 'Save changes'}
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
            {suppliers.length} supplier{suppliers.length === 1 ? '' : 's'} · {activeCount} active
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

        {loading && suppliers.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading suppliers…
          </div>
        ) : loadError ? (
          <div role="alert" className="px-5 py-8 text-center">
            <AlertCircle className="mx-auto h-5 w-5 text-red-500" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-900">Could not load suppliers</p>
            <p className="mt-1 text-sm text-slate-600">{loadError}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Try again
            </button>
          </div>
        ) : suppliers.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No suppliers yet. {canManage ? 'Create the first one.' : 'Ask an administrator.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <caption className="sr-only">Supplier master data</caption>
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Code
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Supplier
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Contact
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
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className={cn(!supplier.is_active && 'bg-slate-50/60')}>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs font-semibold text-slate-700">
                      {supplier.code}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{supplier.name}</p>
                      {supplier.address && (
                        <p className="mt-0.5 max-w-xs truncate text-xs text-slate-500">
                          {supplier.address}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      <p>{supplier.contact_name ?? '—'}</p>
                      <p className="text-xs text-slate-500">{supplier.phone ?? 'No phone'}</p>
                      {supplier.email && (
                        <p className="max-w-[14rem] truncate text-xs text-slate-500">
                          {supplier.email}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          supplier.is_active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-200 text-slate-600',
                        )}
                      >
                        {supplier.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                      {formatDate(supplier.updated_at)}
                    </td>
                    {canManage && (
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(supplier)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(supplier)}
                            disabled={pendingId === supplier.id}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                          >
                            {pendingId === supplier.id && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            )}
                            {supplier.is_active ? 'Deactivate' : 'Reactivate'}
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
