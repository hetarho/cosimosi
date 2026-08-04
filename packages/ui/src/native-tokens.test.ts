import { describe, expect, it } from 'vitest'

import { color, nativeTokens, radius, space } from './native-styles.ts'
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

  it('carries radii as numbers, since RN has no rem', () => {
    for (const [step, value] of Object.entries(nativeTokens.radius)) {
      expect(typeof value, step).toBe('number')
    }
    // Same scale, different encoding: 0.75rem is 12px, and `full` is a pill either way.
    expect(nativeTokens.radius.lg).toBe(12)
    expect(nativeTokens.radius).toBe(radius)
    expect(Object.keys(nativeTokens.radius)).toEqual(Object.keys(tokens.radius))
  })

  it('carries no font family, because a CSS stack is not a React Native family name', () => {
    // `tokens.font.sans` is a web fallback chain. RN resolves `fontFamily` against a font asset
    // linked into the native build and silently uses the system face when it cannot — so passing
    // the stack through would look applied and do nothing. The group returns here converted, or
    // not at all.
    expect(tokens.font.sans).toContain('Wanted Sans')
    expect('font' in nativeTokens).toBe(false)
  })

  it('keeps the groups RN can already use identical to the shared map', () => {
    expect(nativeTokens.spacing).toBe(tokens.spacing)
    expect(nativeTokens.fontSize).toBe(tokens.fontSize)
    expect(space).toBe(tokens.spacing)
  })
})
