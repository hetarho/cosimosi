import { assign, setup } from 'xstate'

// The deletion + letting-go flow control-state (§3.2): which step of which branch the sheet is in.
// Two branches share one machine — full delete (`confirmingDelete → deleting`) and letting-go
// (`phrasing → suggesting → approving → sealing`) — meeting at a shared `done`. Restore is NOT a
// state here: it is a one-shot feature its host page drives ([X2]).
export type DeletionFlowPhase =
  | 'idle'
  | 'confirmingDelete'
  | 'deleting'
  | 'phrasing'
  | 'suggesting'
  | 'approving'
  | 'sealing'
  | 'done'

// Context rule (§3.2): ids only — the target diary (full delete) or the target episodic memory
// (letting-go). The typed phrase, the candidate list, and the selected ids live in the draft store,
// never here ([I3][I11]). The heavy-state hint is carried as response data in the store too, not a
// state of its own — the notice is advisory, it gates nothing ([X7]).
export interface DeletionFlowContext {
  diaryId: string | null
  episodicMemoryId: string | null
}

export type DeletionFlowEvent =
  | { type: 'OPEN_DELETE'; diaryId: string }
  | { type: 'OPEN_LETGO'; episodicMemoryId: string }
  | { type: 'CONFIRM' }
  | { type: 'SUGGEST' }
  | { type: 'SEAL' }
  | { type: 'DONE' }
  | { type: 'ERROR' }
  | { type: 'BACK' }
  | { type: 'CANCEL' }
  | { type: 'RESET' }

export const deletionFlowMachine = setup({
  types: {
    context: {} as DeletionFlowContext,
    events: {} as DeletionFlowEvent,
  },
  actions: {
    setDeleteTarget: assign(({ event }) =>
      event.type === 'OPEN_DELETE' ? { diaryId: event.diaryId, episodicMemoryId: null } : {},
    ),
    setLetGoTarget: assign(({ event }) =>
      event.type === 'OPEN_LETGO'
        ? { episodicMemoryId: event.episodicMemoryId, diaryId: null }
        : {},
    ),
    clearTarget: assign({ diaryId: null, episodicMemoryId: null }),
  },
}).createMachine({
  id: 'deletionFlow',
  context: { diaryId: null, episodicMemoryId: null },
  initial: 'idle',
  // CANCEL closes the sheet only from the INTERACTIVE steps (it lives on each such state below, not
  // globally): the loading states deleting/suggesting/sealing are deliberately un-closable so a
  // stale async completion can never land on a different, newly-opened branch — the flow can only
  // leave a loading state through its own DONE/ERROR (mirrors stardustMachine's paying/inviting).
  states: {
    idle: {
      on: {
        OPEN_DELETE: { target: 'confirmingDelete', actions: 'setDeleteTarget' },
        OPEN_LETGO: { target: 'phrasing', actions: 'setLetGoTarget' },
      },
    },
    // Full-delete confirm: the affected stars + the 30-day restore + export reassurances shown
    // before the act ([X1][X2][W6]). CONFIRM is the user's explicit removal ([I1]).
    confirmingDelete: {
      on: { CONFIRM: 'deleting', CANCEL: { target: 'idle', actions: 'clearTarget' } },
    },
    // Release(diary_id) in flight; the returned ids are optimistically removed on success. A failed
    // call returns here, retriable — nothing was removed ([X3][I5]). Un-closable while in flight.
    deleting: {
      on: { DONE: 'done', ERROR: 'confirmingDelete' },
    },
    // Letting-go step 1 — say the words ([X6]); symbolic framing from the first screen ([X7]).
    phrasing: {
      on: { SUGGEST: 'suggesting', CANCEL: { target: 'idle', actions: 'clearTarget' } },
    },
    // Loading — SuggestLetGo in flight (LLM latency). A failed call returns to phrasing, retriable.
    // Un-closable while in flight.
    suggesting: {
      on: { DONE: 'approving', ERROR: 'phrasing' },
    },
    // Candidate review + select-to-seal ([X6]); the heavy-state notice renders here if flagged, and
    // never blocks progression ([X7]). BACK reopens phrasing to reword.
    approving: {
      on: {
        SEAL: 'sealing',
        BACK: 'phrasing',
        CANCEL: { target: 'idle', actions: 'clearTarget' },
      },
    },
    // Loading — LetGo in flight. A failed call returns to approving with nothing sealed ([X5]).
    // Un-closable while in flight.
    sealing: {
      on: { DONE: 'done', ERROR: 'approving' },
    },
    // The star vanished (delete) or persists as a silent engram (let-go); the sheet closes.
    done: {
      on: { RESET: { target: 'idle', actions: 'clearTarget' } },
    },
  },
})

// Remaining days in a full-delete restore window, derived from the Release response's `deleted_at`
// (real-clock UTC) + the config retention days — never hardcoded ([X2]). Clamped to [0, retention];
// 0 means the window has closed (the backend sweep will hard-delete). The caller passes the config
// value and the current instant so this stays pure and testable.
export function remainingRestoreDays(
  deletedAt: string,
  retentionDays: number,
  now: Date = new Date(),
): number {
  const deleted = new Date(deletedAt).getTime()
  if (Number.isNaN(deleted)) return 0
  const msPerDay = 24 * 60 * 60 * 1000
  const elapsedDays = (now.getTime() - deleted) / msPerDay
  const remaining = Math.ceil(retentionDays - elapsedDays)
  if (remaining < 0) return 0
  return remaining > retentionDays ? retentionDays : remaining
}
