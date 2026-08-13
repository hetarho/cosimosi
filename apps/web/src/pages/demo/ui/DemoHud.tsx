import { Button, DecorateIcon, ICON_SIZE_LG, IconButton, Tooltip } from '@cosimosi/ui'

import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import type { DemoAnchor } from '../model/anchors.ts'
import { isDemoAnchorInteractive, type DemoRunPhase } from '../model/run-machine.ts'
import { DemoTimeHud } from './DemoTimePassing.tsx'

export interface DemoHudProps {
  readonly phase: DemoRunPhase
  /** The clock the HUD shows — the sweep's sampled date while a jump plays. */
  readonly displayTime: string
  readonly onDraw: () => void
  readonly onAdvanceDays: (grain: 'day' | 'week' | 'month') => void
  readonly onOpenDecoration: () => void
  readonly onSignUp: () => void
  readonly onReset: () => void
}

// pages/demo ui: the HUD over the demo's sky, laid out as the home screen's own ([T6] header, one
// write action at the bottom) so a visitor who signs up meets a screen they have already used. The
// product's version composes shipped widgets; this one is a deliberate twin — the isolation closure
// puts `widgets/*` out of reach and an `isDemo` prop on the shipped HUD is the flag [I13] forbids —
// so what is shared is the SHAPE: the clock centred on the screen and out of flow, the ways out of
// the canvas as a borderless icon column against the right edge, 일기 쓰기 alone at the bottom in the
// outlined form that keeps the sky visible through it.
//
// Two things stand here that no product HUD has, and they are the demo's whole point ([Z2]): the
// time controls, parked under the clock they move because time is what this place lets you push, and
// the door out (가입 · 처음부터 다시). Two things the product HUD has are deliberately absent: the
// balance ([Z8] — no currency figure on a page that never charges) and the archive, which is a route
// the sandbox does not have — a star's own diary is read from the star itself instead.
//
// Anchoring and gating follow the same two rules as every demo surface: `SequenceAnchor` wraps one
// element at this composition site with ids from the closed union, and whether a control is
// PRESSABLE comes only from the run machine's derivation. The covering is `DemoTutorialMask`'s
// business, so this file stays plain and only disables.
export function DemoHud({
  phase,
  displayTime,
  onDraw,
  onAdvanceDays,
  onOpenDecoration,
  onSignUp,
  onReset,
}: DemoHudProps) {
  const open = (anchor: DemoAnchor) => isDemoAnchorInteractive(phase, anchor)

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
      <header className="relative flex flex-col items-end gap-3">
        {/* From `sm` up the clock is centred on the SCREEN and taken out of flow, because the
            universe's time belongs to the place rather than to a corner of it — and under it, the
            controls that move it, so pushing time reads as acting on the reading right above. On a
            phone the pair keeps left: the sequence chrome's always-visible skip owns the top edge's
            right half, and a centred reading would run under it. */}
        <div className="absolute left-0 top-0 flex flex-col items-start gap-2 sm:left-1/2 sm:w-max sm:-translate-x-1/2 sm:items-center">
          <DemoTimeHud date={displayTime} />
          <div className="pointer-events-auto flex gap-1.5">
            <TimeJump
              anchor="time-day-action"
              label={m.demo_time_day_action()}
              disabled={!open('time-day-action')}
              onPress={() => onAdvanceDays('day')}
            />
            <TimeJump
              anchor="time-week-action"
              label={m.demo_time_week_action()}
              disabled={!open('time-week-action')}
              onPress={() => onAdvanceDays('week')}
            />
            <TimeJump
              anchor="time-month-action"
              label={m.demo_time_month_action()}
              disabled={!open('time-month-action')}
              onPress={() => onAdvanceDays('month')}
            />
          </div>
        </div>
        {/* Held clear of the top edge, which the sequence chrome's always-visible skip owns on every
            width — a column starting flush with the top would sit under it while the tour runs. */}
        <div className="flex flex-col items-end gap-3 pt-11">
          {/* No rim and no plate: over a live sky a bordered circle reads as a hole punched in the
              universe. A fill-less glyph takes its ground from `drop-shadow-md`, and each control
              still carries its name in `label` and a tooltip. */}
          <div className="pointer-events-auto drop-shadow-md">
            <SequenceAnchor id={'decorate-action' satisfies DemoAnchor}>
              <Tooltip content={m.store_open_action()} side="left">
                <IconButton
                  variant="text"
                  color="neutral"
                  className="rounded-full"
                  label={m.store_open_action()}
                  icon={<DecorateIcon size={ICON_SIZE_LG} />}
                  onClick={onOpenDecoration}
                  disabled={!open('decorate-action')}
                />
              </Tooltip>
            </SequenceAnchor>
          </div>
          {/* The door out and the do-over: never highlighted, never gated, never the tour's
              destination — the closing caption names the corner and the visitor goes when they feel
              like it ([Z3]-10, [Z7]). */}
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <Button color="primary" size="sm" onClick={onSignUp}>
              {m.demo_signup_action()}
            </Button>
            <Button color="neutral" size="sm" onClick={onReset}>
              {m.demo_reset_action()}
            </Button>
          </div>
        </div>
      </header>

      {/* The one action the screen is for, so it is the biggest control on it — outlined rather than
          filled, the way the home screen carries it. */}
      <div className="pointer-events-auto mx-auto flex flex-col items-center gap-3 pb-2">
        <SequenceAnchor id={'write-action' satisfies DemoAnchor}>
          <Button
            variant="outlined"
            color="primary"
            size="lg"
            onClick={onDraw}
            disabled={!open('write-action')}
          >
            {m.universe_home_write()}
          </Button>
        </SequenceAnchor>
      </div>
    </div>
  )
}

// One time grain. Quiet by design: three filled buttons beside the clock would out-shout the one
// action the screen is for, and pushing time is something you do to look at the sky, not the point.
function TimeJump({
  anchor,
  label,
  disabled,
  onPress,
}: {
  readonly anchor: DemoAnchor
  readonly label: string
  readonly disabled: boolean
  readonly onPress: () => void
}) {
  return (
    <SequenceAnchor id={anchor}>
      <Button variant="text" color="neutral" size="sm" disabled={disabled} onClick={onPress}>
        {label}
      </Button>
    </SequenceAnchor>
  )
}
