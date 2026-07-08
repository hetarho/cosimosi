import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, m, setActiveLocale } from '@cosimosi/i18n'

import { UniverseTimeHud } from './UniverseTimeHud.tsx'

// The [T6] HUD contract. The SSR-string harness reads zustand's *initial* snapshot (v5
// getInitialState), so the date path is exercised through the sweep-override prop here; the live
// store → date binding is pinned by the mobile UniverseTimeHud test, which renders client-side.
describe('UniverseTimeHud', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('shows the label and a date value', () => {
    const html = renderToString(createElement(UniverseTimeHud, { overrideTime: '2026-07-08' }))
    expect(html).toContain(m.universe_time_hud_label())
    expect(html).toContain('2026-07-08')
  })

  it('shows the empty-universe affordance, not a date, while the clock is unborn', () => {
    const html = renderToString(createElement(UniverseTimeHud))
    expect(html).toContain(m.universe_time_hud_empty())
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })
})
