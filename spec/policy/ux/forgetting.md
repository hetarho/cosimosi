# policy: forgetting (presentation)

> UX policy for how forgetting is shown. Owned by plan
> [39.forgetting-visuals](../../plan/39.forgetting-visuals.md); the domain rules are
> [policy/domain/forgetting.md](../domain/forgetting.md), the as-built rendering seams are in
> [tech/rendering.md](../../tech/rendering.md). Reinforces [I1][I2][I8] and PRD [F1][F2][R8a][D1][G1][V2].

## The rules

**Forgetting is shown, never hidden.** An episodic star not recalled in universe-time renders **dimmer** — its star-body
brightness is the real read-time `EffectiveBrightness` — and its current-memory text **loses words** in the star-detail
panel ([F1][V2]). The diarist sees the fade; nothing is concealed.

**A star's forgotten text is read one way: by opening it.** The panel is where the eroded current-memory text is read;
the canvas carries no second, shorter rendering of it. One reading path is also what keeps the two platforms the
same — a canvas glimpse could exist on only one of them.

**Dimming stops at the floor — the star never disappears.** Brightness bottoms at `rendering.star_brightness_min` (the
silent-engram floor, = `forgetting.brightness_floor`) and the text stops at its deepest decay stage; a fully-decayed star
stays renderable, never removed, never at 0 ([F2][I1]).

**The forgotten text is free to read.** Viewing the eroded current-memory text in the panel costs nothing and spends no
별가루; only _recall_ (rewrite) is gated ([G1]). The panel shows a read-only **forgetting-degree** meta ("현재 망각
정도") beside it ([D1]).

**A lost word is a smear, not a mark.** The stored text marks a removed word with the redaction token — that token is
the domain's record that a word stood there, and it is never what the reader sees. A lost run is drawn as a **blur**
over it, with consecutive losses coalesced into one run so a long erasure reads as a single smear; the words forgetting
took are never reconstructed to be hidden. The loss is seen, not decoded ([R8a][F2]).

**The distortion is not announced.** The eroded text is shown plainly — no "this memory decayed" warning, no label, no
count of what went. The diarist discovers the loss by reading ([R8a]). The smeared runs stay **in the accessibility
tree** carrying the marker, so a reader listening to the passage hears the loss exactly where a reader looking at it
sees it.

**Dimming and word-loss move together.** A star reading a lower brightness also reads a deeper decay-stage text, because
both derive from the same read-time decay clock ([F1]).

**Recall recovers by re-render.** After a recall writes its anchors, the next read recomputes `EffectiveBrightness` to
full and the current decay-stage text back to whole; the star brightens and the panel text fills back in — a pure
re-render. This presentation owns **no** recall write and never resets brightness or mutates text itself ([F5][I8]).

**The word-loss text is the decay representation of the current-memory text, never the Diary** ([I2]). The panel's
"원본 일기 보기" reads the untouched original elsewhere; forgetting erodes only the current representation.

**Forgetting is independent of gist/semanticization.** A decay-stage text is never a gist-stage text; this surface
renders no z-rise or gist star — those are the separate semanticization axis.

## Platform

The star-body brightness channel is the shared TSL body fed the same read-time value on web and mobile; the panel text
and forgetting-degree meta share their read logic and their resolved runs across both apps, and a star's forgotten text
is reached the same way on each — by opening it. The one fork is the primitive that **draws** a lost run: the web blurs
it, and React Native, which has no CSS `filter`, drops the run's ink to transparent behind a wide zero-offset text
shadow (§3.5, a genuine platform primitive difference, not a forked feature). Forced colours on the web strip `filter`
too, so there the run becomes a solid bar of system ink — the same fact, drawn with what the mode allows.
