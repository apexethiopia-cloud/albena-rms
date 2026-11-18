import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { Kitchen } from '@/pages/Kitchen'

const recipesApi = vi.hoisted(() => ({
  listRecipes: vi.fn(),
  listRecipeCosts: vi.fn(),
  createRecipe: vi.fn(),
  createRecipeVersion: vi.fn(),
  updateRecipe: vi.fn(),
  publishRecipeVersion: vi.fn(),
}))

const productionApi = vi.hoisted(() => ({
  listProductionOrders: vi.fn(),
  createProductionOrder: vi.fn(),
  postProductionOrder: vi.fn(),
}))

const itemsApi = vi.hoisted(() => ({
  listItems: vi.fn(),
  listUnits: vi.fn(),
  listCategories: vi.fn(),
  listItemUnitConversions: vi.fn(),
  createItem: vi.fn(),
  createItemUnitConversion: vi.fn(),
  updateItem: vi.fn(),
  updateItemUnitConversion: vi.fn(),
}))

const locationsApi = vi.hoisted(() => ({
  listLocations: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
}))

vi.mock('@/features/recipes/api', () => recipesApi)
vi.mock('@/features/production/api', () => productionApi)
vi.mock('@/features/items/api', () => itemsApi)
vi.mock('@/features/locations/api', () => locationsApi)

const UNITS = [
  { id: 'u-g', code: 'g', name: 'Gram', dimension: 'mass', is_base: true, base_factor: 1 },
  {
    id: 'u-kg',
    code: 'kg',
    name: 'Kilogram',
    dimension: 'mass',
    is_base: false,
    base_factor: 1000,
  },
  {
    id: 'u-piece',
    code: 'piece',
    name: 'Piece',
    dimension: 'count',
    is_base: true,
    base_factor: 1,
  },
]

const ITEMS = [
  {
    id: 'i-tomato',
    code: 'TOMATO',
    name: 'Tomato, fresh',
    category_id: null,
    base_unit_id: 'u-g',
    purchase_unit_id: null,
    reorder_level: 5000,
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
  },
  {
    id: 'i-omelette',
    code: 'OMELETTE',
    name: 'Cheese omelette',
    category_id: null,
    base_unit_id: 'u-piece',
    purchase_unit_id: null,
    reorder_level: 0,
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
  },
]

const LOCATIONS = [
  {
    id: 'l-main',
    code: 'MAIN_STORE',
    name: 'Main Store',
    is_active: true,
    created_at: '2026-11-18T08:00:00.000Z',
    updated_at: '2026-11-18T08:00:00.000Z',
  },
]

const RECIPE = {
  id: 'r-omelette',
  code: 'OML-01',
  name: 'Cheese omelette',
  menu_item_name: 'Cheese omelette',
  notes: null,
  created_at: '2026-11-18T08:00:00.000Z',
  updated_at: '2026-11-18T08:00:00.000Z',
  recipe_versions: [
    {
      id: 'v-2',
      recipe_id: 'r-omelette',
      version_number: 2,
      status: 'draft' as const,
      yield_quantity: 1,
      selling_price: 200,
      notes: 'More cheese',
      effective_from: null,
      created_at: '2026-11-18T09:00:00.000Z',
      published_at: null,
      recipe_version_lines: [
        {
          id: 'rl-2',
          version_id: 'v-2',
          item_id: 'i-tomato',
          unit_id: 'u-g',
          quantity: 250,
          base_quantity: 250,
          sort_order: 0,
        },
      ],
    },
    {
      id: 'v-1',
      recipe_id: 'r-omelette',
      version_number: 1,
      status: 'published' as const,
      yield_quantity: 1,
      selling_price: 180,
      notes: null,
      effective_from: '2026-11-17',
      created_at: '2026-11-17T09:00:00.000Z',
      published_at: '2026-11-17T10:00:00.000Z',
      recipe_version_lines: [
        {
          id: 'rl-1',
          version_id: 'v-1',
          item_id: 'i-tomato',
          unit_id: 'u-g',
          quantity: 200,
          base_quantity: 200,
          sort_order: 0,
        },
      ],
    },
  ],
}

const COSTS = [
  {
    version_id: 'v-2',
    recipe_id: 'r-omelette',
    recipe_code: 'OML-01',
    recipe_name: 'Cheese omelette',
    menu_item_name: 'Cheese omelette',
    version_number: 2,
    status: 'draft' as const,
    yield_quantity: 1,
    selling_price: 200,
    effective_from: null,
    total_cost: 55.4,
    cost_per_portion: 55.4,
    gross_profit: 144.6,
    food_cost_pct: 27.7,
    lines_without_cost: 0,
  },
  {
    version_id: 'v-1',
    recipe_id: 'r-omelette',
    recipe_code: 'OML-01',
    recipe_name: 'Cheese omelette',
    menu_item_name: 'Cheese omelette',
    version_number: 1,
    status: 'published' as const,
    yield_quantity: 1,
    selling_price: 180,
    effective_from: '2026-11-17',
    total_cost: 60,
    cost_per_portion: 60,
    gross_profit: 120,
    food_cost_pct: 33.33,
    lines_without_cost: 0,
  },
]

const DRAFT_ORDER = {
  id: 'p-1',
  order_number: 'PROD-0001',
  production_date: '2026-11-18',
  location_id: 'l-main',
  output_item_id: 'i-omelette',
  output_unit_id: 'u-piece',
  output_quantity: 12,
  output_base_quantity: 12,
  expected_output_quantity: 12,
  yield_percentage: 100,
  responsible_name: 'Chef Selam',
  notes: null,
  status: 'draft' as const,
  created_by: 'u1',
  created_at: '2026-11-18T09:00:00.000Z',
  posted_by: null,
  posted_at: null,
  production_inputs: [
    {
      id: 'pi-1',
      production_id: 'p-1',
      item_id: 'i-tomato',
      unit_id: 'u-g',
      quantity: 1000,
      base_quantity: 1000,
      posted_cost: null,
      created_at: '2026-11-18T09:00:00.000Z',
    },
  ],
}

const POSTED_ORDER = {
  ...DRAFT_ORDER,
  id: 'p-2',
  order_number: 'PROD-0000',
  status: 'posted' as const,
  posted_by: 'u1',
  posted_at: '2026-11-18T10:00:00.000Z',
  production_inputs: [
    {
      ...DRAFT_ORDER.production_inputs[0],
      id: 'pi-2',
      production_id: 'p-2',
      posted_cost: 25,
    },
  ],
}

function authValue(roles: string[]): AuthContextValue {
  return {
    state: {
      status: 'signed-in',
      user: {
        id: 'u1',
        email: 'chef@example.com',
        fullName: 'Test Chef',
        status: 'active',
        roles,
      },
    },
    signIn: async () => ({ error: null }),
    signOut: async () => {},
  }
}

function renderPage(roles: string[] = ['executive_chef']) {
  return render(
    <AuthContext.Provider value={authValue(roles)}>
      <Kitchen />
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()

  recipesApi.listRecipes.mockResolvedValue([RECIPE])
  recipesApi.listRecipeCosts.mockResolvedValue(COSTS)
  recipesApi.createRecipe.mockResolvedValue('r-new')
  recipesApi.createRecipeVersion.mockResolvedValue('v-new')
  recipesApi.updateRecipe.mockResolvedValue(undefined)
  recipesApi.publishRecipeVersion.mockResolvedValue(undefined)

  productionApi.listProductionOrders.mockResolvedValue([DRAFT_ORDER, POSTED_ORDER])
  productionApi.createProductionOrder.mockResolvedValue('p-new')
  productionApi.postProductionOrder.mockResolvedValue(undefined)

  itemsApi.listItems.mockResolvedValue(ITEMS)
  itemsApi.listUnits.mockResolvedValue(UNITS)
  itemsApi.listCategories.mockResolvedValue([])
  itemsApi.listItemUnitConversions.mockResolvedValue([])

  locationsApi.listLocations.mockResolvedValue(LOCATIONS)
})

describe('Kitchen — recipes and costing', () => {
  it('shows recipe versions with cost, gross profit and food cost percentage', async () => {
    renderPage()

    const section = await screen.findByRole('region', { name: /^recipes$/i })

    expect(await within(section).findByText('Cheese omelette')).toBeInTheDocument()
    expect(within(section).getByText('OML-01 · Cheese omelette')).toBeInTheDocument()
    expect(within(section).getByText('v2')).toBeInTheDocument()
    expect(within(section).getByText('v1')).toBeInTheDocument()
    expect(within(section).getByText(/33\.33%/)).toBeInTheDocument()
    expect(within(section).getByText(/144\.60/)).toBeInTheDocument()
  })

  it('creates a recipe draft with an ingredient line', async () => {
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /^recipes$/i })
    await user.click(within(section).getByRole('button', { name: /new recipe/i }))

    await user.type(within(section).getByLabelText(/recipe code/i), 'om-01')
    await user.type(within(section).getByLabelText(/recipe name/i), 'Cheese omelette')
    await user.type(within(section).getByLabelText(/selling price/i), '180')
    await user.selectOptions(
      within(section).getByLabelText(/ingredient for recipe line 1/i),
      'i-tomato',
    )
    await user.selectOptions(within(section).getByLabelText(/unit for recipe line 1/i), 'u-g')
    await user.type(within(section).getByLabelText(/quantity for recipe line 1/i), '200')

    await user.click(within(section).getByRole('button', { name: /save draft/i }))

    await waitFor(() =>
      expect(recipesApi.createRecipe).toHaveBeenCalledWith({
        code: 'OM-01',
        name: 'Cheese omelette',
        menuItemName: null,
        notes: null,
        yieldQuantity: 1,
        sellingPrice: 180,
        lines: [{ itemId: 'i-tomato', unitId: 'u-g', quantity: 200 }],
      }),
    )
    expect(await within(section).findByText(/saved as a draft version/i)).toBeInTheDocument()
  })

  it('publishes a draft version and archives the previous one in the database', async () => {
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /^recipes$/i })
    const draftRow = (await within(section).findByText('v2')).closest('tr')
    expect(draftRow).not.toBeNull()

    await user.click(within(draftRow as HTMLElement).getByRole('button', { name: /publish/i }))

    await waitFor(() => expect(recipesApi.publishRecipeVersion).toHaveBeenCalledWith('v-2'))
    expect(await within(section).findByText(/version 2 is now published/i)).toBeInTheDocument()
  })

  it('is read-only for roles without recipe permission', async () => {
    renderPage(['storekeeper'])

    const section = await screen.findByRole('region', { name: /^recipes$/i })

    expect(within(section).queryByRole('button', { name: /new recipe/i })).not.toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: /publish/i })).not.toBeInTheDocument()
    expect(within(section).getByText(/read-only: recipes and versions/i)).toBeInTheDocument()
  })
})

describe('Kitchen — production', () => {
  it('creates a production draft with inputs and optional expected output', async () => {
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /^production$/i })
    await user.click(within(section).getByRole('button', { name: /new production/i }))

    await user.type(within(section).getByLabelText(/production number/i), 'prod-0002')
    await user.selectOptions(within(section).getByLabelText(/output item/i), 'i-omelette')
    await user.type(within(section).getByLabelText(/output quantity/i), '12')
    await user.selectOptions(within(section).getByLabelText(/output unit/i), 'u-piece')
    await user.selectOptions(within(section).getByLabelText(/input item 1/i), 'i-tomato')
    await user.selectOptions(within(section).getByLabelText(/unit for input 1/i), 'u-g')
    await user.type(within(section).getByLabelText(/quantity for input 1/i), '1000')

    await user.click(within(section).getByRole('button', { name: /save draft/i }))

    await waitFor(() =>
      expect(productionApi.createProductionOrder).toHaveBeenCalledWith({
        orderNumber: 'PROD-0002',
        productionDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        locationId: 'l-main',
        outputItemId: 'i-omelette',
        outputUnitId: 'u-piece',
        outputQuantity: 12,
        expectedOutputQuantity: null,
        responsibleName: 'Test Chef',
        notes: null,
        inputs: [{ itemId: 'i-tomato', unitId: 'u-g', quantity: 1000 }],
      }),
    )
    expect(await within(section).findByText(/saved as a draft/i)).toBeInTheDocument()
  })

  it('posts a draft after confirmation and shows the computed yield', async () => {
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /^production$/i })

    expect(await within(section).findByText('PROD-0001')).toBeInTheDocument()

    const draftRow = within(section).getByText('PROD-0001').closest('tr')
    expect(draftRow).not.toBeNull()
    expect(within(draftRow as HTMLElement).getByText(/100%/)).toBeInTheDocument()

    await user.click(within(draftRow as HTMLElement).getByRole('button', { name: /^post$/i }))
    await user.click(within(draftRow as HTMLElement).getByRole('button', { name: /confirm post/i }))

    await waitFor(() => expect(productionApi.postProductionOrder).toHaveBeenCalledWith('p-1'))
    expect(await within(section).findByText(/posted to the stock ledger/i)).toBeInTheDocument()
  })

  it('hides the posted order action and marks posted rows read-only', async () => {
    const user = userEvent.setup()
    renderPage()

    const section = await screen.findByRole('region', { name: /^production$/i })
    const postedRow = (await within(section).findByText('PROD-0000')).closest('tr')
    expect(postedRow).not.toBeNull()

    expect(within(postedRow as HTMLElement).getByText('Posted')).toBeInTheDocument()
    expect(
      within(postedRow as HTMLElement).queryByRole('button', { name: /^post$/i }),
    ).not.toBeInTheDocument()

    const toggle = within(section).getByRole('button', { name: /^post$/i })
    await user.click(toggle)
    expect(within(section).getByRole('button', { name: /confirm post/i })).toBeInTheDocument()
  })

  it('is read-only for roles without production permission', async () => {
    renderPage(['storekeeper'])

    const section = await screen.findByRole('region', { name: /^production$/i })

    expect(
      within(section).queryByRole('button', { name: /new production/i }),
    ).not.toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: /^post$/i })).not.toBeInTheDocument()
    expect(within(section).getByText(/read-only: production is recorded/i)).toBeInTheDocument()
  })
})
