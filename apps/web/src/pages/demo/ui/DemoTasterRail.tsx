import type { DemoOrnamentTaste } from '@cosimosi/demo'
import { Button, Card } from '@cosimosi/ui'

import { SequenceAnchor } from '../../../features/highlight-next-control/index.ts'
import { m } from '../../../shared/i18n/index.ts'

export interface DemoTasterRailProps {
  readonly tastes: readonly DemoOrnamentTaste[]
  readonly paletteTasted: boolean
  readonly onTasteBackground: (ornamentId: string) => void
  readonly onTasteBodyShape: (ornamentId: string) => void
  readonly onTastePalette: () => void
}

// pages/demo ui: beat 9. It shows what a decorated universe LOOKS like and never what it costs.
//
// [Z8] holds structurally here, not by review: the rail receives catalog **ids** and nothing else, so
// there is no price table, no ownership row, no unowned total and no `Decorate` reachable from this
// file. It also deliberately does not use the decoration panel's preview store — that store is
// coupled to the save flow and the unowned total, i.e. to a price. The selection lives in the page's
// own model instead, which is what keeps `packages/store` ignorant that a demo exists.
export function DemoTasterRail({
  tastes,
  paletteTasted,
  onTasteBackground,
  onTasteBodyShape,
  onTastePalette,
}: DemoTasterRailProps) {
  const background = tastes.find((taste) => taste.kind === 'BACKGROUND')
  const bodyShape = tastes.find((taste) => taste.kind === 'STAR_SHADER')

  return (
    <SequenceAnchor id="taster-rail">
      <Card>
        <p className="text-xs text-text-muted">{m.demo_taster_label()}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {background && (
            <Button
              color="neutral"
              size="sm"
              onClick={() => onTasteBackground(background.ornamentId)}
            >
              {m.demo_taster_background_action()}
            </Button>
          )}
          {bodyShape && (
            <Button
              color="neutral"
              size="sm"
              onClick={() => onTasteBodyShape(bodyShape.ornamentId)}
            >
              {m.demo_taster_body_action()}
            </Button>
          )}
          {/* A feeling's colour is free and is not decoration — it has its own surface in the real
              product — so it sits beside the two catalog kinds rather than inside them. */}
          <Button color="neutral" size="sm" onClick={onTastePalette} aria-pressed={paletteTasted}>
            {m.demo_taster_palette_action()}
          </Button>
        </div>
      </Card>
    </SequenceAnchor>
  )
}
