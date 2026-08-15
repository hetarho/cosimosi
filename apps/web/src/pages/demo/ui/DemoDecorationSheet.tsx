import { ORNAMENT_GROUP_TITLES, ORNAMENT_NAMES, ornamentName } from '@cosimosi/store/i18n'
import { Sheet, cx } from '@cosimosi/ui'

import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import type { DemoAnchor } from '../model/anchors.ts'
import { isDemoAnchorInteractive, type DemoRunPhase } from '../model/run-machine.ts'
import {
  ornamentRendererKey,
  type DemoTaste,
  type DemoTasteOrnament,
} from '../model/use-demo-run.ts'

export interface DemoDecorationSheetProps {
  readonly open: boolean
  readonly phase: DemoRunPhase
  readonly taste: DemoTaste
  /** False while the decorating beat is still waiting for something to be tried on: the way out of a
   *  surface a tutorial step is staged inside stays inert until the step's own work is done, exactly
   *  as the writing sheet's dismiss does. */
  readonly canClose: boolean
  /** One handler for every group rather than one per kind: the group list is derived from the
   *  catalog below, so a kind added there must not also need a prop added here. */
  readonly onApplyOrnament: (surface: DemoTasteOrnament, rendererKey: string | null) => void
  readonly onApplyPalette: (on: boolean) => void
  readonly onClose: () => void
}

/**
 * The groups, in the panel's order: which kind, which id prefix its rows carry, and which taste
 * field the choice lands in.
 *
 * The kinds are named here rather than read off `ORNAMENT_GROUP_TITLES`'s keys because each one has
 * to be bound to a taste field anyway, and a derived list with a hand-kept binding beside it would
 * be the same table written twice. The `satisfies` is what keeps it honest: a kind the shipped panel
 * groups by and this list forgot is a type error at the title lookup, not a silently missing group.
 */
const DEMO_GROUPS = [
  { kind: 'BACKGROUND', prefix: 'background.', surface: 'background' },
  { kind: 'STAR_SHADER', prefix: 'star_shader.', surface: 'bodyShape' },
  { kind: 'GIST_SHADER', prefix: 'gist_shader.', surface: 'summaryShape' },
  // `mote.` and `mote_field.` are distinct prefixes precisely because the dot is part of them: a
  // mote-field id never starts with the mote's prefix, so the two filters cannot overlap.
  { kind: 'MOTE', prefix: 'mote.', surface: 'mote' },
  { kind: 'MOTE_FIELD', prefix: 'mote_field.', surface: 'moteField' },
] as const satisfies readonly {
  readonly kind: keyof typeof ORNAMENT_GROUP_TITLES
  readonly prefix: string
  readonly surface: DemoTasteOrnament
}[]

// pages/demo ui: 우주 꾸미기, in the PRODUCT's shapes — the same Sheet, the same group headings,
// the same full catalog of names, apply-on-select against the live universe beside it. Like the
// writing sheet it is a deliberate read-only twin rather than a reuse of `widgets/decoration-panel`:
// that widget is fused to the catalog Query, the preview/save machine and the balance — the very
// surfaces the isolation closure bans. What the twin drops is exactly the money: no price column,
// no shortfall line, no save footer — a selection simply IS the sky now, which is the honest
// version of "unlimited stardust" ([Z8] discharged by absence).
//
// The names come from `@cosimosi/store/i18n` — deliberately the SUBPATH: it exports the id→name map
// and the group titles and nothing else, so no price function rides in with it, and the row list is
// the same full catalog the signed-in panel shows (both are checked against the renderer
// registries). A `기본` row heads each group because an application here persists — with no revert
// machine, the way back to the bare sky has to be a row too.
export function DemoDecorationSheet({
  open,
  phase,
  taste,
  canClose,
  onApplyOrnament,
  onApplyPalette,
  onClose,
}: DemoDecorationSheetProps) {
  // The rows answer to the ROW anchor, not to the button that opened the sheet: the decorating beat
  // walks its ring in here, and the whole catalog stays pressable while it does — the ring points at
  // one row as the example, it does not narrow the beat to that row.
  const pressable = isDemoAnchorInteractive(phase, 'ornament-row-action')
  const ornamentIds = Object.keys(ORNAMENT_NAMES)
  const groups = DEMO_GROUPS.map((group) => ({
    kind: group.kind,
    applied: taste[group.surface],
    apply: (rendererKey: string | null) => onApplyOrnament(group.surface, rendererKey),
    ids: ornamentIds.filter((id) => id.startsWith(group.prefix)),
  }))

  return (
    <Sheet
      open={open}
      onClose={onClose}
      closeDisabled={!canClose}
      title={m.store_panel_title()}
      closeLabel={m.store_panel_close()}
    >
      <div className="flex flex-col gap-5">
        {groups.map((group, groupIndex) => (
          <section key={group.kind} aria-label={ORNAMENT_GROUP_TITLES[group.kind]()}>
            <h3 className="px-3 pb-1 text-xs font-medium tracking-wide text-text-muted">
              {ORNAMENT_GROUP_TITLES[group.kind]()}
            </h3>
            <ul className="flex flex-col">
              <DemoOrnamentRow
                label={m.demo_decorate_default()}
                applied={group.applied === null}
                disabled={!pressable}
                onApply={() => group.apply(null)}
              />
              {group.ids.map((ornamentId, rowIndex) => {
                const rendererKey = ornamentRendererKey(ornamentId)
                const row = (
                  <DemoOrnamentRow
                    key={ornamentId}
                    label={ornamentName(ornamentId)}
                    applied={group.applied === rendererKey}
                    disabled={!pressable}
                    onApply={() => group.apply(rendererKey)}
                  />
                )
                // The one row the beat's ring can point at: the first real background, whose change
                // the whole sky answers — an anchor on every row would register the id many times,
                // and one on the 기본 row would highlight "change nothing".
                return groupIndex === 0 && rowIndex === 0 ? (
                  <SequenceAnchor key={ornamentId} id={'ornament-row-action' satisfies DemoAnchor}>
                    {row}
                  </SequenceAnchor>
                ) : (
                  row
                )
              })}
            </ul>
          </section>
        ))}

        {/* A feeling's colour is free and has its own surface in the real product — the shipped
            panel only points there. The demo has no 나 page, so the taste lives here as one more
            group, styled like the rest and equally priceless. */}
        <section aria-label={m.demo_taster_palette_action()}>
          <h3 className="px-3 pb-1 text-xs font-medium tracking-wide text-text-muted">
            {m.demo_taster_palette_action()}
          </h3>
          <ul className="flex flex-col">
            <DemoOrnamentRow
              label={m.demo_decorate_default()}
              applied={!taste.palette}
              disabled={!pressable}
              onApply={() => onApplyPalette(false)}
            />
            <DemoOrnamentRow
              label={m.demo_decorate_palette_alt()}
              applied={taste.palette}
              disabled={!pressable}
              onApply={() => onApplyPalette(true)}
            />
          </ul>
        </section>
      </div>
    </Sheet>
  )
}

// One catalog row, the product row's look with the price column simply absent — the "지금" tag is
// the only thing left to say about a selection, exactly as the shipped row shows it for a free item.
function DemoOrnamentRow({
  label,
  applied,
  disabled,
  onApply,
}: {
  readonly label: string
  readonly applied: boolean
  readonly disabled: boolean
  readonly onApply: () => void
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={applied ? 'true' : undefined}
        disabled={disabled}
        onClick={onApply}
        className={cx(
          'flex w-full items-baseline justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-hover disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          applied ? 'bg-surface-hover text-text' : 'text-text-muted',
        )}
      >
        <span className="truncate">{label}</span>
        <span className="shrink-0 text-xs tabular-nums text-text-muted">
          {applied ? m.store_applied_now() : null}
        </span>
      </button>
    </li>
  )
}
