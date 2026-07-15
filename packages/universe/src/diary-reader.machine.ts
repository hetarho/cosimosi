import { setup } from 'xstate'

// The diary-jump control-state (§3.2): which phase 이 일기로 태어난 별 보기 is in. Reading the
// archive is free ([D2]) and lives outside this machine (`browsing` is the resting state); only
// the jump spends and moves the clock. Context is empty — the target diary id, the quote, and the
// result all live in the widget/stores; the machine only sequences the phases. `confirming` is
// entered only when the clock is behind today (the JUMP event carries that decision as a guard
// input, [R1a][T2]); `recalling` is the loading phase covering the server-side sync + reinforce.
export type DiaryReaderPhase = 'browsing' | 'confirming' | 'recalling' | 'flying'

export type DiaryReaderEvent =
  | { type: 'JUMP'; needsSync: boolean }
  | { type: 'ACCEPT' }
  | { type: 'REJECT' }
  | { type: 'DONE' }
  | { type: 'ERROR' }

export const diaryReaderMachine = setup({
  types: {
    events: {} as DiaryReaderEvent,
  },
  guards: {
    // The clock is behind today → consent is required before the recall's server-side sync ([R1a]).
    needsSync: ({ event }) => event.type === 'JUMP' && event.needsSync,
  },
}).createMachine({
  id: 'diaryReader',
  initial: 'browsing',
  states: {
    browsing: {
      on: {
        JUMP: [{ target: 'confirming', guard: 'needsSync' }, { target: 'recalling' }],
      },
    },
    // The reusable sync-consent modal ([T2] case 2): 예 → recall, 아니오 → cancel with the clock
    // unmoved (the sync fires server-side only on the later recall, never here).
    confirming: {
      on: {
        ACCEPT: 'recalling',
        REJECT: 'browsing',
      },
    },
    // "별들을 다시 떠올리는 중" — the single synchronous RecallDiaryStars covers sync + reinforce
    // atomically. A failure returns to browsing, retriable (nothing was spent, A8).
    recalling: {
      on: {
        DONE: 'flying',
        ERROR: 'browsing',
      },
    },
    // The recovered stars are surfaced back in the universe: the widget announces the acceleration,
    // navigates home, and asks the camera to glide to an affected star. Terminal — the reader
    // unmounts on the route change.
    flying: {},
  },
})
