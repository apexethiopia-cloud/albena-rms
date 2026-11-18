import { Boxes, ClipboardList } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { OutletsPanel } from '@/features/outlets/OutletsPanel'
import { UsersPanel } from '@/features/users/UsersPanel'
import { BusinessSettingsPanel } from '@/features/settings/BusinessSettingsPanel'

const PLANNED = [
  {
    icon: ClipboardList,
    title: 'Audit trail',
    detail:
      'Append-only log of every change. Readable by System Administrator, General Manager and Auditor roles.',
  },
  {
    icon: Boxes,
    title: 'Phase 4 inventory postings',
    detail:
      'GRN, SIV, adjustments, waste and production. Stock balances are derived from posted transactions only (ADR-007).',
  },
] as const

export function Settings() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Outlets, users, roles and system configuration. Access is enforced in PostgreSQL, not by this page."
      />

      <div className="space-y-6">
        <OutletsPanel />

        <BusinessSettingsPanel />

        <UsersPanel />

        <section aria-labelledby="planned-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="planned-heading" className="text-base font-semibold text-slate-900">
            Not implemented yet
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            These sections are listed so the current scope is unambiguous. None of them exist yet.
          </p>

          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {PLANNED.map(({ icon: Icon, title, detail }) => (
              <li key={title} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  {title}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{detail}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
