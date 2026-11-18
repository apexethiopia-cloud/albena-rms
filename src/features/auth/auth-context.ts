import { createContext, useContext } from 'react'

export type AuthUser = {
  id: string
  email: string
  fullName: string
  status: 'active' | 'disabled'
  roles: string[]
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'unconfigured' }
  | { status: 'signed-out' }
  | { status: 'disabled'; email: string }
  | { status: 'signed-in'; user: AuthUser }

export type SignInResult = { error: string | null }

export type AuthContextValue = {
  state: AuthState
  signIn: (email: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return value
}

export function hasRole(roles: readonly string[], code: string): boolean {
  return roles.includes(code)
}
