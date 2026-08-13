import type { ReactNode } from 'react'

import type { EpisodicMemory, Neuron } from '@cosimosi/memory'
import {
  effectiveBrightness,
  effectiveElapsedDays,
  effectiveStrength,
} from '@cosimosi/memory-logic'
import { IconButton, NoticeIcon, Tooltip, useReducedMotion } from '@cosimosi/ui'
import { currentDecayStage } from '@cosimosi/universe'
import { StarPreview } from '@cosimosi/universe-render'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

// A row of the star's meta, and — for every row that is a reading rather than a fact anyone can read
// off a calendar — the ⓘ that says what the reading MEANS: where it comes from, what it does to the
// star, and what makes it move. A number like 0.87 or a word like 아스라함 is not self-explaining, and
// a panel that shows five of them and explains none is asking the diarist to guess.
//
// The mark rides INSIDE the term, next to the word it explains, and its negative inset gives its 24px
// hit area back to the row: a control tall enough to press must not be what sets the spacing of a
// table of readings. The tip opens on a press as well as on hover — the panel is a bottom sheet on a
// phone, where there is no hover to open anything with — sits ABOVE the row, since these rows are in
// the lower half of the screen on that shape, and hangs from the mark's left edge so a sentence-long
// tip stays on screen in a narrow sheet.
function MetaRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="flex items-center gap-0.5 text-text-muted">
        {label}
        {hint ? (
          <Tooltip content={hint} side="top" align="start" press wrap>
            <IconButton
              variant="text"
              color="neutral"
              size="sm"
              className="-my-1.5 rounded-full"
              label={m.star_meta_hint_label({ label })}
              icon={<NoticeIcon />}
            />
          </Tooltip>
        ) : null}
      </dt>
      <dd className="text-text">{value}</dd>
    </div>
  )
}

// features/star-meta ([D1]): the read-only meta block. An episodic (big) star shows shape ·
// emotion color · brightness · 작성일 · 강도 · current forgetting state, each reading but the date
// carrying the ⓘ that says what it means; a neuron (small) star shows info only, with NO emotion
// ([I3]). Every derived value is read from the shared read-time functions
// (starChannels/effectiveStrength/effectiveBrightness) — none re-derived here (A2), and the hints
// only describe what those functions already do.
export function MetaBlock({
  selection,
  universeTime,
  shape,
  previewAction,
}: {
  selection: { kind: 'episodic'; memory: EpisodicMemory } | { kind: 'neuron'; neuron: Neuron }
  // The read-time "now" that drives the forgetting fade + current decay stage [V2][F1].
  universeTime: string | null
  /** The `STAR_SHADER` ornament this universe wears, so the panel's star is the one in the sky. */
  shape?: string
  /** A corner of the preview frame the composing widget may put a control in. This block reserves
   *  the position and never fills it — a read feature owns no action ([I11]). */
  previewAction?: ReactNode
}) {
  // Read above the neuron branch, because a hook cannot sit behind an early return. A neuron shows
  // no star, so it simply goes unused there.
  const reducedMotion = useReducedMotion()

  if (selection.kind === 'neuron') {
    const { neuron } = selection
    return (
      <dl className="flex flex-col gap-2">
        <MetaRow
          label={m.star_meta_neuron_name()}
          value={neuron.name ?? m.star_meta_neuron_unnamed()}
        />
        <MetaRow label={m.star_meta_neuron_type()} value={neuronTypeLabel(neuron.neuronType)} />
        <MetaRow label={m.star_meta_neuron_connectivity()} value={String(neuron.connectivity)} />
      </dl>
    )
  }

  const { memory } = selection
  const strength = effectiveStrength(memory.baseStrength, memory.recallCount)
  // The real read-time forgetting state: the brightness fade and the decay stage share the same
  // offset-inclusive elapsed clock, so this "현재 망각 정도" indicator moves with the star's dimming
  // ([F1][V2]). Recall resets the anchors, so the next read reads full/vivid again ([F5]).
  const elapsed = effectiveElapsedDays(
    universeTime,
    memory.lastRecalledUniverseTime,
    memory.createdUniverseTime,
    memory.forgettingOffsetDays,
  )
  const brightness = effectiveBrightness(elapsed, memory.emotion.arousal, strength)
  const stage = currentDecayStage(memory, universeTime)
  return (
    // The star above, what is known about it below. Side by side, the star is a thumbnail beside a
    // table; stacked, it is the subject and the rows are its caption — and the rows get the panel's
    // full width instead of splitting it with a picture.
    <div className="flex flex-col gap-4">
      {/* Rounded and clipped so the sky the star sits in reads as a window, not a hole. The frame is
          `aria-hidden` and clips, so the action rides a positioned wrapper OUTSIDE it: a focusable
          control inside a hidden subtree is unreachable, and one inside the clip is cut off. */}
      <div className="relative">
        <div aria-hidden className="h-44 w-full overflow-hidden rounded-xl border border-border">
          <StarPreview
            memory={memory}
            universeTime={universeTime}
            shape={shape}
            reducedMotion={reducedMotion}
          />
        </div>
        {previewAction ? <div className="absolute top-2 right-2">{previewAction}</div> : null}
      </div>
      <dl className="flex flex-col gap-2">
        <MetaRow
          label={m.star_meta_emotion()}
          value={moodLabel(memory.emotion.mood)}
          hint={m.star_meta_hint_emotion()}
        />
        <MetaRow
          label={m.star_meta_brightness()}
          value={percent(brightness)}
          hint={m.star_meta_hint_brightness()}
        />
        {/* The one row with nothing to explain: a date is the fact itself, and an ⓘ that only said
            "this is the date" would teach the diarist to stop pressing the others. */}
        <MetaRow label={m.star_meta_created()} value={memory.createdUniverseTime} />
        <MetaRow
          label={m.star_meta_strength()}
          value={strength.toFixed(2)}
          hint={m.star_meta_hint_strength()}
        />
        <MetaRow
          label={m.star_meta_forgetting_state()}
          value={forgettingStageLabel(stage)}
          hint={m.star_meta_hint_forgetting_state()}
        />
      </dl>
    </div>
  )
}

function neuronTypeLabel(type: Neuron['neuronType']): string {
  if (type === 'semantic') return m.star_meta_neuron_type_semantic()
  if (type === 'spatial') return m.star_meta_neuron_type_spatial()
  return m.star_meta_neuron_type_entity()
}

// The forgetting-degree label for a decay stage (0 = vivid). Stages deepen the fade word; the value
// array is [F9]-tunable, so clamp past the last known label rather than assuming a fixed count.
function forgettingStageLabel(stage: number): string {
  const labels = [
    m.star_meta_forgetting_vivid(),
    m.star_meta_forgetting_softening(),
    m.star_meta_forgetting_blurring(),
    m.star_meta_forgetting_faint(),
    m.star_meta_forgetting_distant(),
  ]
  const index = Math.min(Math.max(stage, 0), labels.length - 1)
  return labels[index]
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}
