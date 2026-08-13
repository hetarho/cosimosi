import {
  Button,
  FreeViewIcon,
  PinnedViewIcon,
  Tooltip,
  VisuallyHidden,
  type ButtonProps,
} from '@cosimosi/ui'
import { useUniverseViewStore } from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'

export interface UniverseViewToggleProps {
  /** Web-only affordance sizing; a labelled chip on the sky wants the small cut by default. */
  size?: ButtonProps['size']
}

// features/pin-universe-view: the one control that says how the universe is being held — 고정 모드
// (flat, centred on the stars, only so much give in the tilt) or 자유 모드 (turn it any way at all).
// It writes the shared view store and nothing else; the camera reads that store inside the canvas,
// which is why no prop, actor, or callback runs between the two (React context does not cross the
// R3F reconciler).
//
// ONE control, glyph and word inside the same button: a mark beside a caption reads as two things,
// and the caption is then the half of it a pointer cannot press. The word says which mode is ON
// rather than which one a press would bring — over a live sky an icon alone is a guess, and this
// control changes how the whole scene answers a drag. `aria-pressed` carries that state for a reader
// who never sees the fill.
//
// What pressing DOES is added to the name in a hidden run rather than replacing it with `aria-label`:
// the mode is now printed on the control, and a name that dropped the visible word would leave anyone
// driving the page by voice saying a label the button does not answer to (WCAG 2.5.3). So the name is
// the state AND the action — "고정 모드, 자유 모드로 보기" — which is also the only reading that tells a
// screen-reader user both things this one button holds.
//
// The tooltip is the CONSEQUENCE, not the name: the button already carries the mode in words, and a
// tip repeating what is printed on the control is a tip that teaches nothing. What a viewer cannot
// see is what the other way of holding the universe would let them do.
//
// Borderless and pill-shaped like the rest of the HUD's controls: its ground is the `drop-shadow-md`
// hugging the glyph and the word, not a rim — over a live sky a bordered chip reads as a hole cut in
// the universe.
export function UniverseViewToggle({ size = 'sm' }: UniverseViewToggleProps) {
  const mode = useUniverseViewStore((state) => state.mode)
  const toggle = useUniverseViewStore((state) => state.toggle)
  const pinned = mode === 'pinned'
  const action = pinned ? m.universe_view_free_action() : m.universe_view_pin_action()
  const consequence = pinned ? m.universe_view_free_hint() : m.universe_view_pin_hint()

  return (
    <div className="pointer-events-auto drop-shadow-md">
      <Tooltip content={consequence} side="bottom" align="start" wrap>
        <Button
          variant="text"
          color="neutral"
          size={size}
          className="gap-1.5 rounded-full px-2.5"
          aria-pressed={pinned}
          leadingIcon={pinned ? <PinnedViewIcon /> : <FreeViewIcon />}
          onClick={toggle}
        >
          {pinned ? m.universe_view_pinned() : m.universe_view_free()}
          <VisuallyHidden>{action}</VisuallyHidden>
        </Button>
      </Tooltip>
    </div>
  )
}
