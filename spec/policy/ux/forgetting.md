# policy: forgetting (presentation)

> UX policy for how forgetting is shown. Owned by plan
> [39.forgetting-visuals](../../plan/39.forgetting-visuals.md); the domain rules are
> [policy/domain/forgetting.md](../domain/forgetting.md), the as-built rendering seams are in
> [tech/rendering.md](../../tech/rendering.md). Reinforces [I1][I2][I8] and PRD [F1][F2][R8a][D1][G1][V2].

## The rules

**Forgetting is shown, never hidden.** An episodic star not recalled in universe-time renders **dimmer** — its star-body
brightness is the real read-time `EffectiveBrightness` — and its current-memory text **loses words**, both on the star's
hover glimpse and in the star-detail panel ([F1][V2]). The diarist sees the fade; nothing is concealed.

**Dimming stops at the floor — the star never disappears.** Brightness bottoms at `rendering.star_brightness_min` (the
silent-engram floor, = `forgetting.brightness_floor`) and the text stops at its deepest decay stage; a fully-decayed star
stays renderable, never removed, never at 0 ([F2][I1]).

**The forgotten text is free to read.** Viewing the eroded current-memory text — hover glimpse and the full text in the
panel — costs nothing and spends no 별가루; only _recall_ (rewrite) is gated ([G1]). The panel shows a read-only
**forgetting-degree** meta ("현재 망각 정도") beside it ([D1]).

**The distortion is not announced.** The eroded text is shown plainly — no "this memory decayed" warning. The diarist
discovers the loss by reading ([R8a]). The hover label is a **glimpse** (a truncated current decay-stage text); the panel
is the **full read**.

**Dimming and word-loss move together.** A star reading a lower brightness also reads a deeper decay-stage text, because
both derive from the same read-time decay clock ([F1]).

**Recall recovers by re-render.** After a recall writes its anchors, the next read recomputes `EffectiveBrightness` to
full and the current decay-stage text back to whole; the star brightens and the panel/hover text fills back in — a pure
re-render. This presentation owns **no** recall write and never resets brightness or mutates text itself ([F5][I8]).

**The word-loss text is the decay representation of the current-memory text, never the Diary** ([I2]). The panel's
"원본 일기 보기" reads the untouched original elsewhere; forgetting erodes only the current representation.

**Forgetting is independent of gist/semanticization.** A decay-stage text is never a gist-stage text; this surface
renders no z-rise or gist star — those are the separate semanticization axis.

## Platform

The star-body brightness channel is the shared TSL body fed the same read-time value on web and mobile; the panel text
and forgetting-degree meta share their read logic across both apps. The **hover glimpse is web-only** — React Native has
no pointer hover, so on mobile a star's forgotten text is read by tapping it open (the panel), not by hovering (§3.5, a
genuine platform primitive difference, not a forked feature).
