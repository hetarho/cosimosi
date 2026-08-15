import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { SHEET_BREAKPOINT, SHEET_GESTURE } from './sheet-geometry.ts'
import { SHEET_VIEWPORT } from './sheet-shape.ts'

const packageSource = (path: string) => readFileSync(join(process.cwd(), 'src', path), 'utf8')
const workspaceSource = (path: string) =>
  readFileSync(join(process.cwd(), '..', '..', path), 'utf8')

function leaveAnimationDuration(css: string, className: string): number | null {
  const block = new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`, 's').exec(css)?.[1]
  const duration = block ? /animation:\s*[^;]*?([\d.]+)ms/.exec(block)?.[1] : undefined
  return duration ? Number(duration) : null
}

// The one place every representation of the responsive sheet contract meets. Some copies must
// remain syntax rather than imports — Tailwind's `md:` variant and CSS animation declarations — so
// this test turns their agreement into a gate instead of leaving it to comments.
describe('sheet geometry chain', () => {
  it('keeps script consumers and CSS/Tailwind shape switches on Tailwind md', () => {
    // Tailwind v4's default `md` is 48rem. Changing that framework-level source is an explicit
    // design-system decision and must move the generated value and every checked anchor together.
    expect(SHEET_BREAKPOINT).toEqual({ rem: 48, px: 768 })
    expect(SHEET_VIEWPORT).toBe(`(width < ${SHEET_BREAKPOINT.rem}rem)`)

    const guide = workspaceSource('apps/web/src/widgets/sequence-guide/ui/SequenceGuide.tsx')
    expect(guide).toContain('WIDE_MIN_WIDTH_PX = SHEET_BREAKPOINT.px')
    expect(guide).toContain('viewport.width >= WIDE_MIN_WIDTH_PX')
    expect(guide).not.toMatch(/WIDE_MIN_WIDTH_PX\s*=\s*\d/)

    const dialog = packageSource('primitives/dialog.tsx')
    const sheet = packageSource('primitives/sheet.tsx')
    expect(dialog).toContain('md:items-center')
    expect(dialog).toContain('md:max-w-md')
    expect(sheet).toContain('md:inset-y-0')
    expect(sheet).toContain('md:max-h-none')

    const cssBreakpoints = [
      ...packageSource('base.css').matchAll(/@media\s*\(width >= ([\d.]+)rem\)/g),
    ].map((match) => Number(match[1]))
    expect(cssBreakpoints).not.toHaveLength(0)
    expect(cssBreakpoints.every((value) => value === SHEET_BREAKPOINT.rem)).toBe(true)
  })

  it('keeps the resize ceiling equal to the rendered sheet max-height', () => {
    const sheet = packageSource('primitives/sheet.tsx')
    const maxHeightDvh = /max-h-\[([\d.]+)dvh\]/.exec(sheet)?.[1]

    expect(maxHeightDvh).toBeDefined()
    expect(Number(maxHeightDvh) / 100).toBe(SHEET_GESTURE.tallestViewportRatio)
  })

  it('settles gestures, leave animations, and presence holds on the same clock', () => {
    const css = packageSource('base.css')
    expect(leaveAnimationDuration(css, 'sheet-leave')).toBe(SHEET_GESTURE.settleMs)
    expect(leaveAnimationDuration(css, 'scrim-leave')).toBe(SHEET_GESTURE.settleMs)
    expect(leaveAnimationDuration(css, 'dialog-leave')).toBe(SHEET_GESTURE.settleMs)

    for (const primitive of ['primitives/dialog.tsx', 'primitives/sheet.tsx']) {
      expect(packageSource(primitive)).toContain('usePresence(open, SHEET_GESTURE.settleMs)')
    }
  })
})
