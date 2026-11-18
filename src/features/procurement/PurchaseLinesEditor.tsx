import { Plus, Trash2 } from 'lucide-react'
import type { Item, Unit } from '@/features/items/api'
import type { PurchaseLineDraft } from './validation'

type PurchaseLinesEditorProps = {
  lines: PurchaseLineDraft[]
  items: readonly Item[]
  unitsForItem: (itemId: string) => Unit[]
  errors: Record<string, string>
  showCost: boolean
  labelPrefix: 'request' | 'order'
  onSelectItem: (index: number, itemId: string) => void
  onSetLine: (index: number, patch: Partial<PurchaseLineDraft>) => void
  onAddLine: () => void
  onRemoveLine: (index: number) => void
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-700">{message}</p>
}

export function PurchaseLinesEditor({
  lines,
  items,
  unitsForItem,
  errors,
  showCost,
  labelPrefix,
  onSelectItem,
  onSetLine,
  onAddLine,
  onRemoveLine,
}: PurchaseLinesEditorProps) {
  return (
    <div className="mt-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-separate border-spacing-y-2 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-2 font-medium">Item</th>
              <th className="px-2 font-medium">Unit</th>
              <th className="px-2 font-medium">Quantity</th>
              {showCost && <th className="px-2 font-medium">Unit cost (ETB)</th>}
              <th className="px-2 font-medium">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const itemUnits = unitsForItem(line.itemId)
              return (
                <tr key={line.key} className="align-top">
                  <td className="px-2">
                    <select
                      aria-label={`Item for ${labelPrefix} line ${index + 1}`}
                      value={line.itemId}
                      onChange={(event) => onSelectItem(index, event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Choose an item</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} — {item.name}
                        </option>
                      ))}
                    </select>
                    <FieldError message={errors[`line-${index}-item`]} />
                  </td>
                  <td className="px-2">
                    <select
                      aria-label={`Unit for ${labelPrefix} line ${index + 1}`}
                      value={line.unitId}
                      onChange={(event) => onSetLine(index, { unitId: event.target.value })}
                      disabled={!line.itemId}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50"
                    >
                      <option value="">Choose a unit</option>
                      {itemUnits.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.code} — {unit.name}
                        </option>
                      ))}
                    </select>
                    <FieldError message={errors[`line-${index}-unit`]} />
                  </td>
                  <td className="px-2">
                    <input
                      aria-label={`Quantity for ${labelPrefix} line ${index + 1}`}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(event) => onSetLine(index, { quantity: event.target.value })}
                      className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <FieldError message={errors[`line-${index}-quantity`]} />
                  </td>
                  {showCost && (
                    <td className="px-2">
                      <input
                        aria-label={`Unit cost for ${labelPrefix} line ${index + 1}`}
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={line.unitCost}
                        onChange={(event) => onSetLine(index, { unitCost: event.target.value })}
                        className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                      />
                      <FieldError message={errors[`line-${index}-cost`]} />
                    </td>
                  )}
                  <td className="px-2">
                    <button
                      type="button"
                      onClick={() => onRemoveLine(index)}
                      aria-label={`Remove ${labelPrefix} line ${index + 1}`}
                      className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-red-700"
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

      <FieldError message={errors.lines} />

      <button
        type="button"
        onClick={onAddLine}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-50"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Add line
      </button>
    </div>
  )
}
