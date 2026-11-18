import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '@/App'

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App shell', () => {
  it('renders the dashboard with navigation', () => {
    renderApp()

    expect(screen.getByRole('heading', { name: /project dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /inventory/i })).toBeInTheDocument()
  })

  it('renders a placeholder page for a planned module', () => {
    renderApp('/inventory')

    expect(screen.getByRole('heading', { name: 'Inventory' })).toBeInTheDocument()
    expect(screen.getByText(/scheduled for phase/i)).toBeInTheDocument()
  })

  it('renders the not-found page for unknown routes', () => {
    renderApp('/does-not-exist')

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toBeInTheDocument()
  })
})
