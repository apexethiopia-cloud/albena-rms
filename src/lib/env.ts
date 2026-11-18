const raw = import.meta.env

function clean(value: string | undefined, fallback = ''): string {
  const trimmed = (value ?? '').trim()
  return trimmed.length > 0 ? trimmed : fallback
}

/** Markers that indicate .env.example placeholders were copied without real values. */
const PLACEHOLDER_MARKERS = ['your-project-id', 'your-anon-key']

export const env = {
  appName: clean(raw.VITE_APP_NAME, 'Albena RMS'),
  appEnv: clean(raw.VITE_APP_ENV, raw.MODE ?? 'development'),
  /** Business timezone (OD-01): Africa/Addis_Ababa, UTC+3. */
  timezone: clean(raw.VITE_APP_TIMEZONE, 'Africa/Addis_Ababa'),
  supabaseUrl: clean(raw.VITE_SUPABASE_URL),
  supabaseAnonKey: clean(raw.VITE_SUPABASE_ANON_KEY),
} as const

/**
 * True only when real Supabase credentials are present.
 * Phase 1 deliberately boots without them; Phase 2 requires them.
 */
export const isSupabaseConfigured: boolean =
  env.supabaseUrl.length > 0 &&
  env.supabaseAnonKey.length > 0 &&
  !PLACEHOLDER_MARKERS.some(
    (marker) => env.supabaseUrl.includes(marker) || env.supabaseAnonKey.includes(marker),
  )

/** Business currency (OD-11): Ethiopian Birr, 2 decimal places. */
export const CURRENCY = 'ETB' as const
