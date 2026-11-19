import { useEffect, useState } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'

/**
 * ARC-07 / AC-15: never let a failed connection look like a saved change.
 * The banner is intentionally global and non-dismissible while offline.
 */
export function NetworkStatusBanner() {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-red-600 px-4 py-2 text-sm text-obsidian shadow-lg"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="font-semibold">You are offline.</span>
      <span className="text-red-50">
        Changes cannot be saved until the connection is restored.
      </span>
      <button
        type="button"
        onClick={() => setOnline(navigator.onLine)}
        className="ml-1 inline-flex items-center gap-1.5 rounded-md bg-white/15 px-2 py-1 text-xs font-semibold text-white transition hover:bg-white/25"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Retry
      </button>
    </div>
  )
}
