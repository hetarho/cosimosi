import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import { STAR_FIELD_PROFILE } from './StarField.tsx'

// The backdrop is the scene's largest FIXED cost — count × mote, paid on every surface that mounts a
// universe, invisible to any gate that starts from what a memory renders. The mote's topology and the
// per-theme ceiling are pinned by the backdrop catalogue's own test; what belongs here is the one
// thing the LAYER owns: that each platform takes its own count and radius as a pair.
describe('star field platform profiles', () => {
  it('reads both densities straight from the generated config', () => {
    expect(STAR_FIELD_PROFILE.web).toEqual({
      count: VALUES.rendering.starFieldCount,
      radius: VALUES.rendering.starFieldRadius,
    })
    expect(STAR_FIELD_PROFILE.mobile).toEqual({
      count: VALUES.rendering.starFieldCountMobile,
      radius: VALUES.rendering.starFieldRadiusMobile,
    })
  })

  // The promise §3.5 makes for the native MVP, and the reason the pair exists at all.
  it('gives the native MVP the smaller instance count', () => {
    expect(STAR_FIELD_PROFILE.mobile.count).toBeLessThan(STAR_FIELD_PROFILE.web.count)
  })
})
