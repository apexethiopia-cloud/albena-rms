import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, Building2, CheckCircle2, Loader2 } from 'lucide-react'
import { toMessage } from '@/lib/errors'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import { getBusinessSettings, updateBusinessSettings } from './api'
import {
  validateBusinessSettings,
  type BusinessSettingsDraft,
} from './validation'

const EMPTY: BusinessSettingsDraft = {
  businessName: '',
  tin: '',
  address: '',
  phone: '',
  vatRate: '15',
  receiptFooter: '',
}

export function BusinessSettingsPanel() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Mirrors can_manage_business_settings(): System Administrator and
  // General Manager. Everyone else keeps read access.
  const canManage = user
    ? hasRole(user.roles, 'system_admin') || hasRole(user.roles, 'general_manager')
    : false

  const [form, setForm] = useState<BusinessSettingsDraft>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    getBusinessSettings()
      .then((settings) => {
        if (cancelled) return
        setForm({
          businessName: settings.business_name,
          tin: settings.tin ?? '',
          address: settings.address ?? '',
          phone: settings.phone ?? '',
          vatRate: String(Number(settings.vat_rate)),
          receiptFooter: settings.receipt_footer ?? '',
        })
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

  const setField = (key: keyof BusinessSettingsDraft) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const result = validateBusinessSettings(form)
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)
    setNotice(null)

    try {
      await updateBusinessSettings(result.value)
      setNotice('Business and receipt settings were saved.')
      reload()
    } catch (error) {
      setFormError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="business-settings-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-2">
          <Building2 className="mt-0.5 h-4 w-4 text-brand-600" aria-hidden="true" />
          <div>
            <h2
              id="business-settings-heading"
              className="text-base font-semibold text-slate-900"
            >
              Business &amp; receipts
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Identity printed on every receipt and the VAT rate used when an order is
              closed. Menu prices are entered VAT-inclusive, so VAT is extracted as total ×
              rate ÷ (100 + rate) (OD-07, OD-08).
            </p>
          </div>
        </div>

        {!canManage && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Read-only: receipts and VAT settings are managed by the System Administrator and
            General Manager.
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {notice}
          </p>
        )}
        {formError && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
            Loading business settings…
          </p>
        ) : canManage ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-600">
                <span className="mb-1 block font-medium">Business name</span>
                <input
                  aria-label="Business name"
                  value={form.businessName}
                  onChange={(event) => setField('businessName')(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                {fieldErrors.businessName && (
                  <span className="mt-1 block text-red-600">{fieldErrors.businessName}</span>
                )}
              </label>

              <label className="text-xs text-slate-600">
                <span className="mb-1 block font-medium">TIN</span>
                <input
                  aria-label="TIN"
                  value={form.tin}
                  onChange={(event) => setField('tin')(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                {fieldErrors.tin && (
                  <span className="mt-1 block text-red-600">{fieldErrors.tin}</span>
                )}
              </label>

              <label className="text-xs text-slate-600 sm:col-span-2">
                <span className="mb-1 block font-medium">Address</span>
                <input
                  aria-label="Business address"
                  value={form.address}
                  onChange={(event) => setField('address')(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                {fieldErrors.address && (
                  <span className="mt-1 block text-red-600">{fieldErrors.address}</span>
                )}
              </label>

              <label className="text-xs text-slate-600">
                <span className="mb-1 block font-medium">Phone</span>
                <input
                  aria-label="Business phone"
                  value={form.phone}
                  onChange={(event) => setField('phone')(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                {fieldErrors.phone && (
                  <span className="mt-1 block text-red-600">{fieldErrors.phone}</span>
                )}
              </label>

              <label className="text-xs text-slate-600">
                <span className="mb-1 block font-medium">VAT rate (%)</span>
                <input
                  aria-label="VAT rate"
                  value={form.vatRate}
                  onChange={(event) => setField('vatRate')(event.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                {fieldErrors.vatRate && (
                  <span className="mt-1 block text-red-600">{fieldErrors.vatRate}</span>
                )}
              </label>

              <label className="text-xs text-slate-600 sm:col-span-2">
                <span className="mb-1 block font-medium">Receipt footer</span>
                <input
                  aria-label="Receipt footer"
                  value={form.receiptFooter}
                  onChange={(event) => setField('receiptFooter')(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                {fieldErrors.receiptFooter && (
                  <span className="mt-1 block text-red-600">{fieldErrors.receiptFooter}</span>
                )}
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save settings
            </button>
          </form>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Business name</dt>
              <dd className="text-slate-900">{form.businessName || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">TIN</dt>
              <dd className="text-slate-900">{form.tin || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Address</dt>
              <dd className="text-slate-900">{form.address || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Phone</dt>
              <dd className="text-slate-900">{form.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">VAT rate</dt>
              <dd className="text-slate-900">{form.vatRate}%</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Receipt footer</dt>
              <dd className="text-slate-900">{form.receiptFooter || '—'}</dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  )
}
