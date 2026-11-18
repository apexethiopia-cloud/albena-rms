import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NetworkStatusBanner } from '@/components/NetworkStatusBanner'

describe('NetworkStatusBanner', () => {
  it('renders nothing while the browser is online', () => {
    render(<NetworkStatusBanner />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('warns that changes cannot be saved when the connection drops', () => {
    render(<NetworkStatusBanner />)

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/you are offline/i)
    expect(screen.getByRole('alert')).toHaveTextContent(/cannot be saved/i)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(screen.queryByRole('alert')).toBeNull()
  })
})
