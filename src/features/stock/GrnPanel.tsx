import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { toMessage } from '@/lib/errors'
import { formatCurrency, formatDate, formatDateTime, toIsoDate } from '@/lib/format'
import { hasRole, useAuth } from '@/features/auth/auth-context'
import {
  listItemUnitConversions,
  listItems,
  listUnits,
  type Item,
  type Unit,
} from '@/features/items/api'
import { listLocations, type StockLocation } from '@/features/locations/api'
import { listSuppliers, type Supplier } from '@/features/suppliers/api'
import { listPurchaseOrders, type PurchaseOrder } from '@/features/procurement/api'
import {
  createGrn,
  deleteGrn,
  listGrns,
  listPurchaseOrderReceipts,
  postGrn,
  updateGrn,
  type Grn,
  type Numberish,
  type PurchaseOrderReceipt,
} from './api'
import {
  previewLine,
  resolveUnitFactor,
  validateGrn,
  type GrnDraft,
  type StockContext,
  type StockLineDraft,
} from './validation'

function number(value: Numberish): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function emptyLine(key: number): StockLineDraft {
  return { key: `grn-line-${key}`, itemId: '', quantity: '', unitId: '', unitCost: '' }
}

const RECEIPT_STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  partial: 'bg-sky-50 text-sky-800',
  complete: 'bg-emerald-50 text-emerald-700',
  over: 'bg-amber-50 text-amber-900',
}

function initialForm(locationId: string): GrnDraft {
  return {
    supplierId: '',
    invoiceNumber: '',
    receivedDate: toIsoDate(new Date()),
    locationId,
    notes: '',
    poId: '',
    lines: [emptyLine(1)],
  }
}

export function GrnPanel() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  // Mirrors can_post_grn() in migration 0005. The database is the boundary.
  const canPost = user
    ? hasRole(user.roles, 'system_admin') ||
      hasRole(user.roles, 'general_manager') ||
      hasRole(user.roles, 'purchasing_officer') ||
      hasRole(user.roles, 'storekeeper')
    : false

  const [documents, setDocuments] = useState<Grn[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [conversions, setConversions] = useState<
    Array<{ item_id: string; unit_id: string; base_factor: number }>
  >([])
  const [locations, setLocations] = useState<StockLocation[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [receipts, setReceipts] = useState<PurchaseOrderReceipt[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<GrnDraft>(() => initialForm(''))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [formNotice, setFormNotice] = useState<string | null>(null)

  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmPostId, setConfirmPostId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const lineSequence = useRef(1)

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([
      listGrns(),
      listSuppliers(),
      listItems(),
      listUnits(),
      listItemUnitConversions(),
      listLocations(),
    ])
      .then(([grnRows, supplierRows, itemRows, unitRows, conversionRows, locationRows]) => {
        if (cancelled) return
        setDocuments(grnRows)
        setSuppliers(supplierRows)
        setItems(itemRows)
        setUnits(unitRows)
        setConversions(conversionRows)
        setLocations(locationRows)
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(toMessage(error))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    // GRN ↔ PO linkage needs migrations 0006 and 0007. If they are not applied yet,
    // receiving still works without a purchase order, so this failure is not fatal.
    Promise.all([listPurchaseOrders(), listPurchaseOrderReceipts()])
      .then(([orderRows, receiptRows]) => {
        if (cancelled) return
        setOrders(orderRows)
        setReceipts(receiptRows)
      })
      .catch(() => {
        if (cancelled) return
        setOrders([])
        setReceipts([])
      })

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const activeSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.is_active),
    [suppliers],
  )
  const activeItems = useMemo(() => items.filter((item) => item.is_active), [items])
  const activeLocations = useMemo(
    () => locations.filter((location) => location.is_active),
    [locations],
  )
  // A delivery is received against an order that has at least been approved.
  const receivableOrders = useMemo(
    () => orders.filter((order) => order.status === 'approved' || order.status === 'ordered'),
    [orders],
  )
  const supplierById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers],
  )
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  )
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units])
  const orderById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders])
  const receiptByLineId = useMemo(
    () => new Map(receipts.map((receipt) => [receipt.po_line_id, receipt])),
    [receipts],
  )

  const context: StockContext = useMemo(
    () => ({ items, units, conversions }),
    [items, units, conversions],
  )

  const unitsForItem = useCallback(
    (itemId: string): Unit[] => {
      if (!itemId) return []
      return units.filter((unit) => previewLine(
        { key: 'probe', itemId, quantity: '1', unitId: unit.id, unitCost: '1' },
        context,
      ).factor !== null)
    },
    [units, context],
  )

  const selectPurchaseOrder = (poId: string) => {
    const order = poId ? orderById.get(poId) : null

    if (!order) {
      lineSequence.current = 1
      setForm((current) => ({
        ...current,
        poId: '',
        lines: current.lines.map((line) => ({ ...line, poLineId: undefined })),
      }))
      setFormNotice(null)
      return
    }

    const outstanding = receipts.filter(
      (receipt) => receipt.po_id === order.id && Number(receipt.outstanding_base_quantity) > 0,
    )

    const seeded: StockLineDraft[] = outstanding.map((receipt, index) => {
      const resolved = resolveUnitFactor(receipt.item_id, receipt.ordered_unit_id, context)
      const baseUnitId = itemById.get(receipt.item_id)?.base_unit_id ?? receipt.ordered_unit_id
      const unitId = resolved.factor === null ? baseUnitId : receipt.ordered_unit_id
      const quantity =
        resolved.factor === null
          ? Number(receipt.outstanding_base_quantity)
          : Number(receipt.outstanding_base_quantity) / resolved.factor
      return {
        key: `grn-po-${order.id}-${index + 1}`,
        itemId: receipt.item_id,
        unitId,
        quantity: String(Number(quantity.toFixed(6))),
        unitCost: String(receipt.unit_cost),
        poLineId: receipt.po_line_id,
      }
    })

    lineSequence.current = Math.max(seeded.length, 1)
    setForm((current) => ({
      ...current,
      poId: order.id,
      supplierId: order.supplier_id,
      lines: seeded.length > 0 ? seeded : [emptyLine(lineSequence.current)],
    }))
    setFieldErrors({})
    setFormError(null)
    setFormNotice(
      seeded.length > 0
        ? `Loaded ${seeded.length} outstanding line${seeded.length === 1 ? '' : 's'} from ${order.po_number}. Adjust the quantities to match the delivery.`
        : `${order.po_number} has no outstanding lines. Add a line only if this delivery is outside the order.`,
    )
  }

  const openCreate = () => {
    lineSequence.current = 1
    setEditingId(null)
    setForm(initialForm(activeLocations[0]?.id ?? ''))
    setFieldErrors({})
    setFormError(null)
    setFormNotice(null)
    setNotice(null)
    setFormOpen(true)
  }

  const openEdit = (document: Grn) => {
    lineSequence.current = Math.max(document.grn_lines.length, 1)
    setEditingId(document.id)
    setForm({
      supplierId: document.supplier_id,
      invoiceNumber: document.invoice_number,
      receivedDate: document.received_date,
      locationId: document.location_id,
      notes: document.notes ?? '',
      poId: document.po_id ?? '',
      lines: document.grn_lines.map((line, index) => ({
        key: `grn-edit-${index + 1}`,
        itemId: line.item_id,
        unitId: line.unit_id,
        quantity: String(line.quantity),
        unitCost: String(line.unit_cost),
        poLineId: line.po_line_id ?? undefined,
      })),
    })
    setFieldErrors({})
    setFormError(null)
    setFormNotice(null)
    setNotice(null)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditingId(null)
    setFieldErrors({})
    setFormError(null)
    setFormNotice(null)
  }

  const setField = (key: keyof GrnDraft) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const setLine = (index: number, patch: Partial<StockLineDraft>) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }))
  }

  const addLine = () => {
    lineSequence.current += 1
    setForm((current) => ({
      ...current,
      lines: [...current.lines, emptyLine(lineSequence.current)],
    }))
  }

  const removeLine = (index: number) => {
    setForm((current) => ({
      ...current,
      lines: current.lines.filter((_, lineIndex) => lineIndex !== index),
    }))
  }

  const selectItem = (index: number, itemId: string) => {
    const item = itemById.get(itemId)
    setLine(index, { itemId, unitId: item?.base_unit_id ?? '', poLineId: undefined })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const result = validateGrn(form, context)
    setFieldErrors(result.errors)
    if (!result.valid) return

    setSaving(true)
    setFormError(null)
    setNotice(null)

    try {
      if (editingId) {
        await updateGrn(editingId, result.value)
        setNotice('GRN draft updated. Post it to move stock.')
      } else {
        await createGrn(result.value)
        setNotice('GRN saved as a draft. Post it to move stock.')
      }
      closeForm()
      reload()
    } catch (error) {
      setFormError(toMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (document: Grn) => {
    setPendingId(document.id)
    setActionError(null)
    setNotice(null)

    try {
      await deleteGrn(document.id)
      setNotice(`GRN ${document.grn_number} deleted.`)
      setConfirmDeleteId(null)
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setPendingId(null)
    }
  }

  const post = async (document: Grn) => {
    setPendingId(document.id)
    setActionError(null)
    setNotice(null)

    try {
      await postGrn(document.id)
      setNotice(`GRN ${document.grn_number} posted. The stock ledger now contains its layers.`)
      setConfirmPostId(null)
      setConfirmDeleteId(null)
      reload()
    } catch (error) {
      setActionError(toMessage(error))
    } finally {
      setPendingId(null)
    }
  }

  const formTotal = form.lines.reduce((sum, line) => {
    const preview = previewLine(line, context)
    return sum + (preview.lineTotal ?? 0)
  }, 0)

  return (
    <section aria-labelledby="grn-heading" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="grn-heading" className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <PackageCheck className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Goods receiving notes
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Record a delivery, then post it once. Posting increases the selected location and
              creates one FIFO cost layer per line (ADR-009). Approval steps are not implemented
              because the owner has not defined the OD-06 thresholds.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
            >
              <RotateCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
              Refresh
            </button>
            {canPost && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New GRN
              </button>
            )}
          </div>
        </div>

        {!canPost && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              Read-only. Creating and posting receiving notes requires a System Administrator,
              General Manager, Purchasing Officer or Storekeeper role, and the database rejects the
              write without it.
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

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-labelledby="grn-form-heading"
          className="rounded-xl border border-brand-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="grn-form-heading" className="text-sm font-semibold text-slate-900">
                {editingId ? 'Edit goods receiving note' : 'New goods receiving note'}
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                Quantities are entered in the selected unit. The database converts them to the item
                base unit when the draft is saved.
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close GRN form"
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

          {formNotice && (
            <div
              role="status"
              className="mt-3 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" aria-hidden="true" />
              <span>{formNotice}</span>
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <label htmlFor="grn-po" className="block text-sm font-medium text-slate-700">
                Purchase order <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <select
                id="grn-po"
                value={form.poId}
                onChange={(event) => selectPurchaseOrder(event.target.value)}
                disabled={Boolean(editingId)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 disabled:bg-slate-100 disabled:text-slate-500 sm:max-w-md"
              >
                <option value="">No purchase order — receive without a link</option>
                {receivableOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.po_number} · {supplierById.get(order.supplier_id)?.name ?? 'Unknown'} ·{' '}
                    {order.status}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {editingId
                  ? 'The purchase order link is fixed when editing. Its supplier stays locked.'
                  : 'Approved and ordered purchase orders only. Selecting one fixes the supplier and loads its outstanding lines; shortages and over-receipts are recorded for review against the order.'}
              </p>
            </div>

            <div>
              <p className="block text-sm font-medium text-slate-700">GRN number</p>
              <p className="mt-1 text-xs text-slate-500">
                Number assigned automatically when saved.
              </p>
            </div>

            <div>
              <label htmlFor="grn-supplier" className="block text-sm font-medium text-slate-700">
                Supplier
              </label>
              <select
                id="grn-supplier"
                value={form.supplierId}
                onChange={(event) => setField('supplierId')(event.target.value)}
                disabled={Boolean(form.poId)}
                aria-invalid={Boolean(fieldErrors.supplierId)}
                className={cn(
                  'mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 disabled:bg-slate-100 disabled:text-slate-500',
                  fieldErrors.supplierId ? 'border-red-400' : 'border-slate-300',
                )}
              >
                <option value="">Select supplier…</option>
                {activeSuppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} ({supplier.code})
                  </option>
                ))}
              </select>
              {form.poId && (
                <p className="mt-1 text-xs text-slate-500">
                  Fixed by the selected purchase order.
                </p>
              )}
              {fieldErrors.supplierId && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.supplierId}</p>
              )}
            </div>

            <div>
              <label htmlFor="grn-invoice" className="block text-sm font-medium text-slate-700">
                Supplier invoice
              </label>
              <input
                id="grn-invoice"
                value={form.invoiceNumber}
                onChange={(event) => setField('invoiceNumber')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.invoiceNumber)}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.invoiceNumber ? 'border-red-400' : 'border-slate-300',
                )}
                placeholder="Invoice number"
                autoComplete="off"
              />
              {fieldErrors.invoiceNumber && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.invoiceNumber}</p>
              )}
            </div>

            <div>
              <label htmlFor="grn-date" className="block text-sm font-medium text-slate-700">
                Received date
              </label>
              <input
                id="grn-date"
                type="date"
                value={form.receivedDate}
                onChange={(event) => setField('receivedDate')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.receivedDate)}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.receivedDate ? 'border-red-400' : 'border-slate-300',
                )}
              />
              {fieldErrors.receivedDate && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.receivedDate}</p>
              )}
            </div>

            <div>
              <label htmlFor="grn-location" className="block text-sm font-medium text-slate-700">
                Receiving location
              </label>
              <select
                id="grn-location"
                value={form.locationId}
                onChange={(event) => setField('locationId')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.locationId)}
                className={cn(
                  'mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.locationId ? 'border-red-400' : 'border-slate-300',
                )}
              >
                <option value="">Select location…</option>
                {activeLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.code})
                  </option>
                ))}
              </select>
              {fieldErrors.locationId && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.locationId}</p>
              )}
            </div>

            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="grn-notes" className="block text-sm font-medium text-slate-700">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="grn-notes"
                value={form.notes}
                onChange={(event) => setField('notes')(event.target.value)}
                aria-invalid={Boolean(fieldErrors.notes)}
                className={cn(
                  'mt-1 w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-brand-500',
                  fieldErrors.notes ? 'border-red-400' : 'border-slate-300',
                )}
                placeholder="Delivery note reference or comment"
                autoComplete="off"
              />
              {fieldErrors.notes && (
                <p className="mt-1 text-xs text-red-700">{fieldErrors.notes}</p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-slate-900">Lines</h4>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add line
              </button>
            </div>
            {fieldErrors.lines && <p className="mt-1 text-xs text-red-700">{fieldErrors.lines}</p>}

            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="py-2 pr-2 font-medium">Item</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Quantity</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Unit</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Unit cost</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Base quantity</th>
                    <th scope="col" className="py-2 pr-2 text-right font-medium">Line total</th>
                    <th scope="col" className="py-2 font-medium">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 align-top">
                  {form.lines.map((line, index) => {
                    const preview = previewLine(line, context)
                    const availableUnits = unitsForItem(line.itemId)
                    const receipt = line.poLineId
                      ? receiptByLineId.get(line.poLineId)
                      : undefined
                    const outstandingBase = receipt
                      ? Number(receipt.outstanding_base_quantity)
                      : null
                    const baseUnitCode = (() => {
                      const item = itemById.get(line.itemId)
                      return item ? unitById.get(item.base_unit_id)?.code ?? '' : ''
                    })()
                    const overReceipt =
                      receipt !== undefined &&
                      preview.baseQuantity !== null &&
                      outstandingBase !== null &&
                      preview.baseQuantity > outstandingBase

                    return (
                      <tr key={line.key}>
                        <td className="py-2 pr-2">
                          <select
                            aria-label={`Item for line ${index + 1}`}
                            value={line.itemId}
                            onChange={(event) => selectItem(index, event.target.value)}
                            className="w-full min-w-[10rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-brand-500"
                          >
                            <option value="">Select item…</option>
                            {activeItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.code})
                              </option>
                            ))}
                          </select>
                          {fieldErrors[`line-${index}-item`] && (
                            <p className="mt-1 text-xs text-red-700">
                              {fieldErrors[`line-${index}-item`]}
                            </p>
                          )}
                          {receipt && (
                            <p
                              data-testid={`grn-line-${index + 1}-receipt`}
                              className="mt-1 max-w-[16rem] text-xs text-slate-500"
                            >
                              PO line: ordered{' '}
                              {number(receipt.ordered_quantity).toLocaleString('en-ET')}{' '}
                              {receipt.ordered_unit_code}, received{' '}
                              {number(receipt.received_base_quantity).toLocaleString('en-ET')}{' '}
                              {baseUnitCode}, outstanding{' '}
                              {number(receipt.outstanding_base_quantity).toLocaleString('en-ET')}{' '}
                              {baseUnitCode} ({receipt.receipt_status})
                            </p>
                          )}
                          {overReceipt && (
                            <p
                              role="status"
                              className="mt-1 max-w-[16rem] rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900"
                            >
                              Exceeds the outstanding quantity. Over-receipts are recorded for
                              review.
                            </p>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            aria-label={`Quantity for line ${index + 1}`}
                            value={line.quantity}
                            onChange={(event) => setLine(index, { quantity: event.target.value })}
                            inputMode="decimal"
                            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-brand-500"
                            placeholder="0"
                          />
                          {fieldErrors[`line-${index}-quantity`] && (
                            <p className="mt-1 text-xs text-red-700">
                              {fieldErrors[`line-${index}-quantity`]}
                            </p>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            aria-label={`Unit for line ${index + 1}`}
                            value={line.unitId}
                            onChange={(event) => setLine(index, { unitId: event.target.value })}
                            className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-brand-500"
                          >
                            <option value="">Select…</option>
                            {availableUnits.map((unit) => (
                              <option key={unit.id} value={unit.id}>
                                {unit.name} ({unit.code})
                              </option>
                            ))}
                          </select>
                          {fieldErrors[`line-${index}-unit`] && (
                            <p className="mt-1 max-w-[14rem] text-xs text-red-700">
                              {fieldErrors[`line-${index}-unit`]}
                            </p>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            aria-label={`Unit cost for line ${index + 1}`}
                            value={line.unitCost}
                            onChange={(event) => setLine(index, { unitCost: event.target.value })}
                            inputMode="decimal"
                            className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm shadow-sm focus:border-brand-500"
                            placeholder="0.00"
                          />
                          {fieldErrors[`line-${index}-cost`] && (
                            <p className="mt-1 text-xs text-red-700">
                              {fieldErrors[`line-${index}-cost`]}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-2 text-xs text-slate-600">
                          {preview.baseQuantity === null
                            ? '—'
                            : `${preview.baseQuantity.toLocaleString('en-ET', {
                                maximumFractionDigits: 6,
                              })} ${itemById.get(line.itemId) ? unitById.get(itemById.get(line.itemId)!.base_unit_id)?.code ?? '' : ''}`}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-2 text-right tabular-nums text-slate-700">
                          {preview.lineTotal === null ? '—' : formatCurrency(preview.lineTotal)}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            aria-label={`Remove line ${index + 1}`}
                            className="rounded-md p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-600">
                The ledger stores base units; the document keeps the unit you entered.
              </p>
              <p className="text-sm font-semibold text-slate-900">
                Total {formatCurrency(formTotal)}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save draft
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {documents.length} document{documents.length === 1 ? '' : 's'} ·{' '}
            {documents.filter((document) => document.posted_at === null).length} draft
          </p>
        </div>

        {loading && documents.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading receiving notes…
          </div>
        ) : loadError ? (
          <div role="alert" className="px-5 py-8 text-center">
            <AlertCircle className="mx-auto h-5 w-5 text-red-500" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-900">Could not load receiving notes</p>
            <p className="mt-1 text-sm text-slate-600">{loadError}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Try again
            </button>
          </div>
        ) : documents.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No receiving notes yet. Create one to record a delivery.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {documents.map((document) => {
              const total = document.grn_lines.reduce(
                (sum, line) => sum + number(line.line_total),
                0,
              )
              const isPosted = document.posted_at !== null
              const busy = pendingId === document.id

              return (
                <article key={document.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{document.grn_number}</p>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            isPosted
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-800',
                          )}
                        >
                          {isPosted ? 'Posted' : 'Draft'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {supplierById.get(document.supplier_id)?.name ?? 'Unknown supplier'} ·{' '}
                        Invoice {document.invoice_number} ·{' '}
                        {locationById.get(document.location_id)?.name ?? 'Unknown location'}
                        {document.po_id && (
                          <>
                            {' · '}
                            <span className="font-medium text-slate-700">
                              {orderById.get(document.po_id)?.po_number ?? 'Purchase order'}
                            </span>
                          </>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Received {formatDate(document.received_date)}
                        {isPosted && document.posted_at
                          ? ` · Posted ${formatDateTime(document.posted_at)}`
                          : ' · Not yet posted'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCurrency(total)}
                      </p>
                      {canPost && !isPosted && (
                        <>
                          {confirmDeleteId === document.id ? (
                            <>
                              <span className="text-xs text-slate-600">Delete this draft?</span>
                              <button
                                type="button"
                                onClick={() => void remove(document)}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                              >
                                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                                Confirm delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={busy}
                                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => openEdit(document)}
                                aria-label={`Edit GRN ${document.grn_number}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDeleteId(document.id)
                                  setConfirmPostId(null)
                                }}
                                aria-label={`Delete GRN ${document.grn_number}`}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Delete
                              </button>
                            </>
                          )}
                          {confirmPostId === document.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void post(document)}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
                              >
                                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                                Confirm post
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmPostId(null)}
                                disabled={busy}
                                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmPostId(document.id)
                                setConfirmDeleteId(null)
                              }}
                              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              Post
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900">
                      View {document.grn_lines.length} line
                      {document.grn_lines.length === 1 ? '' : 's'}
                    </summary>
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead className="text-left uppercase tracking-wide text-slate-500">
                          <tr>
                            <th scope="col" className="py-1 pr-3 font-medium">Item</th>
                            <th scope="col" className="py-1 pr-3 text-right font-medium">Quantity</th>
                            <th scope="col" className="py-1 pr-3 font-medium">Unit</th>
                            <th scope="col" className="py-1 pr-3 text-right font-medium">Unit cost</th>
                            <th scope="col" className="py-1 pr-3 text-right font-medium">Base quantity</th>
                            <th scope="col" className="py-1 text-right font-medium">Line total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {document.grn_lines.map((line) => (
                            <tr key={line.id}>
                              <td className="py-1.5 pr-3">
                                {itemById.get(line.item_id)?.name ?? line.item_id}
                              </td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">
                                {number(line.quantity)}
                              </td>
                              <td className="py-1.5 pr-3">
                                {unitById.get(line.unit_id)?.code ?? line.unit_id}
                              </td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">
                                {formatCurrency(number(line.unit_cost))}
                              </td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">
                                {line.base_quantity === null
                                  ? '—'
                                  : number(line.base_quantity)}
                              </td>
                              <td className="py-1.5 text-right tabular-nums">
                                {formatCurrency(number(line.line_total))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {receipts.length > 0 && (
        <section
          aria-labelledby="po-receipts-heading"
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-200 px-5 py-3">
            <h3 id="po-receipts-heading" className="text-sm font-semibold text-slate-900">
              Purchase order receipts
            </h3>
            <p className="mt-0.5 text-xs text-slate-600">
              Ordered against received per purchase order line, using posted GRNs only. Drafts do
              not count, and over-receipts stay visible for review (GRN-04).
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-2 font-medium">Purchase order</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Item</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Ordered</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Received</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Outstanding</th>
                  <th scope="col" className="py-2 pr-5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {receipts.map((receipt) => {
                  const baseUnitId = itemById.get(receipt.item_id)?.base_unit_id
                  const baseUnitCode = baseUnitId ? unitById.get(baseUnitId)?.code ?? '' : ''
                  return (
                    <tr key={receipt.po_line_id}>
                      <td className="px-5 py-2 whitespace-nowrap font-medium text-slate-900">
                        {receipt.po_number}
                      </td>
                      <td className="py-2 pr-3">
                        {receipt.item_name}{' '}
                        <span className="text-xs text-slate-500">({receipt.item_code})</span>
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                        {number(receipt.ordered_quantity).toLocaleString('en-ET')}{' '}
                        {receipt.ordered_unit_code}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                        {number(receipt.received_base_quantity).toLocaleString('en-ET')}{' '}
                        {baseUnitCode}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                        {number(receipt.outstanding_base_quantity).toLocaleString('en-ET')}{' '}
                        {baseUnitCode}
                      </td>
                      <td className="py-2 pr-5">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                            RECEIPT_STATUS_CLASSES[receipt.receipt_status] ??
                              'bg-slate-100 text-slate-700',
                          )}
                        >
                          {receipt.receipt_status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  )
}
