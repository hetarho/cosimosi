import { describe, expect, it } from 'vitest'

import { SKY_SPHERE_RADIUS, UNIVERSE_CANVAS_FAR } from '@cosimosi/3d-renderer'
import { UNIVERSE_CAMERA_RIG } from '@cosimosi/universe'

import { UNIVERSE_BACKDROP } from './UniverseSceneLayers.tsx'

// The one place all four numbers of the backdrop nesting invariant meet — the camera rig lives in
// @cosimosi/universe, the shell radius in generated config, the sky and the far plane in the
// renderer. Nothing else compares them, so a radius tuned in values.yaml can pass every other gate
// and still open the scene onto a hole. Both platform profiles are pinned: mobile carries its own
// count and its own radius, and a mobile-only camera envelope must not slip past this.
describe('backdrop scale ordering', () => {
  for (const [platform, profile] of Object.entries(UNIVERSE_BACKDROP)) {
    it(`nests the ${platform} backdrop inside the camera envelope and the far plane`, () => {
      const chain = [
        UNIVERSE_CAMERA_RIG.maxDistance,
        profile.starField.radius,
        SKY_SPHERE_RADIUS,
        UNIVERSE_CANVAS_FAR,
      ]
      for (let i = 1; i < chain.length; i++) {
        expect(chain[i], `${platform} step ${i}: ${chain[i - 1]} < ${chain[i]}`).toBeGreaterThan(
          chain[i - 1]!,
        )
      }
    })
  }

  it('gives the native MVP the cheaper backdrop', () => {
    expect(UNIVERSE_BACKDROP.mobile.starField.count).toBeLessThan(
      UNIVERSE_BACKDROP.web.starField.count,
    )
    expect(UNIVERSE_BACKDROP.mobile.latentSegments).toBeLessThan(
      UNIVERSE_BACKDROP.web.latentSegments,
    )
  })
})
