import type { AuthFacade } from './auth-adapter.ts'

type WithdrawalSession = Pick<AuthFacade, 'signOut' | 'forceLocalSignOut'>

/**
 * Preserve the commit boundary of account withdrawal. A failed remote sign-out
 * cannot turn an already committed withdrawal into a failed UI mutation or leave
 * the current runtime authenticated against an account every RPC now rejects.
 */
export async function commitWithdrawalAndEndSession(
  commitWithdrawal: () => Promise<unknown>,
  session: WithdrawalSession,
): Promise<void> {
  await commitWithdrawal()
  try {
    await session.signOut()
  } catch {
    session.forceLocalSignOut()
  }
}
