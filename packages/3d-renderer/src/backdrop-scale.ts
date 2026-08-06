// The backdrop nests, and every layer of it must stay in this order (tech/rendering.md):
//
//   camera zoom-out limit < StarField shell < SkySphere radius < canvas far plane
//
// Each `<` is load-bearing. A camera that outruns the star shell sees the field as a ball hanging in
// the middle of the frame instead of a sky around it; a camera that leaves the sky sphere loses the
// background entirely (it is painted on the sphere's INNER face); and a sky beyond the far plane is
// clipped into a growing hole straight ahead as you pull back.
//
// The two ends of the ordering live elsewhere — the zoom-out limit with the rigs, the shell radius
// in `rendering.star_field_radius[_mobile]` — so these two are named here rather than left as bare
// defaults in the components: `universe-render/backdrop-scale.test` walks all four as one chain, and the web
// and native canvas hosts must not drift to different far planes.

/** Default radius of the enclosing emotion sky sphere. */
export const SKY_SPHERE_RADIUS = 700

/** Default camera far clip plane. R3F's own default (1000) is too near for the enclosing sky. */
export const UNIVERSE_CANVAS_FAR = 1400
