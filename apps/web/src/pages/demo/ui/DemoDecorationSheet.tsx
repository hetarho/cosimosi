import { ORNAMENT_GROUP_TITLES, ORNAMENT_NAMES, ornamentName } from '@cosimosi/store/i18n'
import { Button, Sheet, cx, useReducedMotion } from '@cosimosi/ui'

import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { awaitArrival } from '../../../shared/lib/measure-arrival.ts'
import {
  decorationTourAnchor,
  differentDecorationExample,
  type DecorationTourStage,
} from '../model/decoration-tour.ts'
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
  /** False while the decorating beat still needs an actual sky or body change: the way out of a
   *  surface a tutorial step is staged inside stays inert until the step's own work is done, exactly
   *  as the writing sheet's dismiss does. */
  readonly canClose: boolean
  readonly tourStage?: DecorationTourStage | null
  readonly onTargetReady?: () => void
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
  tourStage = null,
  onTargetReady,
  onApplyOrnament,
  onApplyPalette,
  onClose,
}: DemoDecorationSheetProps) {
  // The ring walks through the catalogue while alternatives remain available. During guidance,
  // the currently resolved look is disabled so a no-op cannot masquerade as the requested change.
  const pressable = isDemoAnchorInteractive(phase, 'ornament-row-action')
  const contents = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const ornamentIds = Object.keys(ORNAMENT_NAMES)
  const groups = DEMO_GROUPS.map((group) => ({
    kind: group.kind,
    applied: taste[group.surface],
    actual:
      taste[group.surface] ??
      (group.surface === 'background'
        ? DEFAULT_SKY_EFFECT
        : group.surface === 'bodyShape'
          ? DEFAULT_STAR_SHAPE
          : null),
    fallback:
      group.surface === 'background'
        ? DEFAULT_SKY_EFFECT
        : group.surface === 'bodyShape'
          ? DEFAULT_STAR_SHAPE
          : null,
    apply: (rendererKey: string | null) => onApplyOrnament(group.surface, rendererKey),
    ids: ornamentIds.filter((id) => id.startsWith(group.prefix)),
  }))
  const skyExample = differentDecorationExample(
    groups[0]!.ids.map(ornamentRendererKey),
    groups[0]!.actual!,
    'soft-aurora',
  )
  const shapeExample = differentDecorationExample(
    groups[1]!.ids.map(ornamentRendererKey),
    groups[1]!.actual!,
    'orb',
  )
  useEffect(() => {
    if (!open || !tourStage || tourStage === 'sky-preview') return
    let live = true
    let frame = 0
    const reveal = async () => {
      const panel = contents.current?.closest('[data-cosimosi-surface]')
      if (!panel) return
      await awaitArrival(panel)
      if (!live) return
      const anchor = decorationTourAnchor(tourStage)
      const target = panel.querySelector(`[data-sequence-anchor="${anchor}"] button`)
      if (!target) return
      let scroller = target.parentElement
      while (
        scroller &&
        scroller !== panel &&
        !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)
      )
        scroller = scroller.parentElement
      if (scroller && scroller !== panel && scroller.scrollHeight > scroller.clientHeight) {
        const box = target.getBoundingClientRect()
        const bounds = scroller.getBoundingClientRect()
        scroller.scrollTo({
          top: scroller.scrollTop + box.top - bounds.top - (bounds.height - box.height) / 2,
          behavior: reducedMotion ? 'instant' : 'smooth',
        })
        let last = scroller.scrollTop
        let settled = 0
        const check = () => {
          if (!live) return
          const current = scroller!.scrollTop
          settled = Math.abs(current - last) < 0.5 ? settled + 1 : 0
          last = current
          if (settled < 3) frame = requestAnimationFrame(check)
          else onTargetReady?.()
        }
        frame = requestAnimationFrame(check)
      } else onTargetReady?.()
    }
    void reveal()
    window.addEventListener('resize', reveal)
    return () => {
      live = false
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', reveal)
    }
  }, [open, tourStage, skyExample, shapeExample, reducedMotion, onTargetReady])

  return (
    <Sheet
      open={open}
      onClose={onClose}
      closeDisabled={!canClose}
      size={tourStage ? 'compact' : 'standard'}
      title={m.store_panel_title()}
      closeLabel={m.store_panel_close()}
      footer={
        <SequenceAnchor id={'decorate-close-action' satisfies DemoAnchor}>
          <Button color="primary" disabled={!canClose} onClick={onClose}>
            {m.demo_decorate_done_action()}
          </Button>
        </SequenceAnchor>
      }
    >
      <div
        ref={contents}
        className="flex flex-col gap-5"
        data-demo-decoration-stage={tourStage ?? 'free'}
      >
        {groups.map((group, groupIndex) => (
          <section key={group.kind} aria-label={ORNAMENT_GROUP_TITLES[group.kind]()}>
            <h3 className="px-3 pb-1 text-xs font-medium tracking-wide text-text-muted">
              {ORNAMENT_GROUP_TITLES[group.kind]()}
            </h3>
            <ul className="flex flex-col">
              <DemoOrnamentRow
                label={
                  group.fallback
                    ? m.demo_decorate_default_named({
                        name: ornamentName(`${DEMO_GROUPS[groupIndex]!.prefix}${group.fallback}`),
                      })
                    : m.demo_decorate_default()
                }
                applied={group.applied === null}
                disabled={!pressable || (!!tourStage && group.applied === null)}
                onApply={() => group.apply(null)}
              />
              {group.ids.map((ornamentId) => {
                const rendererKey = ornamentRendererKey(ornamentId)
                const row = (
                  <DemoOrnamentRow
                    key={ornamentId}
                    label={ornamentName(ornamentId)}
                    applied={group.applied === rendererKey}
                    disabled={!pressable || (!!tourStage && group.actual === rendererKey)}
                    onApply={() => group.apply(rendererKey)}
                  />
                )
                // One different example per guided group; the anchor is never duplicated and
                // never points at the already displayed look.
                const anchor: DemoAnchor | null =
                  groupIndex === 0 && rendererKey === skyExample
                    ? 'ornament-row-action'
                    : groupIndex === 1 && rendererKey === shapeExample
                      ? 'ornament-shape-action'
                      : null
                return anchor ? (
                  <SequenceAnchor key={ornamentId} id={anchor}>
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
import { useEffect, useRef } from 'react'
import { DEFAULT_SKY_EFFECT, DEFAULT_STAR_SHAPE } from '@cosimosi/3d-renderer'
