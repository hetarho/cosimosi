import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { contrastRatio, WCAG_AA_TEXT } from './a11y/contrast.ts'
import { CSS_TOKEN_GROUPS, tokens } from './tokens.ts'
import { themes, type ThemePalette } from './palette.ts'

// Text token pairs that must clear WCAG AA for normal-size text — checked for every theme.
function textPairs(c: ThemePalette): ReadonlyArray<[fg: string, bg: string, label: string]> {
  return [
    [c.text, c.bg, 'text on bg'],
    [c.text, c.surface, 'text on surface'],
    [c.text, c['surface-raised'], 'text on surface-raised'],
    [c['text-muted'], c.bg, 'text-muted on bg'],
    [c['text-muted'], c.surface, 'text-muted on surface'],
    [c['text-muted'], c['surface-raised'], 'text-muted on surface-raised'],
    [c['text-subtle'], c.surface, 'text-subtle on surface'],
    [c['text-subtle'], c['surface-raised'], 'text-subtle on surface-raised'],
    [c['primary-foreground'], c.primary, 'primary-foreground on primary'],
    [c['secondary-foreground'], c.secondary, 'secondary-foreground on secondary'],
    [c['tertiary-foreground'], c.tertiary, 'tertiary-foreground on tertiary'],
    [c['danger-foreground'], c.danger, 'danger-foreground on danger'],
    [c['success-foreground'], c.success, 'success-foreground on success'],
    [c['warning-foreground'], c.warning, 'warning-foreground on warning'],
  ]
}

describe.each(Object.entries(themes))('token contrast — %s', (_themeKey, color) => {
  it.each(textPairs(color))('%s clears AA for text', (fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_TEXT)
  })
})

describe('one token source', () => {
  it('emits every CSS token group into theme.gen.css', () => {
    const css = readFileSync(join(process.cwd(), 'src/theme.gen.css'), 'utf8')
    for (const group of CSS_TOKEN_GROUPS) {
      for (const key of Object.keys(tokens[group])) {
        expect(css).toContain(`--${group}-${key}:`)
      }
    }
  })
})
