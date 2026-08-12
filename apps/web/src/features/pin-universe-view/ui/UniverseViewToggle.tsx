import {
  FreeViewIcon,
  IconButton,
  PinnedViewIcon,
  Tooltip,
  type IconButtonProps,
} from '@cosimosi/ui'
import { useUniverseViewStore } from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'

export interface UniverseViewToggleProps {
  /** Web-only affordance sizing; the HUD's other controls default to `md` alongside it. */
  size?: IconButtonProps['size']
}

// features/pin-universe-view: the one control that says how the universe is being held — 고정 모드
// (flat, centred on the stars, only so much give in the tilt) or 자유 모드 (turn it any way at all).
// It writes the shared view store and nothing else; the camera reads that store inside the canvas,
// which is why no prop, actor, or callback runs between the two (React context does not cross the
// R3F reconciler).
//
// The glyph says which mode is ON rather than which one a press would bring, and the word beside it
// says the same thing again — over a live sky an icon alone is a guess, and this control changes how
// the whole scene answers a drag, which is too much to leave to one glyph. `aria-pressed` carries
// the state a sighted viewer gets from the fill, and the accessible name is the ACTION, so the
// button still announces what pressing it does.
export function UniverseViewToggle({ size = 'md' }: UniverseViewToggleProps) {
  const mode = useUniverseViewStore((state) => state.mode)
  const toggle = useUniverseViewStore((state) => state.toggle)
  const pinned = mode === 'pinned'
  const action = pinned ? m.universe_view_free_action() : m.universe_view_pin_action()

  return (
    <div className="pointer-events-auto flex items-center gap-2 drop-shadow-md">
      <Tooltip content={action} side="bottom">
        <IconButton
          variant="outlined"
          color="neutral"
          size={size}
          label={action}
          aria-pressed={pinned}
          icon={pinned ? <PinnedViewIcon /> : <FreeViewIcon />}
          onClick={toggle}
        />
      </Tooltip>
      {/* Reads as the state, not as a second button: bare type on the sky, the same way the
          universe's own clock is written across from it. */}
      <span aria-hidden className="text-xs text-text-muted">
        {pinned ? m.universe_view_pinned() : m.universe_view_free()}
      </span>
    </div>
  )
}
