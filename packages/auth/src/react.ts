import { createContext, createElement, useContext, useState, useSyncExternalStore, type ReactNode } from 'react'

import type { AuthFacade } from './auth-adapter.ts'
import { initialSessionSnapshot, type SessionSnapshot } from './session.ts'

export const AuthContext = createContext<AuthFacade | null>(null)

export interface AuthProviderProps {
  children?: ReactNode
  facade?: AuthFacade
  createFacade?: () => AuthFacade
}

export function AuthProvider({ children, facade, createFacade }: AuthProviderProps) {
  const [ownedFacade] = useState<AuthFacade | null>(() => (facade ? null : (createFacade?.() ?? null)))
  const value = facade ?? ownedFacade
  if (!value) throw new Error('AuthProvider requires either facade or createFacade')
  return createElement(AuthContext.Provider, { value }, children)
}

export function useAuthFacade(providerName = 'AuthProvider'): AuthFacade {
  const facade = useContext(AuthContext)
  if (!facade) throw new Error(`useAuthFacade must be used inside ${providerName}`)
  return facade
}

export function useSessionSnapshot(): SessionSnapshot {
  const facade = useAuthFacade()
  return useSyncExternalStore(facade.subscribe, () => facade.snapshot, () => facade.snapshot ?? initialSessionSnapshot)
}
