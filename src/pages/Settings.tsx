import { Boxes, ClipboardList, MapPin, Package, Users } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { OutletsPanel } from '@/features/outlets/OutletsPanel'

const PLANNED = [
  {
    icon: Users,
    title: 'Users, roles and outlet scopes',
    detail:
      'List staff profiles, disable or reactivate accounts, assign roles and grant outlet access. Accounts themselves are created by an administrator in Supabase Auth — the browser holds only the publishable key, so it cannot create users.',
  },
  {
    icon: MapPin,
    title: 'Stock locations',
    detail:
      'Main store, kitchen store, bar store and coffee store. These become the locations in the stock ledger.',
  },
  {
    icon: Package,
    title: 'Item unit conversions',
    detail:
      'Per-item factors for box, carton and sack, which have no universal size (ADR-010). Items can be created now; these factors must be entered before such a purchase unit can be received.',
  },
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
        description="Outlets, master data and system configuration. Access is enforced in PostgreSQL, not by this page."
      />

      <div className="space-y-6">
        <OutletsPanel />

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
