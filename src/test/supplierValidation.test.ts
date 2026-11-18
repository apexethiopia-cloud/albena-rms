import { describe, expect, it } from 'vitest'
import {
  describeSupplierDbError,
  validateSupplier,
  type SupplierInput,
} from '@/features/suppliers/validation'

const VALID: SupplierInput = {
  code: 'fresh-foods',
  name: '  Fresh Foods PLC ',
  contactName: ' Hanna ',
  phone: '+251 911 234 567',
  email: 'ORDERS@FreshFoods.ET',
  address: ' Bole Road, Addis Ababa ',
  taxNumber: ' TIN-001 ',
  paymentTerms: ' 30 days ',
}

describe('validateSupplier', () => {
  it('accepts a complete supplier and normalizes values', () => {
    const result = validateSupplier(VALID)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual({})
    expect(result.normalized).toEqual({
      code: 'FRESH-FOODS',
      name: 'Fresh Foods PLC',
      contactName: 'Hanna',
      phone: '+251 911 234 567',
      email: 'orders@freshfoods.et',
      address: 'Bole Road, Addis Ababa',
      taxNumber: 'TIN-001',
      paymentTerms: '30 days',
    })
  })

  it('accepts a supplier with only the required fields', () => {
    const result = validateSupplier({
      ...VALID,
      contactName: '',
      phone: '',
      email: '',
      address: '',
      taxNumber: '',
      paymentTerms: '',
    })

    expect(result.valid).toBe(true)
  })

  it('requires a code and a name', () => {
    const result = validateSupplier({ ...VALID, code: '  ', name: '  ' })

    expect(result.errors.code).toMatch(/required/i)
    expect(result.errors.name).toMatch(/required/i)
  })

  it('rejects an invalid code and an over-long name', () => {
    expect(validateSupplier({ ...VALID, code: 'A' }).errors.code).toBeDefined()
    expect(validateSupplier({ ...VALID, name: 'x'.repeat(121) }).errors.name).toMatch(/120/)
  })

  it('rejects a malformed email but allows a blank one', () => {
    expect(validateSupplier({ ...VALID, email: 'not-an-email' }).errors.email).toBeDefined()
    expect(validateSupplier({ ...VALID, email: '' }).valid).toBe(true)
  })

  it('rejects a phone with letters but allows spaces, dashes and brackets', () => {
    expect(validateSupplier({ ...VALID, phone: 'call me' }).errors.phone).toBeDefined()
    expect(validateSupplier({ ...VALID, phone: '(022) 123-4567' }).valid).toBe(true)
  })

  it('limits the optional free-text fields', () => {
    expect(validateSupplier({ ...VALID, address: 'x'.repeat(201) }).errors.address).toBeDefined()
    expect(validateSupplier({ ...VALID, paymentTerms: 'x'.repeat(61) }).errors.paymentTerms).toBeDefined()
    expect(validateSupplier({ ...VALID, taxNumber: 'x'.repeat(41) }).errors.taxNumber).toBeDefined()
    expect(validateSupplier({ ...VALID, contactName: 'x'.repeat(81) }).errors.contactName).toBeDefined()
  })
})

describe('describeSupplierDbError', () => {
  it('names suppliers in the permission message', () => {
    expect(describeSupplierDbError({ code: '42501', message: 'denied' })).toMatch(/suppliers/i)
  })

  it('explains a missing table as a pending migration', () => {
    expect(describeSupplierDbError({ code: 'PGRST205', message: 'not found' })).toMatch(
      /pending supabase migration/i,
    )
  })

  it('falls back to the database message', () => {
    expect(describeSupplierDbError({ code: 'XX000', message: 'unexpected' })).toBe('unexpected')
  })
})
