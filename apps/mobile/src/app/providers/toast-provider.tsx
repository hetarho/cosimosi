import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { VALUES } from '@cosimosi/config'
import { ErrorToastProvider } from '@cosimosi/errors/react'
import { Toast, ToastQueueContext, type ToastEntry } from '@cosimosi/ui'

interface MobileToastProviderProps {
  children?: ReactNode
}

// The one Toast in the tree — the native fork of the web host. Two owners want to speak here (an error
// and an achievement unlock), and two independently-rendered toasts would overlap, so both push into
// this queue and only the HEAD is rendered.
export function MobileToastProvider({ children }: MobileToastProviderProps) {
  const [queue, setQueue] = useState<readonly ToastEntry[]>([])
  // The id is minted OUTSIDE the state updater on purpose: React may call an updater twice, and an id
  // computed inside one would differ between the two calls or repeat between two pushes. A counter is
  // enough — uniqueness within a session is all an id has to carry here.
  const nextId = useRef(0)
  const push = useCallback((entry: Omit<ToastEntry, 'id'>) => {
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
      <View style={styles.toastHost}>
        <Toast
          // Keying on the head restarts the auto-dismiss timer per entry; without it the second toast
          // would inherit the first's elapsed timer and flash past.
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
      </View>
    </ToastQueueContext.Provider>
  )
}

const styles = StyleSheet.create({
  toastHost: {
    bottom: 24,
    left: 16,
    position: 'absolute',
    pointerEvents: 'box-none',
    right: 16,
    zIndex: 100,
  },
})
