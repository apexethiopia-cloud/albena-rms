import { CheckCircle2, Circle, Database, Globe2, UserRound, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { cn } from '@/lib/cn'
import { CURRENCY, env, isSupabaseConfigured } from '@/lib/env'
import { formatDateTime } from '@/lib/format'
import { useAuth } from '@/features/auth/auth-context'

const FOUNDATION_CHECKLIST = [
  { label: 'Vite + React + TypeScript shell', done: true },
  { label: 'Tailwind CSS design tokens', done: true },
  { label: 'Client-side routing and app layout', done: true },
  { label: 'Offline / network-error banner (ARC-07)', done: true },
  { label: 'Vitest + Testing Library', done: true },
  { label: 'CI pipeline: typecheck, lint, test, build', done: true },
  { label: 'Cloudflare Pages deployment (live)', done: true },
  { label: 'Supabase project provisioned', done: true },
  { label: 'Phase 2 migrations and RLS applied', done: true },
  { label: 'Administrator login and role assignment', done: true },
  { label: 'Outlet management screen', done: true },
  { label: 'Supplier management screen', done: true },
  { label: 'Item master screen', done: true },
  { label: 'Master-data migrations applied (0003/0004)', done: true },
  { label: 'Three test users authenticated (AC-01)', done: false },
] as const

const NEXT_UP = [
  'Create the remaining test accounts (AC-01)',
  'Prove unauthorized access fails (AC-02)',
  'Add item unit conversions and stock locations',
  'Start the Phase 4 stock ledger',
] as const

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Globe2
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export function Dashboard() {
  const { state } = useAuth()
  const user = state.status === 'signed-in' ? state.user : null
  const doneCount = FOUNDATION_CHECKLIST.filter((item) => item.done).length

  return (
    <>
      <PageHeader
        title="Project dashboard"
        description={`Phase 3 — Master data. Server time: ${formatDateTime(new Date())}.`}
      />

      {user && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <UserRound className="h-4 w-4" aria-hidden="true" />
          <span className="font-semibold">{user.fullName}</span>
          <span className="text-brand-700">{user.email}</span>
          {user.roles.slice(0, 3).map((role) => (
            <span
              key={role}
              className="rounded-full bg-white px-2 py-0.5 text-xs font-medium capitalize text-brand-700"
            >
              {role.replace(/_/g, ' ')}
            </span>
          ))}
          {user.roles.length > 3 && (
            <span className="text-xs text-brand-700">+{user.roles.length - 3} more</span>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={Globe2}
          label="Business timezone"
          value={env.timezone}
          hint="OD-01 · UTC+3 · used for reports and daily closing"
        />
        <StatCard
          icon={Wallet}
          label="Currency"
          value={`${CURRENCY} · 2 decimals`}
          hint="OD-11 · stored as numeric(14,2), never floats"
        />
        <StatCard
          icon={Database}
          label="Database"
          value={isSupabaseConfigured ? 'Configured' : 'Not configured'}
          hint={
            isSupabaseConfigured
              ? 'Supabase credentials detected'
              : 'Add values to .env.local to enable Phase 2'
          }
        />
      </div>

      {!isSupabaseConfigured && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Supabase is not configured yet.</p>
          <p className="mt-1 text-amber-800">
            Copy <code className="rounded bg-amber-100 px-1">.env.example</code> to{' '}
            <code className="rounded bg-amber-100 px-1">.env.local</code> and fill in the project
            URL and anon key. The Phase 1 shell runs without them; Phase 2 does not.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Foundation checklist</h3>
            <span className="text-xs text-slate-500">
              {doneCount}/{FOUNDATION_CHECKLIST.length} complete
            </span>
          </div>

          <ul className="mt-4 space-y-2.5">
            {FOUNDATION_CHECKLIST.map((item) => (
              <li key={item.label} className="flex items-start gap-2.5 text-sm">
                {item.done ? (
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                )}
                <span className={cn(item.done ? 'text-slate-700' : 'text-slate-500')}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900">Next up</h3>
          <ol className="mt-4 space-y-3">
            {NEXT_UP.map((item, index) => (
              <li key={item} className="flex gap-3 text-sm text-slate-600">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Business rules in force: inventory derives from posted stock transactions only (ADR-007);
        menu sales never auto-deduct stock (ADR-008); all permissions are enforced in PostgreSQL
        RLS, not in this UI (ADR-003).
      </p>
    </>
  )
}
