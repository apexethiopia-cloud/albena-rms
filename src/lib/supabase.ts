import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, isSupabaseConfigured } from './env'

/**
 * ARC-03 / ARC-04: the browser only ever receives the publishable (anon) key.
 * RLS in PostgreSQL is the authorization boundary; this client is not trusted.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.',
    )
  }
  return supabase
}
