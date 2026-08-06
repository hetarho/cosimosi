/**
 * The clock value an animated layer pins its time uniform to under reduced motion — the single
 * frame the scene holds still on.
 *
 * Every layer that freezes runs a looping ambient animation, so any instant is as valid as any
 * other; the one value that is NOT valid is 0, where the twinkle and noise fields all start aligned
 * and dark. Hence one shared non-zero moment rather than a per-layer knob: a layer that wants a
 * different frozen frame has a visual reason to state, not a number to pick.
 */
export const REDUCED_MOTION_FROZEN_TIME = 8
