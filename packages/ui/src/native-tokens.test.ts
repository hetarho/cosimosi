import { describe, expect, it } from 'vitest'

import { color, nativeTokens, space } from './native-styles.ts'
import { tokens } from './tokens.ts'

/**
 * The native token map must be paintable by React Native.
 *
 * RN `StyleSheet` silently DROPS a colour it cannot parse — no throw, no warning, just a screen with
 * no ground and no ink. The web pipeline authors colour in OKLCH, so the shared map cannot be handed
 * to RN as-is; the native entry exports the converted one under the same name. These tests are the
 * only thing standing between that arrangement and a colourless app nobody notices until they open a
 * simulator.
 */
describe('native token map', () => {
  it('carries no colour React Native cannot parse', () => {
    const unparseable = Object.entries(nativeTokens.color).filter(
      ([, value]) => !/^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(value),
    )
    expect(unparseable).toEqual([])
  })

  it('resolves every role the shared map declares, from that same map', () => {
    expect(Object.keys(nativeTokens.color)).toEqual(Object.keys(tokens.color))
    expect(nativeTokens.color).toBe(color)
  })

  it('keeps every non-colour group identical to the shared map', () => {
    expect(nativeTokens.spacing).toBe(tokens.spacing)
    expect(nativeTokens.fontSize).toBe(tokens.fontSize)
    expect(nativeTokens.radius).toBe(tokens.radius)
    expect(space).toBe(tokens.spacing)
  })
})
