import { describe, expect, it } from 'vitest'

import { VALUES } from '@cosimosi/config'

import { hueBucket, NEAR_NEUTRAL_HUE_BUCKET } from './oklab.ts'

describe('OkLCH hue buckets', () => {
  it('maps the circle to twelve chromatic buckets plus one near-neutral bucket', () => {
    const chromatic = [
      '#ff0000',
      '#ff8000',
      '#ffff00',
      '#80ff00',
      '#00ff00',
      '#00ff80',
      '#00ffff',
      '#0080ff',
      '#0000ff',
      '#8000ff',
      '#ff00ff',
      '#ff0080',
    ] as const
    const buckets = new Set(chromatic.map(hueBucket))

    expect(360 / VALUES.palette.hueBucketDegrees).toBe(12)
    expect([...buckets].every((bucket) => bucket >= 0 && bucket < 12)).toBe(true)
    expect(hueBucket('#777777')).toBe(NEAR_NEUTRAL_HUE_BUCKET)
    expect(NEAR_NEUTRAL_HUE_BUCKET).toBe(12)
  })
})
