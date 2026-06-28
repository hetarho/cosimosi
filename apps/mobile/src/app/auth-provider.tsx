import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import {
  FakeAuthAdapter,
  createAuthFacade,
  createSupabaseAuthAdapter,
  createSupabaseAuthClient,
  initialSessionSnapshot,
  type AuthAdapter,
  type AuthFacade,
  type SessionSnapshot,
  type SupabaseAuthStorage,
} from '@cosimosi/auth';

const AuthContext = createContext<AuthFacade | null>(null);

interface MobileAuthProviderProps {
  children?: ReactNode;
  adapter?: AuthAdapter;
  facade?: AuthFacade;
  supabase?: MobileSupabaseAuthOptions;
}

export interface MobileSupabaseAuthOptions {
  supabaseUrl: string;
  publishableKey: string;
  secureStorage: SupabaseAuthStorage;
  storageKey?: string;
}

export function MobileAuthProvider({ children, adapter, facade, supabase }: MobileAuthProviderProps) {
  const binding = useMemo(
    () =>
      facade
        ? { auth: facade, owned: false }
        : { auth: createAuthFacade({ adapter: adapter ?? createDefaultMobileAuthAdapter(supabase) }), owned: true },
    [adapter, facade, supabase],
  );
  useEffect(
    () => () => {
      if (binding.owned) binding.auth.dispose();
    },
    [binding],
  );
  return <AuthContext.Provider value={binding.auth}>{children}</AuthContext.Provider>;
}

export function useAuthFacade(): AuthFacade {
  const facade = useContext(AuthContext);
  if (!facade) throw new Error('useAuthFacade must be used inside MobileAuthProvider');
  return facade;
}

export function useSessionSnapshot(): SessionSnapshot {
  const facade = useAuthFacade();
  return useSyncExternalStore(facade.subscribe, () => facade.snapshot, () => initialSessionSnapshot);
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
