import { ORNAMENT_GROUP_TITLES, ORNAMENT_NAMES, ornamentName } from '@cosimosi/store/i18n'
import { Sheet, cx } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
import { isDemoAnchorInteractive, type DemoRunPhase } from '../model/run-machine.ts'
import { ornamentRendererKey, type DemoTaste } from '../model/use-demo-run.ts'

export interface DemoDecorationSheetProps {
  readonly open: boolean
  readonly phase: DemoRunPhase
  readonly taste: DemoTaste
  readonly onApplyBackground: (rendererKey: string | null) => void
  readonly onApplyBodyShape: (rendererKey: string | null) => void
  readonly onApplyPalette: (on: boolean) => void
  readonly onClose: () => void
}

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
  onApplyBackground,
  onApplyBodyShape,
  onApplyPalette,
  onClose,
}: DemoDecorationSheetProps) {
  const pressable = isDemoAnchorInteractive(phase, 'decorate-action')
  const ornamentIds = Object.keys(ORNAMENT_NAMES)
  const groups = [
    {
      kind: 'BACKGROUND' as const,
      applied: taste.background,
      apply: onApplyBackground,
      ids: ornamentIds.filter((id) => id.startsWith('background.')),
    },
    {
      kind: 'STAR_SHADER' as const,
      applied: taste.bodyShape,
      apply: onApplyBodyShape,
      ids: ornamentIds.filter((id) => id.startsWith('star_shader.')),
    },
  ]

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={m.store_panel_title()}
      closeLabel={m.store_panel_close()}
    >
      <div className="flex flex-col gap-5">
        {groups.map((group) => (
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
              {group.ids.map((ornamentId) => {
                const rendererKey = ornamentRendererKey(ornamentId)
                return (
                  <DemoOrnamentRow
                    key={ornamentId}
                    label={ornamentName(ornamentId)}
                    applied={group.applied === rendererKey}
                    disabled={!pressable}
                    onApply={() => group.apply(rendererKey)}
                  />
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
