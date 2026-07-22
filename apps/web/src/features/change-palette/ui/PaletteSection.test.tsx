import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'

import { TransportProvider } from '@connectrpc/connect-query'

import { createPlatformMockTransport } from '@cosimosi/api-client'
import { DEFAULT_PALETTE_ID } from '@cosimosi/emotion'
import { usePalettePreferenceStore } from '@cosimosi/emotion/react'
import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'

import { m } from '../../../shared/i18n/index.ts'
import { PaletteSection } from './PaletteSection.tsx'

function renderSection(): string {
  return renderToString(
    <TransportProvider transport={createPlatformMockTransport(() => ({ message: 'pong' }))}>
      <PaletteSection />
    </TransportProvider>,
  )
}

describe('PaletteSection', () => {
  afterEach(() => {
    usePalettePreferenceStore.getState().setPaletteId(DEFAULT_PALETTE_ID)
    setActiveLocale(defaultLocale)
  })

  // A4/A5: the picker offers exactly the registry — every entry named through i18n, nothing else
  // (no free editor exists; the registry is the guardrail surface).
  it('lists the registry palettes by their localized names', () => {
    const html = renderSection()
    expect(html).toContain(m.palette_name_cosimosi_default())
    expect(html).toContain(m.palette_name_muted_dusk())
    for (const control of ['<input', '<select', '<textarea']) {
      expect(html).not.toContain(control)
    }
  })

  // A4: the stored preference is marked as the current choice — exactly one mark, sitting inside
  // the stored palette's row. (renderToString reads the store's initial state — zustand serves
  // getInitialState as the SSR snapshot — so the marked row is the default one here; the live
  // mark-follows-store behavior is covered by the mobile RTL flow.)
  it('marks the stored preference on its own row, once', () => {
    const html = renderSection()
    const marked = html.indexOf(m.settings_palette_selected())
    expect(marked).toBeGreaterThan(html.indexOf(m.palette_name_cosimosi_default()))
    expect(marked).toBeLessThan(html.indexOf(m.palette_name_muted_dusk()))
    expect(html.indexOf(m.settings_palette_selected())).toBe(
      html.lastIndexOf(m.settings_palette_selected()),
    )
  })
})
