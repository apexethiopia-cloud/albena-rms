import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function ReportSection({
  id,
  title,
  description,
  icon: Icon,
  actions,
  footnote,
  children,
}: {
  id: string
  title: string
  description: string
  icon: LucideIcon
  actions?: ReactNode
  footnote?: string
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Icon className="h-4 w-4 text-brand-600" aria-hidden="true" />
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
        </div>
        {actions}
      </div>

      <div className="mt-4">{children}</div>

      {footnote && <p className="mt-4 text-xs text-slate-500">{footnote}</p>}
    </section>
  )
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
      {children}
    </p>
  )
}

export function ReportTable({
  headers,
  children,
  caption,
}: {
  headers: string[]
  children: ReactNode
  caption?: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
            {headers.map((header) => (
              <th key={header} scope="col" className="px-2 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  )
}
