import { positionLocal, uniform } from 'three/tsl'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three/webgpu'

import { VALUES } from '@cosimosi/config'

import {
  BACKDROP_THEMES,
  BACKDROP_TRIANGLE_CEILING,
  DEFAULT_BACKDROP_THEME,
  backdropMoteCount,
  backdropTriangleCost,
  resolveBackdropTheme,
} from './backdrop-themes.ts'
import { backdropBrightness, backdropTint } from './backdrop-life.ts'
import { backdropMoteTriangles, createBackdropMote } from './backdrop-motes.ts'
import { scatterBackdrop } from './backdrop-scatter.ts'

const WEB_COUNT = VALUES.rendering.starFieldCount
const WEB_RADIUS = VALUES.rendering.starFieldRadius

// The catalogue's contract, not its looks: every row must actually build, none may spend more than the
// backdrop's share of the frame, and a stale key must render the default rather than whatever sits
// first in the list.
describe('backdrop theme catalogue', () => {
  it('keeps every theme key unique', () => {
    const keys = BACKDROP_THEMES.map((theme) => theme.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('builds a mote geometry and a colour graph for every theme', () => {
    for (const theme of BACKDROP_THEMES) {
      const mote = createBackdropMote(theme.mote)
      expect(mote.geometry.getAttribute('position').count, theme.key).toBeGreaterThan(0)
      const inputs = { time: uniform(0), place: positionLocal.div(WEB_RADIUS) }
      expect(backdropBrightness(theme.life, inputs), theme.key).toBeDefined()
      expect(backdropTint(theme.tone, inputs), theme.key).toBeDefined()
      mote.geometry.dispose()
    }
  })

  // The backdrop is paid on every surface that mounts a universe, every frame, whether or not a single
  // memory exists — a row that reaches for density instead of the shader has to fail here rather than
  // ship an invisible per-frame cliff.
  it('keeps every theme under the fixed triangle ceiling at the web count', () => {
    for (const theme of BACKDROP_THEMES) {
      const cost = backdropTriangleCost(theme, WEB_COUNT)
      expect(cost, `${theme.key} draws ${cost} triangles`).toBeLessThanOrEqual(
        BACKDROP_TRIANGLE_CEILING,
      )
    }
  })

  it('empties the field for the theme that has no field', () => {
    expect(backdropMoteCount(resolveBackdropTheme('void'), WEB_COUNT)).toBe(0)
    expect(backdropTriangleCost(resolveBackdropTheme('void'), WEB_COUNT)).toBe(0)
  })

  it('falls back to the default theme for an unknown key', () => {
    expect(resolveBackdropTheme('no-such-theme').key).toBe(DEFAULT_BACKDROP_THEME)
  })

  // The shipped field is the reference every other row is judged against, so it stays the plain one:
  // full density, unscaled motes, and the round dot.
  it('leaves the default theme at the platform density', () => {
    const active = resolveBackdropTheme(DEFAULT_BACKDROP_THEME)
    expect(active.density).toBe(1)
    expect(active.size).toBe(1)
    expect(backdropMoteCount(active, WEB_COUNT)).toBe(WEB_COUNT)
  })
})

// The mote is the field's per-instance topology — the number the ceiling above is counted in.
describe('backdrop motes', () => {
  it('keeps the round dot at the declared subdivision, and pays only its silhouette', () => {
    const { geometry } = createBackdropMote('grain')
    expect(geometry).toBeInstanceOf(THREE.IcosahedronGeometry)
    // three builds polyhedra non-indexed: 20 × (detail + 1)² faces, three vertices each.
    const detail = VALUES.rendering.starFieldMoteDetail
    expect(geometry.getIndex()).toBeNull()
    expect(backdropMoteTriangles('grain')).toBe(20 * (detail + 1) ** 2)
    // A mote is a handful of pixels; a UV sphere of the same roundness spends 112 triangles on it.
    expect(backdropMoteTriangles('grain')).toBeLessThan(112)
    geometry.dispose()
  })

  it('draws both faces of every form that has no interior', () => {
    for (const key of ['jack', 'plate', 'bokeh'] as const) {
      const mote = createBackdropMote(key)
      expect(mote.doubleSided, key).toBe(true)
      // A hollow or flat mote reads as light only if the ones behind it show through.
      expect(mote.additive, key).toBe(true)
      mote.geometry.dispose()
    }
  })

  it('stays inside the mote radius, so one form cannot quietly outsize another', () => {
    for (const theme of BACKDROP_THEMES) {
      const { geometry } = createBackdropMote(theme.mote)
      geometry.computeBoundingSphere()
      // The directional forms reach further along their long axis by design; nothing reaches past it.
      expect(geometry.boundingSphere?.radius, theme.mote).toBeLessThanOrEqual(0.25)
      geometry.dispose()
    }
  })
})

// The scatter is the one part of the backdrop that runs on the CPU, and the one that has to agree
// across platforms: two devices showing the same universe must not disagree about the sky behind it.
describe('backdrop scatter', () => {
  it('places exactly the requested count, deterministically', () => {
    for (const theme of BACKDROP_THEMES) {
      const spec = { count: 400, radius: WEB_RADIUS, sizeScale: theme.size }
      const first = scatterBackdrop(theme.scatter, spec)
      const second = scatterBackdrop(theme.scatter, spec)
      expect(first.positions.length, theme.key).toBe(400 * 3)
      expect(first.scales.length, theme.key).toBe(400)
      expect(Array.from(first.positions), theme.key).toEqual(Array.from(second.positions))
      expect(Array.from(first.scales), theme.key).toEqual(Array.from(second.scales))
    }
  })

  it('keeps every mote inside the shell, so the backdrop stays behind the sky', () => {
    for (const theme of BACKDROP_THEMES) {
      const { positions } = scatterBackdrop(theme.scatter, { count: 600, radius: WEB_RADIUS })
      for (let i = 0; i < 600; i++) {
        const distance = Math.hypot(
          positions[i * 3] ?? 0,
          positions[i * 3 + 1] ?? 0,
          positions[i * 3 + 2] ?? 0,
        )
        expect(distance, `${theme.scatter} mote ${i}`).toBeLessThanOrEqual(WEB_RADIUS * 1.0001)
      }
    }
  })

  it('gives every mote a positive size, scaled by the theme', () => {
    const plain = scatterBackdrop('volume', { count: 200, radius: WEB_RADIUS })
    const doubled = scatterBackdrop('volume', { count: 200, radius: WEB_RADIUS, sizeScale: 2 })
    for (let i = 0; i < 200; i++) {
      expect(plain.scales[i]).toBeGreaterThan(0)
      expect(doubled.scales[i]).toBeCloseTo((plain.scales[i] ?? 0) * 2, 5)
    }
  })

  it('yields an empty field for an empty count', () => {
    const empty = scatterBackdrop('volume', { count: 0, radius: WEB_RADIUS })
    expect(empty.positions).toHaveLength(0)
    expect(empty.scales).toHaveLength(0)
  })

  // Each mode exists because it puts the motes somewhere the others do not; these pin the two whose
  // whole point is a shape the eye can name.
  it('lays the belt around one plane and the swarm close in', () => {
    const belt = scatterBackdrop('belt', { count: 500, radius: WEB_RADIUS })
    for (let i = 0; i < 500; i++) {
      expect(Math.abs(belt.positions[i * 3 + 1] ?? 0)).toBeLessThan(WEB_RADIUS * 0.2)
    }
    const swarm = scatterBackdrop('swarm', { count: 500, radius: WEB_RADIUS })
    for (let i = 0; i < 500; i++) {
      const distance = Math.hypot(
        swarm.positions[i * 3] ?? 0,
        swarm.positions[i * 3 + 1] ?? 0,
        swarm.positions[i * 3 + 2] ?? 0,
      )
      expect(distance).toBeLessThan(WEB_RADIUS * 0.6)
    }
  })
})
