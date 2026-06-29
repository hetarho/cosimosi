import { createContext, createElement, useContext, useRef, useSyncExternalStore, type ReactNode } from 'react'

import type { AuthFacade } from './auth-adapter.ts'
import type { SessionSnapshot } from './session.ts'

export const AuthContext = createContext<AuthFacade | null>(null)

export interface AuthProviderProps {
  children?: ReactNode
  facade?: AuthFacade
  createFacade?: () => AuthFacade
}

export function AuthProvider({ children, facade, createFacade }: AuthProviderProps) {
  // Own the facade in a ref, created once. Creating it in a useState initializer would
  // run twice under React StrictMode (dev) and orphan a second live actor + adapter
  // subscription + refresh timer with no dispose handle; a ref-guarded create runs
  // exactly once. The facade is an app-lifetime singleton at the provider root.
  const ownedFacade = useRef<AuthFacade | null>(null)
  if (!facade && !ownedFacade.current) ownedFacade.current = createFacade?.() ?? null
  const value = facade ?? ownedFacade.current
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
  return useSyncExternalStore(facade.subscribe, () => facade.snapshot, () => facade.snapshot)
}
