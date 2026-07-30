import { m } from '@cosimosi/i18n'
import { defineScript, type SequenceScript } from '@cosimosi/sequence'

import type { OnboardingAnchor, OnboardingSignal } from './anchors.ts'

// The nine steps of the post-signup tour, in order.
//
// Every step that represents progress the USER must make is a `signal` step; `dwell` is reading time
// and nothing else. That distinction is why the tour cannot get ahead of the product: a failed
// `SplitDiary` returns the shipped machine to `writing` and emits nothing, so step 3 simply holds its
// caption. There is no retry logic, no timeout and no error surface of the tour's own.
//
// Every caption is a ZERO-PARAMETER accessor, and that is load-bearing rather than tidy: no memory
// name, count, date or stardust amount can appear in a sentence, which is what lets one script be true
// for an empty first universe AND for a replay over a full one. It is the structural form of the
// engine's "a script carries no data payload".
//
// Step 8 is the deliberate stopping point. A recall costs stardust and requires consent, so the tour
// NAMES it and stops rather than walking a first-minute user into a spend — expressed as a missing
// union member (`anchors.ts`), never as a conditional step.
export const ONBOARDING_SCRIPT: SequenceScript<OnboardingAnchor, OnboardingSignal> = defineScript<
  OnboardingAnchor,
  OnboardingSignal
>({
  id: 'onboarding',
  steps: [
    { id: 'welcome', caption: m.sequence_tour_welcome_caption, advance: { on: 'dwell' } },
    {
      id: 'entry',
      caption: m.sequence_tour_entry_caption,
      anchor: 'universe-write-entry',
      advance: { on: 'signal', signal: 'writing-flow-opened' },
    },
    {
      id: 'draft',
      caption: m.sequence_tour_draft_caption,
      anchor: 'writing-draft',
      advance: { on: 'signal', signal: 'split-succeeded' },
    },
    {
      id: 'proposal',
      caption: m.sequence_tour_proposal_caption,
      anchor: 'writing-proposal',
      advance: { on: 'dwell' },
    },
    {
      id: 'confirm',
      caption: m.sequence_tour_confirm_caption,
      anchor: 'writing-confirm',
      advance: { on: 'signal', signal: 'launch-succeeded' },
    },
    // Worded to hold whether or not a memory was actually created: a past-dated first diary is saved
    // without one, and that outcome's one-time notice belongs to the writing flow, not the tour.
    { id: 'arrival', caption: m.sequence_tour_arrival_caption, advance: { on: 'dwell' } },
    {
      id: 'clock',
      caption: m.sequence_tour_clock_caption,
      anchor: 'universe-clock',
      advance: { on: 'dwell' },
    },
    { id: 'revisit', caption: m.sequence_tour_revisit_caption, advance: { on: 'dwell' } },
    { id: 'closing', caption: m.sequence_tour_closing_caption, advance: { on: 'dwell' } },
  ],
})
