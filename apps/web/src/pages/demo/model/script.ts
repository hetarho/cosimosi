import { defineScript, type SequenceScript } from '@cosimosi/sequence'
import { DEMO_BEAT_IDS, type DemoBeatId } from '@cosimosi/demo'

import { m } from '../../../shared/i18n/index.ts'
import type { DemoAnchor, DemoSignal } from './anchors.ts'

// The ten beats as a script the engine can walk. The beat ORDER and the fixture bindings are the
// scenario's ([Z3], shipped with the fixtures); what lives here is the presentation half the engine
// needs — which control each beat points at, and what advances it.
//
// Captions are accessors, never strings: every sentence on this public page lands in the message
// catalogues where the honesty review happens once. The mapping is an exhaustive `Record`, so a beat
// added to the scenario without a caption is a compile error rather than a blank line on a trailer.
const BEAT_CAPTIONS: Readonly<Record<DemoBeatId, () => string>> = {
  diary_appears: () => m.demo_beat_diary_appears(),
  split: () => m.demo_beat_split(),
  launch: () => m.demo_beat_launch(),
  neuron_reuse: () => m.demo_beat_neuron_reuse(),
  time_accelerates: () => m.demo_beat_time_accelerates(),
  recall: () => m.demo_beat_recall(),
  gist_rise: () => m.demo_beat_gist_rise(),
  color: () => m.demo_beat_color(),
  ornament_taster: () => m.demo_beat_ornament_taster(),
  signup_cta: () => m.demo_beat_signup_cta(),
}

// What each beat points at, and what counts as done. Every beat the visitor must DO is a `signal`
// step — a dwell step here would fake progress nobody made. The two beats that are consequences
// rather than actions (the gist rising, the sky filling) are also signals, fired by the page once it
// has applied the change, so the caption never runs ahead of what is on screen.
const BEAT_STEPS: Readonly<Record<DemoBeatId, { anchor?: DemoAnchor; signal: DemoSignal | null }>> =
  {
    diary_appears: { anchor: 'diary-card', signal: 'diary_read' },
    split: { anchor: 'split-action', signal: 'split_revealed' },
    launch: { anchor: 'launch-action', signal: 'launched' },
    neuron_reuse: { anchor: 'add-diaries-action', signal: 'diaries_added' },
    time_accelerates: { anchor: 'time-travel-action', signal: 'time_advanced' },
    recall: { anchor: 'recall-action', signal: 'recalled' },
    gist_rise: { anchor: 'time-travel-action', signal: 'gist_risen' },
    color: { signal: 'sky_filled' },
    ornament_taster: { anchor: 'taster-rail', signal: 'ornament_tasted' },
    signup_cta: { anchor: 'signup-action', signal: null },
  }

export const DEMO_SCRIPT: SequenceScript<DemoAnchor, DemoSignal> = defineScript<
  DemoAnchor,
  DemoSignal
>({
  id: 'demo',
  steps: DEMO_BEAT_IDS.map((beat) => {
    const { anchor, signal } = BEAT_STEPS[beat]
    return {
      id: beat,
      caption: BEAT_CAPTIONS[beat],
      // Omitted rather than set to undefined when a beat points at nothing, so a narration-only step
      // carries no anchor key at all.
      ...(anchor ? { anchor } : {}),
      // The closing beat is the one `dwell`: pressing the CTA leaves the page, so the run ends by
      // going rather than by a tenth signal. Its caption holds, then the chrome retires and the CTA
      // stays where it is.
      advance: signal ? { on: 'signal' as const, signal } : { on: 'dwell' as const },
    }
  }),
})
