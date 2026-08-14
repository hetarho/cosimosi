import { positionLocal, uniform } from 'three/tsl'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three/webgpu'

import { VALUES } from '@cosimosi/config'

import {
  BACKDROP_THEMES,
  BACKDROP_TRIANGLE_CEILING,
  DEFAULT_BACKDROP_THEME,
  backdropTriangleCost,
  resolveBackdropTheme,
} from './backdrop-themes.ts'
import {
  BACKDROP_FIELDS,
  DEFAULT_BACKDROP_FIELD,
  backdropMoteCount,
  resolveBackdropField,
} from './backdrop-fields.ts'
import { backdropBrightness, backdropTint } from './backdrop-life.ts'
import {
  BACKDROP_MOTES,
  DEFAULT_BACKDROP_MOTE,
  backdropMoteFormTriangles,
  backdropMoteTriangles,
  createBackdropMoteForm,
  resolveBackdropMote,
} from './backdrop-motes.ts'
import { scatterBackdrop } from './backdrop-scatter.ts'

const WEB_COUNT = VALUES.rendering.starFieldCount
const WEB_RADIUS = VALUES.rendering.starFieldRadius
const graphInputs = () => ({ time: uniform(0), place: positionLocal.div(WEB_RADIUS) })

// A mote is one particle — its form, its size and its colour — and the catalogue's contract is that
// every row of the three actually builds and stays inside the size band a mote is legible in.
describe('backdrop mote catalogue', () => {
  it('keeps every mote key unique', () => {
    const keys = BACKDROP_MOTES.map((mote) => mote.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('builds a geometry and a colour graph for every mote', () => {
    for (const mote of BACKDROP_MOTES) {
      const form = createBackdropMoteForm(mote.form)
      expect(form.geometry.getAttribute('position').count, mote.key).toBeGreaterThan(0)
      expect(backdropTint(mote.tone, graphInputs()), mote.key).toBeDefined()
      form.geometry.dispose()
    }
  })

  // Below the floor the field is invisible; above the ceiling the decoration starts competing with the
  // universe's own stars, which is the one thing the backdrop may never do.
  it('keeps every mote inside the size band a particle reads in', () => {
    for (const mote of BACKDROP_MOTES) {
      expect(mote.size, mote.key).toBeGreaterThanOrEqual(0.25)
      expect(mote.size, mote.key).toBeLessThanOrEqual(2.5)
    }
  })

  it('stays inside the mote radius, so one form cannot quietly outsize another', () => {
    for (const mote of BACKDROP_MOTES) {
      const { geometry } = createBackdropMoteForm(mote.form)
      geometry.computeBoundingSphere()
      // The directional forms reach further along their long axis by design; nothing reaches past it.
      expect(geometry.boundingSphere?.radius, mote.form).toBeLessThanOrEqual(0.25)
      geometry.dispose()
    }
  })

  it('falls back to the default mote for an unknown key', () => {
    expect(resolveBackdropMote('no-such-mote').key).toBe(DEFAULT_BACKDROP_MOTE)
  })

  it('leaves the default mote plain: the round dot at its own size', () => {
    const mote = resolveBackdropMote(DEFAULT_BACKDROP_MOTE)
    expect(mote.form).toBe('grain')
    expect(mote.size).toBe(1)
  })
})

// The form is the field's per-instance topology — the number the triangle ceiling is counted in.
describe('backdrop mote forms', () => {
  it('keeps the round dot at the declared subdivision, and pays only its silhouette', () => {
    const { geometry } = createBackdropMoteForm('grain')
    expect(geometry).toBeInstanceOf(THREE.IcosahedronGeometry)
    // three builds polyhedra non-indexed: 20 × (detail + 1)² faces, three vertices each.
    const detail = VALUES.rendering.starFieldMoteDetail
    expect(geometry.getIndex()).toBeNull()
    expect(backdropMoteFormTriangles('grain')).toBe(20 * (detail + 1) ** 2)
    // A mote is a handful of pixels; a UV sphere of the same roundness spends 112 triangles on it.
    expect(backdropMoteFormTriangles('grain')).toBeLessThan(112)
    geometry.dispose()
  })

  // The ball is the one form bought for its roundness rather than its silhouette, so it costs more
  // than the dot by exactly one subdivision — the reason it belongs to fields that place few motes.
  it('pays one subdivision more for the ball than for the dot', () => {
    expect(backdropMoteFormTriangles('orb')).toBe(backdropMoteFormTriangles('grain') * 4)
  })

  it('draws both faces of every form that has no interior', () => {
    for (const key of ['jack', 'plate', 'bokeh'] as const) {
      const form = createBackdropMoteForm(key)
      expect(form.doubleSided, key).toBe(true)
      // A hollow or flat mote reads as light only if the ones behind it show through.
      expect(form.additive, key).toBe(true)
      form.geometry.dispose()
    }
  })
})

// A field is the space: where the motes sit, how many there are, and how their light moves.
describe('backdrop field catalogue', () => {
  it('keeps every field key unique', () => {
    const keys = BACKDROP_FIELDS.map((field) => field.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('builds a brightness graph for every field, bent by its own twinkle', () => {
    for (const field of BACKDROP_FIELDS) {
      const brightness = backdropBrightness(field.life, graphInputs(), {
        rate: field.twinkleRate,
        depth: field.twinkleDepth,
      })
      expect(brightness, field.key).toBeDefined()
    }
  })

  it('keeps density and twinkle inside their declared ranges', () => {
    for (const field of BACKDROP_FIELDS) {
      expect(field.density, field.key).toBeGreaterThanOrEqual(0)
      expect(field.twinkleRate, field.key).toBeGreaterThan(0)
      expect(field.twinkleDepth, field.key).toBeGreaterThanOrEqual(0)
      expect(field.twinkleDepth, field.key).toBeLessThanOrEqual(1)
    }
  })

  // Absence is a row, not an error state: a universe wearing it renders no field at all.
  it('empties the shell for the field that has no motes', () => {
    expect(backdropMoteCount(resolveBackdropField('empty'), WEB_COUNT)).toBe(0)
  })

  it('falls back to the default field for an unknown key', () => {
    expect(resolveBackdropField('no-such-field').key).toBe(DEFAULT_BACKDROP_FIELD)
  })

  it('leaves the default field at the platform density', () => {
    const field = resolveBackdropField(DEFAULT_BACKDROP_FIELD)
    expect(field.density).toBe(1)
    expect(backdropMoteCount(field, WEB_COUNT)).toBe(WEB_COUNT)
  })
})

// A named theme is one row from each catalogue and nothing else — the pairs a product surface may
// wear, which is why the triangle ceiling binds here rather than over the free product of the two.
describe('backdrop themes', () => {
  it('keeps every theme key unique', () => {
    const keys = BACKDROP_THEMES.map((theme) => theme.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('names a real mote and a real field in every pair', () => {
    for (const theme of BACKDROP_THEMES) {
      expect(resolveBackdropMote(theme.mote).key, theme.key).toBe(theme.mote)
      expect(resolveBackdropField(theme.field).key, theme.key).toBe(theme.field)
    }
  })

  // The backdrop is paid on every surface that mounts a universe, every frame, whether or not a single
  // memory exists — a pair that reaches for density AND topology has to fail here rather than ship an
  // invisible per-frame cliff.
  it('keeps every named pair under the fixed triangle ceiling at the web count', () => {
    for (const theme of BACKDROP_THEMES) {
      const cost = backdropTriangleCost(
        resolveBackdropMote(theme.mote),
        resolveBackdropField(theme.field),
        WEB_COUNT,
      )
      expect(cost, `${theme.key} draws ${cost} triangles`).toBeLessThanOrEqual(
        BACKDROP_TRIANGLE_CEILING,
      )
    }
  })

  it('spends nothing on the pair with no field', () => {
    const empty = resolveBackdropTheme('void')
    expect(
      backdropTriangleCost(
        resolveBackdropMote(empty.mote),
        resolveBackdropField(empty.field),
        WEB_COUNT,
      ),
    ).toBe(0)
  })

  it('falls back to the default theme for an unknown key', () => {
    expect(resolveBackdropTheme('no-such-theme').key).toBe(DEFAULT_BACKDROP_THEME)
  })

  // The shipped backdrop is the reference every other pair is judged against, so it stays the plain
  // one: the round dot at its own size, full density, its own clock per mote.
  it('opens on the plain pair', () => {
    const active = resolveBackdropTheme(DEFAULT_BACKDROP_THEME)
    expect(active.mote).toBe(DEFAULT_BACKDROP_MOTE)
    expect(active.field).toBe(DEFAULT_BACKDROP_FIELD)
  })

  it('counts a pair as how many motes the field places times one mote of that form', () => {
    const mote = resolveBackdropMote('pinprick')
    const field = resolveBackdropField('even')
    expect(backdropTriangleCost(mote, field, 100)).toBe(
      backdropMoteCount(field, 100) * backdropMoteTriangles(mote),
    )
  })
})

// The scatter is the one part of the backdrop that runs on the CPU, and the one that has to agree
// across platforms: two devices showing the same universe must not disagree about the sky behind it.
describe('backdrop scatter', () => {
  it('places exactly the requested count, deterministically', () => {
    for (const field of BACKDROP_FIELDS) {
      const spec = { count: 400, radius: WEB_RADIUS }
      const first = scatterBackdrop(field.scatter, spec)
      const second = scatterBackdrop(field.scatter, spec)
      expect(first.positions.length, field.key).toBe(400 * 3)
      expect(first.scales.length, field.key).toBe(400)
      expect(Array.from(first.positions), field.key).toEqual(Array.from(second.positions))
      expect(Array.from(first.scales), field.key).toEqual(Array.from(second.scales))
    }
  })

  it('keeps every mote inside the shell, so the backdrop stays behind the sky', () => {
    for (const field of BACKDROP_FIELDS) {
      const { positions } = scatterBackdrop(field.scatter, { count: 600, radius: WEB_RADIUS })
      for (let i = 0; i < 600; i++) {
        const distance = Math.hypot(
          positions[i * 3] ?? 0,
          positions[i * 3 + 1] ?? 0,
          positions[i * 3 + 2] ?? 0,
        )
        expect(distance, `${field.scatter} mote ${i}`).toBeLessThanOrEqual(WEB_RADIUS * 1.0001)
      }
    }
  })

  it('gives every mote a positive size, scaled by the mote it is drawing', () => {
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
