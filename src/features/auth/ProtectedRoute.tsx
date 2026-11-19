import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AlertTriangle, Ban, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from './auth-context'

function FullPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-surface p-6 text-center shadow-sm">
        {children}
      </div>
    </div>
  )
}

export function ProtectedRoute() {
  const { state, signOut } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') {
    return (
      <FullPage>
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-600" aria-hidden="true" />
        <p className="mt-3 text-sm text-slate-600">Checking your session…</p>
      </FullPage>
    )
  }

  if (state.status === 'unconfigured') {
    return (
      <FullPage>
        <AlertTriangle className="mx-auto h-6 w-6 text-amber-500" aria-hidden="true" />
        <h1 className="mt-3 text-base font-semibold text-slate-900">Backend not configured</h1>
        <p className="mt-2 text-sm text-slate-600">
          Set <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code>.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Local: put them in <code className="rounded bg-slate-100 px-1">.env.local</code> and restart
          the dev server. Deployed: add them to the Cloudflare Pages environment variables and
          trigger a new build — Vite inlines these values at build time.
        </p>
      </FullPage>
    )
  }

  if (state.status === 'disabled') {
    return (
      <FullPage>
        <Ban className="mx-auto h-6 w-6 text-red-600" aria-hidden="true" />
        <h1 className="mt-3 text-base font-semibold text-slate-900">Account disabled</h1>
        <p className="mt-2 text-sm text-slate-600">
          {state.email} has been disabled. Contact a system administrator.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-obsidian hover:bg-brand-700"
        >
          Sign out
        </button>
      </FullPage>
    )
  }

  if (state.status === 'signed-out') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
