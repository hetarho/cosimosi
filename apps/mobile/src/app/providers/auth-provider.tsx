import {type ReactNode} from 'react';

import {
  FakeAuthAdapter,
  createAuthFacade,
  createSupabaseAuthAdapter,
  createSupabaseAuthClient,
  type AuthAdapter,
  type AuthFacade,
} from '@cosimosi/auth';
import {AuthProvider, useAuthFacade, useSessionSnapshot} from '@cosimosi/auth/react';

import type {SecureTokenStorage} from '../../shared/native/index.ts';

interface MobileAuthProviderProps {
  children?: ReactNode;
  facade?: AuthFacade;
  supabase?: MobileSupabaseAuthOptions;
}

export interface MobileSupabaseAuthOptions {
  supabaseUrl: string;
  publishableKey: string;
  /** Keychain/Keystore-backed token store from the native secure-storage seam. */
  secureStorage: SecureTokenStorage;
  storageKey?: string;
}

export function MobileAuthProvider({children, facade, supabase}: MobileAuthProviderProps) {
  return (
    <AuthProvider facade={facade} createFacade={() => createAuthFacade({adapter: createDefaultMobileAuthAdapter(supabase)})}>
      {children}
    </AuthProvider>
  );
}

function createDefaultMobileAuthAdapter(supabase: MobileSupabaseAuthOptions | undefined): AuthAdapter {
  if (!supabase) return new FakeAuthAdapter();
  return createSupabaseAuthAdapter(
    createSupabaseAuthClient({
      supabaseUrl: supabase.supabaseUrl,
      publishableKey: supabase.publishableKey,
      storage: supabase.secureStorage,
      storageKey: supabase.storageKey,
      detectSessionInUrl: false,
      flowType: 'pkce',
    }),
  );
}

export {useAuthFacade, useSessionSnapshot};
