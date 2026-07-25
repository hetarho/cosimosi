import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { defaultThemeKey, isThemeKey, palette, THEME_KEYS, themes } from './palette.ts'

/**
 * The theme-registry contract: adding a universe is a DATA change in palette.ts and nothing else.
 *
 * Each test below pins one link in that chain — the generated CSS covers every registered theme,
 * every theme fills every role, and no downstream layer names a colour of its own. Break any link
 * and adding a theme silently half-applies: the classic failure where a new `data-theme` renders
 * with the previous theme's greys because one surface was never wired.
 */

const src = (name: string) => readFileSync(join(process.cwd(), 'src', name), 'utf8')

const ROLES = Object.keys(themes[defaultThemeKey].palette)

describe('theme registry', () => {
  it('is the only list of themes — keys, active key, and active palette all derive from it', () => {
    expect(THEME_KEYS.length).toBeGreaterThan(0)
    expect(THEME_KEYS).toContain(defaultThemeKey)
    expect(isThemeKey(defaultThemeKey)).toBe(true)
    expect(isThemeKey('not-a-theme')).toBe(false)
    expect(palette).toBe(themes[defaultThemeKey].palette)
  })

  it('gives every theme the display copy a showcase needs, so no surface hardcodes a theme list', () => {
    for (const [key, theme] of Object.entries(themes)) {
      expect(theme.label, `${key} label`).not.toHaveLength(0)
      expect(theme.blurb, `${key} blurb`).not.toHaveLength(0)
    }
  })

  it('fills every colour role in every theme — a missing role would inherit the active theme', () => {
    for (const [key, theme] of Object.entries(themes)) {
      expect(Object.keys(theme.palette).sort(), `${key} roles`).toEqual([...ROLES].sort())
      for (const [role, value] of Object.entries(theme.palette)) {
        expect(value, `${key}.${role}`).toMatch(/^oklch\(/)
      }
    }
  })
})

describe('generated theme CSS', () => {
  const css = src('theme.gen.css')

  it('emits a complete override block for every registered theme', () => {
    for (const key of THEME_KEYS) {
      const block = new RegExp(`\\[data-theme='${key}'\\]\\s*\\{([^}]*)\\}`).exec(css)
      expect(block, `[data-theme='${key}'] block`).not.toBeNull()
      for (const role of ROLES) expect(block?.[1]).toContain(`--color-${role}:`)
    }
  })
})

describe('no colour is named below the palette layer', () => {
  // The palette is the one place a colour literal may appear. Anything below it must reference a
  // role, or a new theme reskins around it and leaves a stale patch behind. `transparent` and
  // `currentColor` are compositing keywords, not colours, so they stay allowed.
  const LITERAL =
    /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(|\boklab\(|(?<![\w-])(?:white|black|silver|gray|grey|red|blue|green|yellow|orange|purple|pink|brown|navy|teal|olive|maroon|lime|aqua|fuchsia)(?![\w-])/

  it('base.css derives every colour from a theme var', () => {
    const offenders = src('base.css')
      .split('\n')
      // `in oklab` is a colour SPACE for color-mix, and `white-space` is a layout property; both
      // trip a bare keyword scan without naming a colour.
      .map((line, index) => ({ line: line.replace(/in oklab|white-space/g, ''), no: index + 1 }))
      .filter(({ line }) => !line.trimStart().startsWith('*') && !line.includes('/*'))
      .filter(({ line }) => LITERAL.test(line))
      .map(({ line, no }) => `base.css:${no} ${line.trim()}`)
    expect(offenders).toEqual([])
  })

  it('tokens.ts holds geometry and timing only — its colour comes from the palette', () => {
    const body = src('tokens.ts')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
      .join('\n')
      .replace(/in oklab/g, '')
    expect(LITERAL.test(body)).toBe(false)
  })
})
