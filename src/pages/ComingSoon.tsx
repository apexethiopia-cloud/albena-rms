import { Construction } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'

export function ComingSoon({
  title,
  phase,
  description,
  planned,
}: {
  title: string
  phase: string
  description: string
  planned: readonly string[]
}) {
  return (
    <>
      <PageHeader title={title} description={description} />

      <div className="rounded-xl border border-slate-200 bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-2 text-brand-700">
          <Construction className="h-5 w-5" aria-hidden="true" />
          <span className="text-sm font-semibold">Scheduled for {phase}</span>
        </div>

        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          {planned.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true" className="text-slate-300">
                •
              </span>
              {item}
            </li>
          ))}
        </ul>

        <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
          This page exists so routing, layout and navigation are proven end to end. It contains no
          business logic yet.
        </p>
      </div>
    </>
  )
}
