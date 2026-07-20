import { useCallback, useState } from 'react'

import { useAuthFacade, useSessionSnapshot } from '../../../shared/auth/index.ts'

export interface AccountSession {
  userId: string | null
  signingOut: boolean
  signOut: () => Promise<void>
}

// The account section's whole data surface: the [04] session snapshot (the identity facts already
// client-side — no new fetch) and the facade's existing sign-out. The signing-out transient is a
// trivial loading flag (§3.2); the snapshot itself stays in the facade. After sign-out the session
// machine settles signedOut and the auth gate ([53]) routes to login — no routing call happens here.
export function useAccountSession(): AccountSession {
  const facade = useAuthFacade()
  const { userId } = useSessionSnapshot()
  const [signingOut, setSigningOut] = useState(false)
  const signOut = useCallback(async () => {
    setSigningOut(true)
    try {
      await facade.signOut()
    } finally {
      // On success the gate unmounts this screen; the reset only matters on failure, so the
      // action never sticks disabled (the failure itself surfaces via [04] observability).
      setSigningOut(false)
    }
  }, [facade])
  return { userId, signingOut, signOut }
}
