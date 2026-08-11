import type { SequenceRect } from '@cosimosi/sequence'
import { cx } from '@cosimosi/ui'

// pages/demo ui: the tutorial's mask — ONE layer laid over the whole page with a hole cut where
// the current beat's controls live, so everything that is not now's business reads as covered
// rather than as a page of individually faded widgets. Four strips instead of one sheet, because
// a hole cannot be cut out of a single backdrop-filtered element.
//
// Purely visual: `pointer-events: none` throughout, so the free camera keeps working under it and
// nothing gains or loses pressability here — whether a control accepts a press is the run
// machine's derivation alone, and the mask merely shows the same answer at page scale. It sits
// below the sequence chrome (`z-guide`), so the ring, the caption and the skip stay crisp on top.
//
// `lifted` fades the covering out WITHOUT unmounting it, for the moments whose whole payoff plays
// out on the covered canvas — a memory going up, a time sweep dimming the field. Unmounting would
// snap; opacity rides the strips' own transition both ways.
export function DemoTutorialMask({
  hole,
  lifted,
}: {
  readonly hole: SequenceRect | null
  readonly lifted: boolean
}) {
  if (!hole) return null

  const top = Math.max(0, hole.y - HOLE_PADDING_PX)
  const left = Math.max(0, hole.x - HOLE_PADDING_PX)
  const right = hole.x + hole.width + HOLE_PADDING_PX
  const bottom = hole.y + hole.height + HOLE_PADDING_PX

  return (
    <div aria-hidden>
      <Strip lifted={lifted} style={{ top: 0, left: 0, right: 0, height: top }} />
      <Strip lifted={lifted} style={{ top: bottom, left: 0, right: 0, bottom: 0 }} />
      <Strip lifted={lifted} style={{ top, left: 0, width: left, height: bottom - top }} />
      <Strip lifted={lifted} style={{ top, left: right, right: 0, height: bottom - top }} />
    </div>
  )
}

function Strip({
  style,
  lifted,
}: {
  readonly style: React.CSSProperties
  readonly lifted: boolean
}) {
  // Dim hard, blur lightly: the covering has to READ as a mask at a glance, and the moments worth
  // watching through it (a launch, a sweep) lift the whole layer instead of thinning it.
  return (
    <div
      className={cx(
        'pointer-events-none fixed bg-bg/80 backdrop-blur-xs transition duration-300',
        lifted && 'opacity-0',
      )}
      style={style}
    />
  )
}

// Matches the spotlight ring's stand-off, so the hole and the ring agree about the lit region.
const HOLE_PADDING_PX = 8
