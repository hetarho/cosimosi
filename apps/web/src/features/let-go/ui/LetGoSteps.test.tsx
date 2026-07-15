import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'

import { m } from '../../../shared/i18n/index.ts'
import { ApproveStep, type LetGoCandidate } from './ApproveStep.tsx'
import { PhrasingStep } from './PhrasingStep.tsx'

const candidates: readonly LetGoCandidate[] = [
  { neuronId: 'n1', name: 'the argument', reason: 'used only here' },
  { neuronId: 'n2', name: 'the rain', reason: 'used only here' },
]

function renderApprove(overrides: { heavyDetected?: boolean; selectedIds?: readonly string[] }) {
  return renderToString(
    createElement(ApproveStep, {
      candidates,
      selectedIds: overrides.selectedIds ?? ['n1', 'n2'],
      onToggle: () => {},
      heavyDetected: overrides.heavyDetected ?? false,
      onSeal: () => {},
      onBack: () => {},
      busy: false,
      error: false,
    }),
  )
}

describe('PhrasingStep (web)', () => {
  beforeEach(() => setActiveLocale(defaultLocale))

  it('frames the act symbolically with the honest not-treatment note (A7)', () => {
    const html = renderToString(
      createElement(PhrasingStep, {
        value: '',
        onChange: () => {},
        onSuggest: () => {},
        onCancel: () => {},
        busy: false,
        error: false,
      }),
    )
    expect(html).toContain(m.deletion_letgo_phrasing_prompt())
    expect(html).toContain(m.deletion_letgo_phrasing_note())
  })
})

describe('ApproveStep (web)', () => {
  beforeEach(() => setActiveLocale(defaultLocale))

  it('lists the candidates with their reason and the persistent kept-facts statement (A4/A5)', () => {
    const html = renderApprove({})
    expect(html).toContain('the argument')
    expect(html).toContain('the rain')
    expect(html).toContain(m.deletion_letgo_kept_facts())
  })

  it('states permanence + the export reassurance at the seal step (A6/A10)', () => {
    const html = renderApprove({})
    expect(html).toContain(m.deletion_letgo_permanence())
    expect(html).toContain(m.deletion_letgo_export_reassurance())
  })

  it('surfaces the professional-resource notice only when heavy-state is set (A8)', () => {
    expect(renderApprove({ heavyDetected: true })).toContain(m.deletion_letgo_resource_title())
    expect(renderApprove({ heavyDetected: false })).not.toContain(m.deletion_letgo_resource_title())
  })

  it('the resource notice claims no therapeutic efficacy and never substitutes for care (A7)', () => {
    const html = renderApprove({ heavyDetected: true })
    expect(html).toContain(m.deletion_letgo_resource_body())
    expect(html).toContain(m.deletion_letgo_resource_contact())
  })

  it('offers no undo affordance — only a seal and a back-to-reword (A6)', () => {
    const html = renderApprove({})
    expect(html).toContain(m.deletion_letgo_seal_action())
    expect(html).toContain(m.deletion_letgo_back())
  })
})
