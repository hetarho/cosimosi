import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { STAR_SHAPES, DEFAULT_STAR_SHAPE } from './bodies/star-shapes.ts'
import { DEFAULT_SKY_EFFECT, SKY_EFFECTS, resolveSkyEffect } from './sky/sky-effects.ts'
import { UNIVERSE_SKINS } from './skins/presets.ts'

// The renderer half of the catalog↔registry drift guard. The store context sells one ornament id per
// key these two registries publish, and it cannot import them — so both sides read the SAME file and
// a renamed or dropped key fails a test on each runtime. The lists' lengths are derived from the
// registries, never asserted as numbers: the count is what the registries happen to hold.
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

describe('ornament id vocabulary', () => {
  it('publishes one background ornament per sky effect', () => {
    expect(
      ornamentIds(
        'BACKGROUND',
        SKY_EFFECTS.map((effect) => effect.key),
      ),
    ).toEqual([...fixture.ids.BACKGROUND])
  })

  it('publishes one star-shader ornament per star shape', () => {
    expect(
      ornamentIds(
        'STAR_SHADER',
        STAR_SHAPES.map((shape) => shape.key),
      ),
    ).toEqual([...fixture.ids.STAR_SHADER])
  })

  it('keeps each kind default equal to its registry default', () => {
    expect(fixture.defaults.BACKGROUND).toBe(`background.${DEFAULT_SKY_EFFECT}`)
    expect(fixture.defaults.STAR_SHADER).toBe(`star_shader.${DEFAULT_STAR_SHAPE}`)
  })

  // The default background is not a third opinion: it IS the sky the `emotion` skin authors, which is
  // what makes an unselected universe and the catalog's default the same picture.
  it('keeps the default background equal to the emotion skin authored sky effect', () => {
    expect(`background.${UNIVERSE_SKINS.emotion.sky.effect}`).toBe(fixture.defaults.BACKGROUND)
    expect(resolveSkyEffect(UNIVERSE_SKINS.emotion.sky.effect).key).toBe(DEFAULT_SKY_EFFECT)
  })
})
