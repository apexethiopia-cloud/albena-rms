import { requireSupabase } from '@/lib/supabase'
import {
  describeBusinessSettingsDbError,
  type NormalizedBusinessSettings,
} from './validation'

export type Numberish = number | string

export type BusinessSettings = {
  id: boolean
  business_name: string
  tin: string | null
  address: string | null
  phone: string | null
  vat_rate: Numberish
  receipt_footer: string | null
  updated_at: string
}

const BUSINESS_SETTINGS_COLUMNS =
  'id, business_name, tin, address, phone, vat_rate, receipt_footer, updated_at'

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const { data, error } = await requireSupabase()
    .from('business_settings')
    .select(BUSINESS_SETTINGS_COLUMNS)
    .eq('id', true)
    .single()

  if (error) throw new Error(describeBusinessSettingsDbError(error))
  return data as unknown as BusinessSettings
}

export async function updateBusinessSettings(
  input: NormalizedBusinessSettings,
): Promise<void> {
  const { error } = await requireSupabase()
    .from('business_settings')
    .update({
      business_name: input.businessName,
      tin: input.tin,
      address: input.address,
      phone: input.phone,
      vat_rate: input.vatRate,
      receipt_footer: input.receiptFooter,
    })
    .eq('id', true)

  if (error) throw new Error(describeBusinessSettingsDbError(error))
}
