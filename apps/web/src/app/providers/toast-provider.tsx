import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'

import { VALUES } from '@cosimosi/config'
import { ErrorToastProvider } from '@cosimosi/errors/react'
import { Toast, ToastQueueContext, type ToastEntry } from '@cosimosi/ui'

interface WebToastProviderProps {
  children?: ReactNode
}

// The one Toast in the tree. Two owners want to speak here — an error and an achievement unlock — and
// two independently-rendered toasts would overlap into an unreadable stack, so both push into this
// queue and only the HEAD is rendered. The next entry appears when the head dismisses or times out.
export function WebToastProvider({ children }: WebToastProviderProps) {
  const [queue, setQueue] = useState<readonly ToastEntry[]>([])
  // The id is minted OUTSIDE the state updater on purpose: React may call an updater twice, and an id
  // computed inside one would differ between the two calls or repeat between two pushes.
  const nextId = useRef(0)
  const push = useCallback((entry: Omit<ToastEntry, 'id'>) => {
    // A distinct id per push, so two identical messages queue rather than collapse into one.
    const id = `toast-${(nextId.current += 1)}`
    setQueue((current) => [...current, { ...entry, id }])
  }, [])
  // Dropping by owner is how a session-scoped notice stops existing when its session does: the
  // session boundary drops every SESSION_SCOPED_TOAST_OWNERS tag on a scope change, and an error —
  // which carries its own owner — is never touched by it.
  const dropByOwner = useCallback((owner: string) => {
    setQueue((current) => current.filter((entry) => entry.owner !== owner))
  }, [])
  const value = useMemo(() => ({ push, dropByOwner }), [push, dropByOwner])
  const head = queue[0]

  return (
    <ToastQueueContext.Provider value={value}>
      {/* The error seam is wired HERE because this host already holds the queue, and the provider it
          wraps is platform-pure now that errors push rather than render. One host owns the single
          Toast and hands the queue to the one other thing that speaks through it. */}
      <ErrorToastProvider queue={value} durationMs={VALUES.errors.toastAutoDismissMs}>
        {children}
      </ErrorToastProvider>
      <Toast
        // Keying on the head's id restarts the auto-dismiss timer for each entry; without it the
        // second toast would inherit the first's already-elapsed timer and flash past.
        key={head?.id}
        open={head !== undefined}
        onOpenChange={(open) => {
          if (!open) setQueue((current) => current.slice(1))
        }}
        variant={head?.variant}
        durationMs={head?.durationMs}
      >
        {head?.message}
      </Toast>
    </ToastQueueContext.Provider>
  )
}
