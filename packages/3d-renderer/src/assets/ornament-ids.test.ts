import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { BACKDROP_FIELDS, DEFAULT_BACKDROP_FIELD } from './backdrop/backdrop-fields.ts'
import { BACKDROP_MOTES, DEFAULT_BACKDROP_MOTE } from './backdrop/backdrop-motes.ts'
import { DEFAULT_GIST_SHAPE, GIST_SHAPES } from './bodies/gist-shapes.ts'
import { STAR_SHAPES, DEFAULT_STAR_SHAPE } from './bodies/star-shapes.ts'
import { DEFAULT_SKY_EFFECT, SKY_EFFECTS, resolveSkyEffect } from './sky/sky-effects.ts'
import { UNIVERSE_SKINS } from './skins/presets.ts'

// The renderer half of the catalog↔registry drift guard. The store context sells one ornament id per
// key these five registries publish, and it cannot import them — so both sides read the SAME file and
// a renamed or dropped key fails a test on each runtime. The lists' lengths are derived from the
// registries, never asserted as numbers: the count is what the registries happen to hold.
//
// The kind names are the SERVER's word for the surface, never the registry's own noun for what fills
// it (`STAR_SHADER` for `STAR_SHAPES`, `MOTE_FIELD` for `BACKDROP_FIELDS`): the visual vocabulary
// stops at this boundary, and the pairing lives here because this is where both words are legible.
const fixture = JSON.parse(
  readFileSync(
    new URL('../../../../apps/api/internal/store/testdata/ornament-ids.json', import.meta.url),
    'utf8',
  ),
) as {
  readonly defaults: Record<string, string>
  readonly ids: Record<string, readonly string[]>
}

const ornamentIds = (kind: string, keys: readonly string[]) =>
  [...keys].map((key) => `${kind.toLowerCase()}.${key}`).sort()

/** Every kind, the registry it wraps and that registry's own default — one row per published kind,
 *  so a kind added to the fixture with no registry behind it fails the closure check below. */
const KINDS = [
  {
    kind: 'BACKGROUND',
    keys: SKY_EFFECTS.map((effect) => effect.key),
    fallback: DEFAULT_SKY_EFFECT,
  },
  {
    kind: 'STAR_SHADER',
    keys: STAR_SHAPES.map((shape) => shape.key),
    fallback: DEFAULT_STAR_SHAPE,
  },
  {
    kind: 'GIST_SHADER',
    keys: GIST_SHAPES.map((shape) => shape.key),
    fallback: DEFAULT_GIST_SHAPE,
  },
  {
    kind: 'MOTE',
    keys: BACKDROP_MOTES.map((mote) => mote.key),
    fallback: DEFAULT_BACKDROP_MOTE,
  },
  {
    kind: 'MOTE_FIELD',
    keys: BACKDROP_FIELDS.map((field) => field.key),
    fallback: DEFAULT_BACKDROP_FIELD,
  },
] as const

describe('ornament id vocabulary', () => {
  it.each(KINDS)('publishes one $kind ornament per registry row', ({ kind, keys }) => {
    expect(ornamentIds(kind, keys)).toEqual([...(fixture.ids[kind] ?? [])])
  })

  it.each(KINDS)('keeps the $kind default equal to its registry default', ({ kind, fallback }) => {
    expect(fixture.defaults[kind]).toBe(`${kind.toLowerCase()}.${fallback}`)
  })

  // The fixture may not carry a kind no registry answers for: that is the direction the per-kind
  // assertions above cannot catch, because a fixture-only kind is simply never visited.
  it('covers every kind the fixture publishes and no other', () => {
    expect(KINDS.map((entry) => entry.kind).sort()).toEqual(Object.keys(fixture.ids).sort())
    expect(Object.keys(fixture.defaults).sort()).toEqual(Object.keys(fixture.ids).sort())
  })

  // The default background is not a third opinion: it IS the sky the `emotion` skin authors, which is
  // what makes an unselected universe and the catalog's default the same picture.
  it('keeps the default background equal to the emotion skin authored sky effect', () => {
    expect(`background.${UNIVERSE_SKINS.emotion.sky.effect}`).toBe(fixture.defaults.BACKGROUND)
    expect(resolveSkyEffect(UNIVERSE_SKINS.emotion.sky.effect).key).toBe(DEFAULT_SKY_EFFECT)
  })
})
