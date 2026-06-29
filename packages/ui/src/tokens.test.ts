import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { contrastRatio, WCAG_AA_TEXT } from './a11y/contrast.ts'
import { CSS_TOKEN_GROUPS, tokens } from './tokens.ts'

const color = tokens.color

// Text token pairs that must clear WCAG AA for normal-size text.
const TEXT_PAIRS: ReadonlyArray<[fg: string, bg: string, label: string]> = [
  [color.text, color.bg, 'text on bg'],
  [color.text, color.surface, 'text on surface'],
  [color.text, color['surface-raised'], 'text on surface-raised'],
  [color['text-muted'], color.bg, 'text-muted on bg'],
  [color['text-muted'], color.surface, 'text-muted on surface'],
  [color['text-muted'], color['surface-raised'], 'text-muted on surface-raised'],
  [color['text-subtle'], color.surface, 'text-subtle on surface'],
  [color['text-subtle'], color['surface-raised'], 'text-subtle on surface-raised'],
  [color['primary-foreground'], color.primary, 'primary-foreground on primary'],
  [color['danger-foreground'], color.danger, 'danger-foreground on danger'],
  [color['success-foreground'], color.success, 'success-foreground on success'],
  [color['warning-foreground'], color.warning, 'warning-foreground on warning'],
]

describe('token contrast', () => {
  it.each(TEXT_PAIRS)('%s clears AA for text', (fg, bg) => {
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
