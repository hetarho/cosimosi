import {
  createContext,
  createElement,
  useEffect,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

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
  return useSyncExternalStore(
    facade.subscribe,
    () => facade.snapshot,
    () => facade.snapshot,
  )
}

export function authScopeKey(snapshot: Pick<SessionSnapshot, 'userId'>): string {
  return snapshot.userId ?? 'anonymous'
}

export interface SessionScopeBoundaryProps {
  children?: ReactNode
  fallback?: ReactNode
  onScopeChange: (nextScopeKey: string) => void
}

/**
 * Unmounts the old subtree as soon as its auth scope changes, then releases the new subtree only
 * after the host synchronously clears user-owned state and query data in an effect.
 */
export function SessionScopeBoundary({
  children,
  fallback = null,
  onScopeChange,
}: SessionScopeBoundaryProps) {
  const observedScopeKey = authScopeKey(useSessionSnapshot())
  const [committedScopeKey, setCommittedScopeKey] = useState(observedScopeKey)

  useEffect(() => {
    if (committedScopeKey === observedScopeKey) return
    onScopeChange(observedScopeKey)
    setCommittedScopeKey(observedScopeKey)
  }, [committedScopeKey, observedScopeKey, onScopeChange])

  return committedScopeKey === observedScopeKey ? children : fallback
}
