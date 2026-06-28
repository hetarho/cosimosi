import { createContext, useContext, useSyncExternalStore } from 'react'

import { initialSessionSnapshot, type AuthFacade, type SessionSnapshot } from '@cosimosi/auth'

export const AuthContext = createContext<AuthFacade | null>(null)

export function useAuthFacade(): AuthFacade {
  const facade = useContext(AuthContext)
  if (!facade) throw new Error('useAuthFacade must be used inside WebAuthProvider')
  return facade
}

export function useSessionSnapshot(): SessionSnapshot {
  const facade = useAuthFacade()
  return useSyncExternalStore(facade.subscribe, () => facade.snapshot, () => initialSessionSnapshot)
}
