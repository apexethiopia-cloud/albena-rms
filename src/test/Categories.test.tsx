import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { Inventory } from '@/pages/Inventory'

const api = vi.hoisted(() => ({
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
}))

vi.mock('@/features/categories/api', () => api)

vi.mock('@/features/items/api', () => ({
  listItems: vi.fn().mockResolvedValue([]),
  listUnits: vi.fn().mockResolvedValue([]),
  listCategories: vi.fn().mockResolvedValue([]),
  listItemUnitConversions: vi.fn().mockResolvedValue([]),
  createItem: vi.fn(),
  createItemUnitConversion: vi.fn(),
  updateItem: vi.fn(),
  updateItemUnitConversion: vi.fn(),
}))

vi.mock('@/features/locations/api', () => ({
  listLocations: vi.fn().mockResolvedValue([]),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))

vi.mock('@/features/stock/api', () => ({
  listStockBalances: vi.fn().mockResolvedValue([]),
  listStockMovements: vi.fn().mockResolvedValue([]),
  listSivs: vi.fn().mockResolvedValue([]),
  createSiv: vi.fn(),
  postSiv: vi.fn(),
}))

const CATEGORY = {
  id: 'c1',
  name: 'Meat',
  sort_order: 1,
  is_active: true,
  created_at: '2026-11-18T08:00:00.000Z',
  updated_at: '2026-11-18T08:00:00.000Z',
}

function authValue(roles: string[]): AuthContextValue {
  return {
    state: {
      status: 'signed-in',
      user: {
        id: 'u1',
        email: 'admin@example.com',
        fullName: 'Test Admin',
        status: 'active',
        roles,
      },
    },
    signIn: async () => ({ error: null }),
    signOut: async () => {},
  }
}

function renderPage(roles: string[] = ['system_admin']) {
  return render(
    <AuthContext.Provider value={authValue(roles)}>
      <Inventory />
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  api.listCategories.mockResolvedValue([CATEGORY])
  api.createCategory.mockResolvedValue(undefined)
  api.updateCategory.mockResolvedValue(undefined)
})

describe('Inventory — categories', () => {
  it('lists categories from the database', async () => {
    renderPage()

    expect(await screen.findByText('Meat')).toBeInTheDocument()
    expect(screen.getByText(/1 category · 1 active/i)).toBeInTheDocument()
  })

  it('shows an error with a retry action when loading fails', async () => {
    api.listCategories.mockRejectedValue(new Error('You do not have permission.'))

    renderPage()

    expect(await screen.findByText(/could not load categories/i)).toBeInTheDocument()
    expect(screen.getByText('You do not have permission.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('creates a category after client-side validation', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Meat')
    await user.click(screen.getByRole('button', { name: /new category/i }))
    await user.type(screen.getByLabelText('Name'), 'Dairy')
    const sortOrderInput = screen.getByLabelText('Sort order')
    await user.clear(sortOrderInput)
    await user.type(sortOrderInput, '2')
    await user.click(screen.getByRole('button', { name: /create category/i }))

    await waitFor(() => {
      expect(api.createCategory).toHaveBeenCalledWith({ name: 'Dairy', sortOrder: '2' })
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/Dairy created/i)
  })

  it('blocks submission when the form is invalid', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Meat')
    await user.click(screen.getByRole('button', { name: /new category/i }))
    await user.click(screen.getByRole('button', { name: /create category/i }))

    expect(await screen.findByText('Category name is required.')).toBeInTheDocument()
    expect(api.createCategory).not.toHaveBeenCalled()
  })

  it('edits an existing category', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Meat')
    await user.click(screen.getByRole('button', { name: /^edit$/i }))

    const name = screen.getByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Poultry')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(api.updateCategory).toHaveBeenCalledWith('c1', {
        name: 'Poultry',
        sortOrder: '1',
      })
    })
  })

  it('deactivates a category without deleting it', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Meat')
    await user.click(screen.getByRole('button', { name: /deactivate/i }))

    await waitFor(() => {
      expect(api.updateCategory).toHaveBeenCalledWith('c1', { is_active: false })
    })
    expect(await screen.findByRole('status')).toHaveTextContent(/deactivated/i)
  })

  it('allows the general manager to manage categories', async () => {
    renderPage(['general_manager'])

    await screen.findByText('Meat')

    expect(screen.getByRole('button', { name: /new category/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument()
  })

  it('hides write controls from a waiter', async () => {
    renderPage(['waiter'])

    await screen.findByText('Meat')

    expect(screen.queryByRole('button', { name: /new category/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull()
    expect(screen.getAllByText(/read-only/i).length).toBeGreaterThan(0)
  })
})
