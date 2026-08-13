import type { EpisodicMemory } from '@cosimosi/memory'
import {
  effectiveBrightness,
  effectiveElapsedDays,
  effectiveStrength,
} from '@cosimosi/memory-logic'
import { Button, Dialog, ObscuredText, useReducedMotion } from '@cosimosi/ui'
import { currentDecayStage, currentDecaySpans } from '@cosimosi/universe'
import { StarPreview } from '@cosimosi/universe-render'

import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'
import { m, moodLabel } from '../../../shared/i18n/index.ts'
import type { DemoAnchor } from '../model/anchors.ts'
import { isDemoAnchorInteractive, type DemoRunPhase } from '../model/run-machine.ts'

export interface DemoStarPanelProps {
  readonly memory: EpisodicMemory | null
  readonly phase: DemoRunPhase
  /** The read-time "now" the fade and the decay stage are resolved at — the demo clock. */
  readonly universeTime: string
  /** The star shape this universe wears, so the panel's star is the one in the sky. */
  readonly bodyShape: string | null
  /** True when the tutorial's recall beat points at THIS star; the gate narrows the control kind to
   *  the one memory the beat is about. */
  readonly isRecallTarget: boolean
  readonly onRecall: () => void
  readonly onOpenDiary: () => void
  readonly onClose: () => void
}

// pages/demo ui: a picked star, opened — the read-only twin of the product's `DetailPanel` ([D1]).
// The shipped panel is fused to the worn-ornament query, the provenance read and the priced gist
// view, all of which the isolation closure bans, so what the twin keeps is the shape: the same
// `Dialog` (a centred modal on a wide screen, a bottom sheet on a narrow one), the star rendered in
// its own framed sky above what is known about it, the current words below, and 회고하기 standing in
// the open with the way to the original diary beside it.
//
// It makes forgetting READABLE rather than only visible at a distance: the words render as the
// production `currentDecaySpans` resolves them at the demo clock — smeared where time has taken
// them, whole again after a recall. Two actions, both labelled: the product gathers its five behind
// a control on the star's frame, and a menu holding two things is a menu for its own sake.
export function DemoStarPanel({
  memory,
  phase,
  universeTime,
  bodyShape,
  isRecallTarget,
  onRecall,
  onOpenDiary,
  onClose,
}: DemoStarPanelProps) {
  const reducedMotion = useReducedMotion()
  if (!memory) return null

  const strength = effectiveStrength(memory.baseStrength, memory.recallCount)
  // The real read-time forgetting state: the brightness fade and the decay stage share the same
  // offset-inclusive elapsed clock, so this reading moves with the star's own dimming ([F1][V2]).
  const elapsed = effectiveElapsedDays(
    universeTime,
    memory.lastRecalledUniverseTime,
    memory.createdUniverseTime,
    memory.forgettingOffsetDays,
  )
  const brightness = effectiveBrightness(elapsed, memory.emotion.arousal, strength)
  const stage = currentDecayStage(memory, universeTime)

  return (
    <Dialog open onClose={onClose} title={memory.name} closeLabel={m.common_dismiss()}>
      <div className="flex flex-col gap-5">
        {/* Rounded and clipped so the sky the star sits in reads as a window, not a hole. */}
        <div aria-hidden className="h-44 w-full overflow-hidden rounded-xl border border-border">
          <StarPreview
            memory={memory}
            universeTime={universeTime}
            shape={bodyShape ?? undefined}
            reducedMotion={reducedMotion}
          />
        </div>

        <dl className="flex flex-col gap-2">
          <MetaRow label={m.star_meta_emotion()} value={moodLabel(memory.emotion.mood)} />
          <MetaRow label={m.star_meta_brightness()} value={`${Math.round(brightness * 100)}%`} />
          <MetaRow label={m.star_meta_created()} value={memory.createdUniverseTime} />
          <MetaRow label={m.star_meta_strength()} value={strength.toFixed(2)} />
          <MetaRow label={m.star_meta_forgetting_state()} value={forgettingStageLabel(stage)} />
        </dl>

        <ObscuredText
          className="whitespace-pre-line"
          spans={currentDecaySpans(memory, universeTime).map((span) => ({
            text: span.text,
            obscured: span.lost,
          }))}
        />

        {/* Decreasing emphasis left to right, the committing action last (§4). */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <SequenceAnchor id={'entry-open-action' satisfies DemoAnchor}>
            <Button
              variant="text"
              color="neutral"
              size="sm"
              onClick={onOpenDiary}
              disabled={!isDemoAnchorInteractive(phase, 'entry-open-action')}
            >
              {m.star_detail_open_diary()}
            </Button>
          </SequenceAnchor>
          <SequenceAnchor id={'recall-action' satisfies DemoAnchor}>
            <Button
              color="primary"
              size="sm"
              onClick={onRecall}
              disabled={!isDemoAnchorInteractive(phase, 'recall-action', isRecallTarget)}
            >
              {m.star_detail_recall()}
            </Button>
          </SequenceAnchor>
        </div>
      </div>
    </Dialog>
  )
}

function MetaRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  )
}

// The forgetting-degree label for a decay stage (0 = vivid), clamped past the last known label
// because the stage count is tunable ([F9]).
function forgettingStageLabel(stage: number): string {
  const labels = [
    m.star_meta_forgetting_vivid(),
    m.star_meta_forgetting_softening(),
    m.star_meta_forgetting_blurring(),
    m.star_meta_forgetting_faint(),
    m.star_meta_forgetting_distant(),
  ]
  return labels[Math.min(Math.max(stage, 0), labels.length - 1)]
}
