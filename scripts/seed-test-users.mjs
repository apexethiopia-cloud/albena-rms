#!/usr/bin/env node
/**
 * Creates the three test users required by AC-01 / OD-03 and grants them access.
 *
 * LOCAL USE ONLY. Requires SUPABASE_SERVICE_ROLE_KEY, which must never be
 * exposed to the browser or committed. Put it in .env.local (gitignored).
 *
 *   node scripts/seed-test-users.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (!match) continue
      const [, key, value] = match
      if (!process.env[key]) {
        process.env[key] = value.replace(/^['"]|['"]$/g, '').trim()
      }
    }
  } catch {
    // .env.local is optional when the variables are already exported.
  }
}

loadEnvLocal()

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error(
    'Missing configuration.\n' +
      'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.\n' +
      'The service role key is server-side only — never commit it or expose it to the browser.',
  )
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})

const ALL_ROLES_FALLBACK = [
  'system_admin',
  'general_manager',
  'restaurant_manager',
  'purchasing_officer',
  'storekeeper',
  'executive_chef',
  'kitchen_staff',
  'waiter',
  'cashier',
  'auditor',
]

function readTestUsers() {
  const users = []
  for (let index = 1; index <= 3; index += 1) {
    const email = process.env[`TEST_USER_${index}_EMAIL`]
    const password = process.env[`TEST_USER_${index}_PASSWORD`]
    if (!email || !password) continue
    users.push({
      email,
      password,
      fullName: process.env[`TEST_USER_${index}_NAME`] ?? email.split('@')[0],
      roles: (process.env[`TEST_USER_${index}_ROLES`] ?? ALL_ROLES_FALLBACK.join(','))
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean),
      allOutlets: process.env[`TEST_USER_${index}_ALL_OUTLETS`] !== 'false',
    })
  }
  return users
}

async function findUserByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null
}

async function main() {
  const testUsers = readTestUsers()
  if (testUsers.length === 0) {
    console.error(
      'No test users configured.\n' +
        'Set TEST_USER_1_EMAIL / TEST_USER_1_PASSWORD (and optionally _2, _3) in .env.local.',
    )
    process.exit(1)
  }

  const { data: roleRows, error: roleError } = await admin.from('roles').select('id, code')
  if (roleError) throw roleError
  const roleIdByCode = new Map(roleRows.map((row) => [row.code, row.id]))

  const { data: outletRows, error: outletError } = await admin.from('outlets').select('id, code')
  if (outletError) throw outletError

  for (const testUser of testUsers) {
    let user = await findUserByEmail(testUser.email)

    if (user) {
      console.log(`• ${testUser.email} already exists (${user.id})`)
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: testUser.email,
        password: testUser.password,
        email_confirm: true,
        user_metadata: { full_name: testUser.fullName },
      })
      if (error) throw error
      user = data.user
      console.log(`• ${testUser.email} created (${user.id})`)
    }

    const { error: profileError } = await admin.from('user_profiles').upsert(
      { id: user.id, full_name: testUser.fullName, status: 'active' },
      { onConflict: 'id' },
    )
    if (profileError) throw profileError

    const roleIds = testUser.roles.map((code) => {
      const id = roleIdByCode.get(code)
      if (!id) throw new Error(`Unknown role "${code}" — apply the reference-data migration first`)
      return id
    })

    if (roleIds.length > 0) {
      const { error } = await admin.from('user_roles').upsert(
        roleIds.map((roleId) => ({ user_id: user.id, role_id: roleId })),
        { onConflict: 'user_id,role_id' },
      )
      if (error) throw error
    }

    if (testUser.allOutlets && outletRows.length > 0) {
      const { error } = await admin.from('user_outlet_scopes').upsert(
        outletRows.map((outlet) => ({ user_id: user.id, outlet_id: outlet.id })),
        { onConflict: 'user_id,outlet_id' },
      )
      if (error) throw error
    }

    console.log(
      `  roles: ${testUser.roles.join(', ') || 'none'} | outlets: ${
        testUser.allOutlets ? outletRows.length : 0
      }`,
    )
  }

  console.log('\nDone. Sign in at /login with the configured email and password.')
}

main().catch((error) => {
  console.error('\nSeed failed:', error.message ?? error)
  process.exit(1)
})
