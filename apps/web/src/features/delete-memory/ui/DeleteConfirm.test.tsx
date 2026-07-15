import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'

import { m } from '../../../shared/i18n/index.ts'
import { DeleteConfirm } from './DeleteConfirm.tsx'

function render(affectedNames: readonly string[]) {
  return renderToString(
    createElement(DeleteConfirm, {
      affectedNames,
      retentionDays: 30,
      busy: false,
      error: false,
      onConfirm: () => {},
      onCancel: () => {},
    }),
  )
}

describe('DeleteConfirm (web)', () => {
  beforeEach(() => setActiveLocale(defaultLocale))

  it('states that all stars born from the diary are removed and previews them (A1)', () => {
    const html = render(['first swim', 'the cold sea'])
    expect(html).toContain(m.deletion_delete_lead())
    expect(html).toContain('first swim')
    expect(html).toContain('the cold sea')
  })

  it('carries both reassurances + the honest post-window wording before the act (A1/A10)', () => {
    const html = render(['a star'])
    expect(html).toContain(m.deletion_delete_restore_reassurance({ days: 30 }))
    expect(html).toContain(m.deletion_delete_export_reassurance())
    expect(html).toContain(m.deletion_delete_permanent_after_window())
    expect(html).toContain(m.deletion_delete_kept_shared())
  })

  it('offers the plain confirm — no type-to-confirm field exists', () => {
    const html = render(['a star'])
    expect(html).toContain(m.deletion_delete_confirm())
    expect(html).not.toContain('<input')
  })

  it('shows the quiet note when the diary has no live star left', () => {
    expect(render([])).toContain(m.deletion_delete_affected_empty())
  })
})
