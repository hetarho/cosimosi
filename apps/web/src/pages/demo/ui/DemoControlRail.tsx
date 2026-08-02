import { Button, Card } from '@cosimosi/ui'

import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import type { DemoAnchor } from '../model/anchors.ts'
import { isDemoAnchorInteractive, type DemoRunPhase } from '../model/run-machine.ts'

export interface DemoStarRow {
  readonly memoryId: string
  readonly name: string
}

export interface DemoControlRailProps {
  readonly phase: DemoRunPhase
  /** Every launched memory — free play's per-star surface. */
  readonly stars: readonly DemoStarRow[]
  /** The one star the tutorial's recall beat points at. */
  readonly tutorialRecallMemoryId: string
  readonly onDraw: () => void
  readonly onAdvanceDays: (grain: 'day' | 'week' | 'month') => void
  readonly onRecall: (memoryId: string) => void
  readonly onOpenEntry: (memoryId: string) => void
}

// pages/demo ui: the controls the tour highlights and the playroom keeps. The visitor ACTS — a
// step carries no handler, so every beat advances because someone here pressed something. The
// write flow itself lives in `DemoWritingSheet` (the product's dialog shapes); this rail holds
// the write affordance, the time grains and the per-memory rows.
//
// Two rules shape this file. Anchoring: each control is wrapped in `SequenceAnchor` at this
// composition site rather than registering itself — the rule that keeps every shipped product
// slice unaware a sequence exists, with the anchor ids a closed union from `model/anchors.ts`;
// the anchor wraps the button directly, because `SequenceAnchor` measures its first child.
// Gating: whether a control is PRESSABLE comes only from the run machine's derivation
// (`isDemoAnchorInteractive`) — pressed off-script, a control is simply disabled. The VISUAL half
// of the gate is not here: `DemoTutorialMask` lays one layer over the whole page with a hole at
// the current beat's controls, so covering is a page concern and this rail stays plain. The skip
// affordance and the signup CTA live above the rail (sequence chrome, page corner) and are never
// gated.
//
// There is deliberately no balance, no cost, no quote and no spend gate anywhere in this rail. On
// a page that never charges anything, a currency figure would be noise at best and a payment smell
// at worst — so "unlimited stardust" is discharged by absence, not by a large number.
export function DemoControlRail({
  phase,
  stars,
  tutorialRecallMemoryId,
  onDraw,
  onAdvanceDays,
  onRecall,
  onOpenEntry,
}: DemoControlRailProps) {
  const open = (anchor: DemoAnchor, isTutorialTarget = true) =>
    isDemoAnchorInteractive(phase, anchor, isTutorialTarget)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Anchor id="write-action">
          <Button color="primary" size="sm" onClick={onDraw} disabled={!open('write-action')}>
            {m.demo_write_action()}
          </Button>
        </Anchor>
        <Anchor id="time-day-action">
          <Button
            color="neutral"
            size="sm"
            onClick={() => onAdvanceDays('day')}
            disabled={!open('time-day-action')}
          >
            {m.demo_time_day_action()}
          </Button>
        </Anchor>
        <Anchor id="time-week-action">
          <Button
            color="neutral"
            size="sm"
            onClick={() => onAdvanceDays('week')}
            disabled={!open('time-week-action')}
          >
            {m.demo_time_week_action()}
          </Button>
        </Anchor>
        <Anchor id="time-month-action">
          <Button
            color="neutral"
            size="sm"
            onClick={() => onAdvanceDays('month')}
            disabled={!open('time-month-action')}
          >
            {m.demo_time_month_action()}
          </Button>
        </Anchor>
      </div>

      {stars.length > 0 && (
        <Card>
          <p className="text-xs text-text-muted">{m.demo_stars_label()}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {stars.map((star) => {
              // The tutorial's recall beat points at ONE star; the machine narrows the whole
              // control kind to that instance until free play opens the rest.
              const isTarget = star.memoryId === tutorialRecallMemoryId
              const recallButton = (
                <Button
                  color="neutral"
                  size="sm"
                  onClick={() => onRecall(star.memoryId)}
                  disabled={!open('recall-action', isTarget)}
                >
                  {m.demo_recall_action()}
                </Button>
              )
              return (
                <li key={star.memoryId} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-text">{star.name}</span>
                  <Button
                    color="neutral"
                    size="sm"
                    onClick={() => onOpenEntry(star.memoryId)}
                    disabled={!open('entry-open-action')}
                  >
                    {m.demo_entry_open_action()}
                  </Button>
                  {isTarget ? <Anchor id="recall-action">{recallButton}</Anchor> : recallButton}
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}

// Typed at this one seam so every wrap in this file is checked against the host-owned union.
function Anchor({ id, children }: { id: DemoAnchor; children: React.ReactNode }) {
  return <SequenceAnchor id={id}>{children}</SequenceAnchor>
}
