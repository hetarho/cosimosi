# policy/ux: how the universe is held (고정 · 자유)

> UX policy for the two shapes the universe camera can be held in. Owned by plan
> [23.universe-canvas](../../plan/23.universe-canvas.md); the rig that implements it is in
> [tech/rendering.md](../../tech/rendering.md). Reinforces PRD [U3][V0][V9] and [I5].

## The rules

**There are two ways to hold the universe, and the viewer says which** ([U3][V0]). **고정 모드** holds it flat:
the world's up axis stays up, the middle of the stars stays in the middle of the frame, the view tilts about 20° above
the flat and 10° below it — 30° in all — and it does not pan. Walking around it and stepping toward it is all that is
left. **자유 모드** is the unbounded tumble: any direction, past the poles, no fixed horizon.

**고정 모드 is where a viewer arrives, and it arrives level.** The depth between the two memory bands ([V9] — memories
below, their risen gists above) only reads as height while the horizon holds still; a universe first seen at a random
tumble reads as scatter. The opening view is LEVEL rather than against an edge of the allowance, so there is give in
both directions from the first moment — and the give is deliberately unequal, because the two directions are not worth
the same: rising looks down onto the band the memories lie in and across at the gists above them, which is the view
that shows the depth, while dipping only puts the near stars between the eye and everything else. 자유 모드 is one
press away. The choice is runtime-local device preference rather than account data: once changed, it survives route
changes, sign-out, and account switches while that app/web process remains alive. A reload or app restart begins a
fresh runtime in 고정 모드.

**One control says which mode it is in, in words as well as in a glyph — and it is ONE control.** It sits in the
universe's top-left corner — the space's own chrome, beside the clock rather than in the column of ways out of the
canvas — and names the mode it is currently in (고정 모드 / 자유 모드), not the one a press would bring. Over a live sky
a lone glyph is a guess, and this control changes how the whole scene answers a drag. The glyph and the word are inside
the same button rather than beside each other: a mark and a label with a gap between them read as a control next to a
caption, and the caption is then the one part of it a pointer cannot press. What hovering adds is the CONSEQUENCE —
what the other way of holding the universe would let you do — not a second copy of the name already on the button.
On native the word remains visually beside the icon, while the icon button's accessible name composes that exact
visible state word with the action a press will take; the control's selected state carries the same fact separately.

**Every icon control over the universe is round, borderless, and lit only by a shadow.** No rim and no plate: over a
live sky a bordered circle reads as a hole punched in the universe, and a column of them reads as a widget tray. What
gives a fill-less glyph its ground is a dark halo hugging the strokes — the same treatment the balance readout above
them takes its legibility from — rather than a surface the scene cannot be seen through. Each control still carries its
name for assistive tech and a tooltip on web, which design-language §8 makes mandatory the moment an icon stands
without a label. (The transparent border every control keeps for `forced-colors` is unaffected — that is structure, not
look, per [ui-principles](ui-principles.md) §5.)

**Neither mode changes what is true, only what is seen** ([I5][I11]). Position stays the force-sim's emergent output;
holding the universe flat frames it and never re-lays it out, stores a coordinate, or reorders anything.

**Clicking a star still brings the camera to it, in either mode.** What differs is the way back: in 고정 모드, letting
the star go — closing its panel, the spotlight ending — glides the camera back to the pose the viewer was looking from,
around the middle of the stars. Nothing snaps: the return is eased, and so is the righting of a horizon that a free
tumble had rolled over.
