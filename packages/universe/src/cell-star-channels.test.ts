import { VALUES } from '@cosimosi/config'
import { describe, expect, it } from 'vitest'

import { cellStarChannels } from './cell-star-channels.ts'

describe('cellStarChannels', () => {
  it('is a constant point size with no color and no seed channel [V5][I3]', () => {
    const channels = cellStarChannels()
    expect(channels.size).toBe(VALUES.rendering.cellStarPointSize)
    expect(channels).not.toHaveProperty('color')
    expect(channels).not.toHaveProperty('seed')
  })
})
