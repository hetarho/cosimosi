import { useCallback, type ReactNode } from 'react'

import { ErrorToastContext } from './react.ts'
import { presentAppError } from './presentation.ts'

// The error-toast provider, promoted here because it became platform-pure: since errors push into the
// shared toast queue instead of rendering their own Toast, nothing in this seam touches a DOM or a
// native element. Each app's toast host wraps it and hands over the queue it already holds — that host
// is the only genuinely forked part, because it renders the platform's Toast.

/** The owner tag errors push under, so a host can reason about the queue without guessing. */
export const ERROR_TOAST_OWNER = 'error'

export interface ErrorToastQueue {
  push: (entry: {
    variant: 'info' | 'success' | 'warning' | 'danger'
    message: string
    durationMs: number
    owner?: string
  }) => void
  dropByOwner: (owner: string) => void
}

export interface ErrorToastProviderProps {
  queue: ErrorToastQueue
  /** How long an error dwells. The caller reads it from generated config, so this stays value-free. */
  durationMs: number
  children?: ReactNode
}

// Errors are LAST-WINS, which is what they were before a queue existed. A failing API can raise a dozen
// of the same refusal in seconds, and queueing them would show a minute of already-stale toasts; the
// newest is the only one still true. Clearing only this owner leaves a pending achievement notice
// alone — which is the whole reason entries carry an owner at all.
export function ErrorToastProvider({ queue, durationMs, children }: ErrorToastProviderProps) {
  const { push, dropByOwner } = queue
  const showError = useCallback(
    (error: unknown) => {
      const presentation = presentAppError(error)
      dropByOwner(ERROR_TOAST_OWNER)
      push({
        variant: presentation.severity,
        message: presentation.message,
        durationMs,
        owner: ERROR_TOAST_OWNER,
      })
    },
    [push, dropByOwner, durationMs],
  )

  return <ErrorToastContext.Provider value={showError}>{children}</ErrorToastContext.Provider>
}
