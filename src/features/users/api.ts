import { requireSupabase } from '@/lib/supabase'
import { describeUserDbError, type RoleRef, type UserStatus } from './validation'

export type Role = RoleRef & {
  id: string
  description: string | null
}

export type UserRow = {
  id: string
  full_name: string
  status: UserStatus
  created_at: string
  updated_at: string
  roles: RoleRef[]
}

export type OutletScope = {
  outlet_id: string
  code: string
  name: string
  is_active: boolean
}

const PROFILE_COLUMNS = 'id, full_name, status, created_at, updated_at'

type ProfileRecord = {
  id: string
  full_name: string
  status: UserStatus
  created_at: string
  updated_at: string
}

type AssignmentRecord = {
  user_id: string
  roles: RoleRef | null
}

type ScopeRecord = {
  outlet_id: string
  outlets: { code: string; name: string; is_active: boolean } | null
}

export async function listRoles(): Promise<Role[]> {
  const { data, error } = await requireSupabase()
    .from('roles')
    .select('id, code, name, description')
    .order('code', { ascending: true })

  if (error) throw new Error(describeUserDbError(error))
  return (data ?? []) as unknown as Role[]
}

export async function listUsers(): Promise<UserRow[]> {
  const client = requireSupabase()

  const { data, error } = await client
    .from('user_profiles')
    .select(PROFILE_COLUMNS)
    .order('created_at', { ascending: true })

  if (error) throw new Error(describeUserDbError(error))

  const profiles = (data ?? []) as unknown as ProfileRecord[]
  if (profiles.length === 0) return []

  const { data: assignments, error: assignmentError } = await client
    .from('user_roles')
    .select('user_id, roles(code, name)')
    .in(
      'user_id',
      profiles.map((profile) => profile.id),
    )

  if (assignmentError) throw new Error(describeUserDbError(assignmentError))

  const rolesByUser = new Map<string, RoleRef[]>()
  for (const row of (assignments ?? []) as unknown as AssignmentRecord[]) {
    if (!row.roles) continue
    const list = rolesByUser.get(row.user_id) ?? []
    list.push({ code: row.roles.code, name: row.roles.name })
    rolesByUser.set(row.user_id, list)
  }

  return profiles.map((profile) => ({
    ...profile,
    roles: (rolesByUser.get(profile.id) ?? []).sort((a, b) => a.code.localeCompare(b.code)),
  }))
}

export async function setUserStatus(userId: string, status: UserStatus): Promise<void> {
  const { error } = await requireSupabase().rpc('admin_set_user_status', {
    p_user_id: userId,
    p_status: status,
  })

  if (error) throw new Error(describeUserDbError(error))
}

export async function assignUserRole(userId: string, roleCode: string): Promise<void> {
  const { error } = await requireSupabase().rpc('admin_assign_role', {
    p_user_id: userId,
    p_role_code: roleCode,
  })

  if (error) throw new Error(describeUserDbError(error))
}

export async function listOutletScopes(userId: string): Promise<OutletScope[]> {
  const { data, error } = await requireSupabase()
    .from('user_outlet_scopes')
    .select('outlet_id, outlets(code, name, is_active)')
    .eq('user_id', userId)

  if (error) throw new Error(describeUserDbError(error))

  return ((data ?? []) as unknown as ScopeRecord[])
    .filter(
      (row): row is ScopeRecord & { outlets: NonNullable<ScopeRecord['outlets']> } =>
        row.outlets !== null,
    )
    .map((row) => ({
      outlet_id: row.outlet_id,
      code: row.outlets.code,
      name: row.outlets.name,
      is_active: row.outlets.is_active,
    }))
    .sort((a, b) => a.code.localeCompare(b.code))
}

export async function grantOutletScope(
  userId: string,
  outletId: string,
  grantedBy: string | null,
): Promise<void> {
  const { error } = await requireSupabase()
    .from('user_outlet_scopes')
    .insert({ user_id: userId, outlet_id: outletId, granted_by: grantedBy })

  if (error) throw new Error(describeUserDbError(error))
}

export async function revokeOutletScope(userId: string, outletId: string): Promise<void> {
  const { error } = await requireSupabase()
    .from('user_outlet_scopes')
    .delete()
    .eq('user_id', userId)
    .eq('outlet_id', outletId)

  if (error) throw new Error(describeUserDbError(error))
}
