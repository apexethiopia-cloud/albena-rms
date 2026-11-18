import { requireSupabase } from '@/lib/supabase'
import { describeSupplierDbError, type SupplierInput } from './validation'

export type Supplier = {
  id: string
  code: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  tax_number: string | null
  payment_terms: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const COLUMNS =
  'id, code, name, contact_name, phone, email, address, tax_number, payment_terms, is_active, created_at, updated_at'

function toRow(input: SupplierInput) {
  return {
    code: input.code,
    name: input.name,
    contact_name: input.contactName || null,
    phone: input.phone || null,
    email: input.email || null,
    address: input.address || null,
    tax_number: input.taxNumber || null,
    payment_terms: input.paymentTerms || null,
  }
}

export async function listSuppliers(): Promise<Supplier[]> {
  const { data, error } = await requireSupabase()
    .from('suppliers')
    .select(COLUMNS)
    .order('name', { ascending: true })

  if (error) throw new Error(describeSupplierDbError(error))
  return (data ?? []) as unknown as Supplier[]
}

export async function createSupplier(input: SupplierInput): Promise<void> {
  const { error } = await requireSupabase().from('suppliers').insert(toRow(input))

  if (error) throw new Error(describeSupplierDbError(error))
}

export async function updateSupplier(
  id: string,
  patch: Partial<SupplierInput> & { is_active?: boolean },
): Promise<void> {
  const row: Record<string, unknown> = {}

  if (patch.code !== undefined) row.code = patch.code
  if (patch.name !== undefined) row.name = patch.name
  if (patch.contactName !== undefined) row.contact_name = patch.contactName || null
  if (patch.phone !== undefined) row.phone = patch.phone || null
  if (patch.email !== undefined) row.email = patch.email || null
  if (patch.address !== undefined) row.address = patch.address || null
  if (patch.taxNumber !== undefined) row.tax_number = patch.taxNumber || null
  if (patch.paymentTerms !== undefined) row.payment_terms = patch.paymentTerms || null
  if (patch.is_active !== undefined) row.is_active = patch.is_active

  const { error } = await requireSupabase().from('suppliers').update(row).eq('id', id)

  if (error) throw new Error(describeSupplierDbError(error))
}
