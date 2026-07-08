import { create } from 'zustand'

export type TimeSyncDecision = 'proceed' | 'cancel'

export interface PendingTimeSyncConsent {
  readonly promise: Promise<TimeSyncDecision>
  readonly resolve: (decision: TimeSyncDecision) => void
}

export interface TimeSyncConsentState {
  pending: PendingTimeSyncConsent | null
  request: () => Promise<TimeSyncDecision>
  settle: (decision: TimeSyncDecision) => void
}

// The sync-consent seam ([T2] case 2 / [R1a]): the recall flow's 회고하기 calls request() and
// awaits the user's decision; the mounted universe-time overlay observes `pending`, opens the
// modal, and settles it. The deferred resolver is the one non-data value this store carries —
// holding it here lets the trigger and the modal host live in different slices without a
// cross-widget import. The modal never calls the backend: 'proceed' only returns the decision —
// the recall composition (and its SyncToToday) stays the recall flow's.
export const useTimeSyncConsentStore = create<TimeSyncConsentState>()((set, get) => ({
  pending: null,
  request: () => {
    const existing = get().pending
    // One modal, one decision — a second asker while it is open shares the same answer.
    if (existing) return existing.promise
    let resolve!: (decision: TimeSyncDecision) => void
    const promise = new Promise<TimeSyncDecision>((resolver) => {
      resolve = resolver
    })
    set({ pending: { promise, resolve } })
    return promise
  },
  settle: (decision) => {
    const { pending } = get()
    if (!pending) return
    set({ pending: null })
    pending.resolve(decision)
  },
}))

export function requestTimeSyncConsent(): Promise<TimeSyncDecision> {
  return useTimeSyncConsentStore.getState().request()
}
