// The [04] auth seam for lower FSD layers (the mobile mirror of apps/web/src/shared/auth): features
// read the session snapshot / facade from here, never from app/providers (an upward import) and
// never from Supabase. Same context module as MobileAuthProvider, so the provided facade resolves.
export { AuthContext, useAuthFacade, useSessionSnapshot } from '@cosimosi/auth/react'
