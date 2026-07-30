import { Button, Card } from '@cosimosi/ui'

import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import type { DemoAnchor } from '../model/anchors.ts'

export interface DemoControlRailProps {
  readonly diaryBody: string
  readonly splitNames: readonly string[]
  readonly splitRevealed: boolean
  readonly launched: boolean
  readonly clock: string
  readonly onRevealSplit: () => void
  readonly onLaunch: () => void
  readonly onAddDiaries: () => void
  readonly onAdvanceClock: () => void
  readonly onRecall: () => void
  readonly onSignUp: () => void
}

// pages/demo ui: the controls the tour highlights. The visitor ACTS — a step carries no handler,
// because the engine's step model has no action field, so every beat advances because someone here
// pressed something.
//
// Each control is wrapped in `SequenceAnchor` at this composition site rather than registering
// itself. That is the rule that keeps every shipped product slice unaware a sequence exists, and it
// is also why the anchor ids are a closed union declared in `model/anchors.ts`: a control the demo
// does not own has no member to name.
//
// There is deliberately no balance, no cost, no quote and no spend gate anywhere in this rail. On a
// page that never charges anything, a currency figure would be noise at best and a payment smell at
// worst — so "unlimited stardust" is discharged by absence, not by a large number.
export function DemoControlRail({
  diaryBody,
  splitNames,
  splitRevealed,
  launched,
  clock,
  onRevealSplit,
  onLaunch,
  onAddDiaries,
  onAdvanceClock,
  onRecall,
  onSignUp,
}: DemoControlRailProps) {
  return (
    <div className="pointer-events-auto absolute inset-y-0 left-0 flex w-full max-w-sm flex-col gap-3 overflow-y-auto p-4">
      <Anchor id="diary-card">
        <Card>
          <p className="text-xs text-text-muted">{m.demo_diary_label()}</p>
          {/* The body is rendered verbatim and never rewritten — a diary is what was written. */}
          <p className="mt-2 whitespace-pre-line text-sm text-text">{diaryBody}</p>
        </Card>
      </Anchor>

      {splitRevealed && (
        <Card>
          <p className="text-xs text-text-muted">{m.demo_split_label()}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {splitNames.map((name) => (
              <li key={name} className="text-sm text-text">
                {name}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        <Anchor id="split-action">
          <Button color="primary" size="sm" onClick={onRevealSplit}>
            {m.demo_split_action()}
          </Button>
        </Anchor>
        <Anchor id="launch-action">
          <Button color="primary" size="sm" onClick={onLaunch}>
            {m.demo_launch_action()}
          </Button>
        </Anchor>
        <Anchor id="add-diaries-action">
          <Button color="primary" size="sm" onClick={onAddDiaries}>
            {m.demo_add_diaries_action()}
          </Button>
        </Anchor>
        <Anchor id="time-travel-action">
          <Button color="neutral" size="sm" onClick={onAdvanceClock}>
            {m.demo_time_travel_action()}
          </Button>
        </Anchor>
        <Anchor id="recall-action">
          <Button color="neutral" size="sm" onClick={onRecall} disabled={!launched}>
            {m.demo_recall_action()}
          </Button>
        </Anchor>
      </div>

      <p className="text-xs text-text-muted tabular-nums">{m.demo_clock_label({ date: clock })}</p>

      <Anchor id="signup-action">
        <Button color="primary" size="sm" onClick={onSignUp}>
          {m.demo_signup_action()}
        </Button>
      </Anchor>
    </div>
  )
}

// Typed at this one seam so every wrap in this file is checked against the host-owned union.
function Anchor({ id, children }: { id: DemoAnchor; children: React.ReactNode }) {
  return <SequenceAnchor id={id}>{children}</SequenceAnchor>
}
