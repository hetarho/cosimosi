import { createContext, useContext } from 'react'

// The queued-toast seam. It exists because two owners now want a toast — the error path and the
// achievement unlock notice — and two independently-rendered `Toast` elements would overlap into an
// unreadable stack. So exactly ONE Toast lives in the tree, an app-layer host renders the head of
// this queue, and both owners push.
//
// Platform-pure by construction: React only, no DOM and no i18n. `message` is an ALREADY-RESOLVED
// string, which is what lets the same context serve web and native and keeps the queue out of the
// business of knowing a locale (the shape `packages/errors/src/react.ts` established).
export interface ToastEntry {
  /** Distinct per push, so two identical messages queue rather than collapse. */
  id: string
  variant: 'info' | 'success' | 'warning' | 'danger'
  message: string
  /**
   * Auto-dismiss after this many ms. REQUIRED, because the queue renders one entry at a time: an entry
   * that waits for a manual dismissal the shipped Toast has no affordance for would sit at the head
   * forever and block every later error behind it.
   */
  durationMs: number
  /**
   * Who pushed it. Optional, and it exists for exactly one reason: an owner whose data is scoped to a
   * session can drop its own pending entries when that scope ends, without touching anyone else's.
   */
  owner?: string
}

export interface ToastQueue {
  push: (entry: Omit<ToastEntry, 'id'>) => void
  /**
   * Drop every pending entry from one owner.
   *
   * Two callers, two reasons. The error path clears its own before pushing, so errors stay last-wins
   * as they were before this queue existed — a failing API can raise a dozen of the same refusal in
   * seconds, and queueing them would show a minute of already-stale toasts. And the session boundary
   * clears the session-scoped owners on a scope change, so a notice queued for one user can never
   * surface for the next: the queue lives above auth (an auth error has to be able to toast), so
   * unmounting the notice's host is not on its own enough.
   */
  dropByOwner: (owner: string) => void
}

export type PushToast = ToastQueue['push']

export const ToastQueueContext = createContext<ToastQueue | null>(null)

// A caller outside its platform host is a wiring bug, not a degraded experience — fail loud, the way
// useErrorToast already does.
export function useToastQueue(): ToastQueue {
  const queue = useContext(ToastQueueContext)
  if (!queue) throw new Error('useToastQueue must be used inside a toast provider')
  return queue
}

export function usePushToast(): PushToast {
  return useToastQueue().push
}

/**
 * The achievement unlock notice's identity in the queue — never a user id, which the queue must not
 * learn. It is declared beside the queue rather than in `@cosimosi/achievement` because the list below
 * is defined over it, and this package cannot import a domain package to build that list.
 */
export const ACHIEVEMENT_NOTICE_TOAST_OWNER = 'achievement-notice'

/**
 * The owners whose entries belong to one signed-in session. The session boundary iterates this and
 * drops each owner's pending entries on a scope change, and each owner pushes under the same
 * constant — so the dropping surface and the pushing surface cannot disagree about a tag, and adding
 * a session-scoped toast is one edit here plus the import at the pushing surface.
 */
export const SESSION_SCOPED_TOAST_OWNERS = [ACHIEVEMENT_NOTICE_TOAST_OWNER] as const
