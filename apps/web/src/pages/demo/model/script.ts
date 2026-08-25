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
// step — a dwell step here would fake progress nobody made. The gist rising is a consequence rather
// than an action, so it is a signal too, reported by the page from the press that pushes time.
//
// The neuron-reuse beat anchors the WRITE control and waits for `launched`: pressing it draws one
// more prepared diary through the same flow the first diary walked, and the beat is done when that
// diary goes up — the second `launched` of the run, which the engine's current-step match keeps
// from colliding with beat 3's. The two time beats anchor the month jump, the grain big enough to
// show dimming (and a gist stage) in one press.
const BEAT_STEPS: Readonly<Record<DemoBeatId, { anchor?: DemoAnchor; signal: DemoSignal | null }>> =
  {
    // The ring goes on the read control rather than on the card around it: the card is what the
    // beat lights up to be read, the control is what the beat waits for.
    diary_appears: { anchor: 'diary-read-action', signal: 'diary_read' },
    split: { anchor: 'split-action', signal: 'split_revealed' },
    launch: { anchor: 'launch-action', signal: 'launched' },
    neuron_reuse: { anchor: 'write-action', signal: 'launched' },
    time_accelerates: { anchor: 'time-month-action', signal: 'time_advanced' },
    recall: { anchor: 'recall-action', signal: 'recalled' },
    gist_rise: { anchor: 'time-month-action', signal: 'gist_risen' },
    // The sky already carries the universe's colour — it has since the first `EpisodicMemory`
    // launched — so this beat asks for nothing and applies nothing; it names what is already
    // overhead. A signal here would have to be fired by the page on arrival, which advances the run
    // in the same commit that starts it and leaves the sentence unread.
    color: { signal: null },
    // The decorating beat anchors the 꾸미기 control and waits for the sheet to CLOSE: opening it,
    // trying something on and coming back out to the changed universe is one beat's work, so its
    // ring walks (page-side) from the control to the row and its caption covers the whole arc.
    ornament_taster: { anchor: 'decorate-action', signal: 'decorate_closed' },
    // The closing beat points at NOTHING: highlighting the signup control would read as "the tour
    // ends by leaving". Its caption names where the door is; the visitor goes when they feel like
    // it, and the room is already open under the caption.
    signup_cta: { signal: null },
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
      // The two `dwell` beats are the ones with nothing to press: the sky beat explains the colour
      // already overhead, and the closing beat ends by the visitor GOING rather than by a tenth
      // signal. Each caption holds, then the run moves on; after the last one the chrome retires and
      // the CTA stays where it is.
      advance: signal ? { on: 'signal' as const, signal } : { on: 'dwell' as const },
    }
  }),
})
