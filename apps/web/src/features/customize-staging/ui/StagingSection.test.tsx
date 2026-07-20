import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'

import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'

import { m } from '../../../shared/i18n/index.ts'
import { StagingSection } from './StagingSection.tsx'

// renderToString HTML-escapes text nodes (' → &#x27;), so expected copy is escaped the same way.
function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;')
}

describe('StagingSection', () => {
  afterEach(() => {
    setActiveLocale(defaultLocale)
  })

  // A6: the reserved [P4] slot is visible and named, and states the non-meaning boundary.
  it('renders the reserved slot copy — the named layers, the notice, and the boundary', () => {
    const html = renderToString(<StagingSection />)
    expect(html).toContain(escapeHtml(m.settings_staging_items()))
    expect(html).toContain(escapeHtml(m.settings_staging_notice()))
    expect(html).toContain(escapeHtml(m.settings_staging_boundary()))
  })

  // A6/A7 structurally: no editable control ships in the slot — the boundary is enforced by the
  // absence of anything to set, not by copy.
  it('ships no control of any kind', () => {
    const html = renderToString(<StagingSection />)
    for (const control of ['<button', '<input', '<select', '<textarea', '<option']) {
      expect(html).not.toContain(control)
    }
  })
})
