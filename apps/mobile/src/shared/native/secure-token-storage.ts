import type {SupabaseAuthStorage} from '@cosimosi/auth';

/**
 * Secure token storage seam (ARCHITECTURE §3.5). The auth facade persists the
 * Supabase session through this `getItem/setItem/removeItem` contract; feature
 * code never touches it. A production build supplies a Keychain/Keystore-backed
 * implementation at the app boundary (a later deployment concern — plan/13
 * non-goal: no biometric/native secure-storage dependency is wired in Phase 1).
 * Tests and the default dev shell use the in-memory implementation below.
 */
export type SecureTokenStorage = SupabaseAuthStorage;

/** Process-lifetime in-memory token storage for host tests and the dev shell. */
export function createInMemorySecureTokenStorage(): SecureTokenStorage {
  const store = new Map<string, string>();
  return {
    getItem(key) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}
