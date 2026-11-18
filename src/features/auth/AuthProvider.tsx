import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
  type AuthUser,
  type SignInResult,
} from './auth-context'

type ProfileRow = {
  id: string
  full_name: string
  status: 'active' | 'disabled'
  user_roles: Array<{ roles: { code: string } | null }> | null
}

async function loadUser(userId: string, email: string): Promise<AuthUser | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, status, user_roles(roles(code))')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const row = data as unknown as ProfileRow
  return {
    id: row.id,
    email,
    fullName: row.full_name,
    status: row.status,
    roles: (row.user_roles ?? [])
      .map((entry) => entry.roles?.code)
      .filter((code): code is string => Boolean(code)),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    supabase ? { status: 'loading' } : { status: 'unconfigured' },
  )

  useEffect(() => {
    if (!supabase) return

    let active = true

    const applySession = async (session: Session | null) => {
      if (!active) return

      if (!session?.user) {
        setState({ status: 'signed-out' })
        return
      }

      try {
        const user = await loadUser(session.user.id, session.user.email ?? '')
        if (!active) return

        if (!user) {
          // Signed in to Auth but no profile row: the database will deny everything.
          setState({ status: 'signed-out' })
          return
        }

        if (user.status === 'disabled') {
          setState({ status: 'disabled', email: user.email })
          return
        }

        setState({ status: 'signed-in', user })
      } catch {
        if (active) setState({ status: 'signed-out' })
      }
    }

    void supabase.auth.getSession().then(({ data }) => applySession(data.session))

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const signIn = async (email: string, password: string): Promise<SignInResult> => {
      if (!supabase) return { error: 'Supabase is not configured.' }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      return { error: error ? error.message : null }
    }

    const signOut = async () => {
      if (supabase) await supabase.auth.signOut()
    }

    return { state, signIn, signOut }
  }, [state])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
