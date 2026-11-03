import type { SequenceRect } from '@cosimosi/sequence'
import { cx } from '@cosimosi/ui'

/** A quiet focus cue; memory content and word-level forgetting remain readable beneath it. */
export function DemoTutorialMask({
  hole,
  lifted,
  focused = false,
  clearRegion,
}: {
  readonly hole: SequenceRect | null
  readonly lifted: boolean
  readonly focused?: boolean
  readonly clearRegion?: SequenceRect
}) {
  if (!hole) return null
  const x = Math.max(0, hole.x - HOLE_PADDING_PX)
  const y = Math.max(0, hole.y - HOLE_PADDING_PX)
  const width = hole.width + HOLE_PADDING_PX * 2
  const height = hole.height + HOLE_PADDING_PX * 2
  const preview = clearRegion
    ? `<rect x="${clearRegion.x}" y="${clearRegion.y}" width="${clearRegion.width}" height="${clearRegion.height}" fill="black"/>`
    : ''
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><defs><mask id="opening"><rect width="100%" height="100%" fill="white"/>${preview}<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="black"/></mask></defs><rect width="100%" height="100%" fill="white" mask="url(#opening)"/></svg>`
  const mask = `url("data:image/svg+xml,${encodeURIComponent(source)}")`
  return (
    <div
      aria-hidden
      data-demo-tutorial-mask=""
      className={cx(
        'pointer-events-none fixed inset-0 z-[var(--z-guide)] transition-opacity duration-300 motion-reduce:transition-none',
        focused ? 'bg-bg/65' : 'bg-bg/20',
        lifted && 'opacity-0',
      )}
      style={{
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: '100% 100%',
        WebkitMaskSize: '100% 100%',
      }}
    />
  )
}

const HOLE_PADDING_PX = 8
