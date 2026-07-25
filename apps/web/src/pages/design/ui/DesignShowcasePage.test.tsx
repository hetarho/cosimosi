import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { defaultThemeKey, themes } from '@cosimosi/ui'

import { SHOWCASE_SECTION_IDS } from '../lib/showcase-sections.ts'
import { DesignShowcasePage } from './DesignShowcasePage.tsx'

/**
 * The showcase's job is coverage: a review can only catch what is on the page. These pin the two
 * ways it silently stops covering things — a sidebar entry pointing at a section nobody renders,
 * and a page that has stopped reading the theme registry and started restating it.
 */
describe('design showcase', () => {
  const html = renderToString(createElement(DesignShowcasePage))

  it('renders every section its sidebar links to', () => {
    const missing = SHOWCASE_SECTION_IDS.filter((id) => !html.includes(`id="${id}"`))
    expect(missing).toEqual([])
  })

  it('names the active theme from the registry rather than a literal', () => {
    expect(html).toContain(themes[defaultThemeKey].label)
    expect(html).toContain(themes[defaultThemeKey].blurb)
  })

  it('shows every colour role of the active theme, so a new role cannot go unreviewed', () => {
    const roles = Object.keys(themes[defaultThemeKey].palette)
    const unshown = roles.filter((role) => !html.includes(`var(--color-${role})`))
    expect(unshown).toEqual([])
  })
})
