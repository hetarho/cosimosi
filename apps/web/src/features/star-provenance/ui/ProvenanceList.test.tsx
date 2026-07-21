import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'

import { m } from '../../../shared/i18n/index.ts'
import type { ProvenanceEntry } from '../model/provenance.ts'
import { ProvenanceList } from './ProvenanceList.tsx'

const entries: ProvenanceEntry[] = [
  { kind: 'created', source: 'original', text: 'the first account', universeTime: '2026-06-01' },
  {
    kind: 'reconsolidated',
    source: 'user',
    text: 'a reworded account',
    universeTime: '2026-06-20',
  },
]

// A4 [R8a][D1]: the 변천사 list renders each entry with kind + source labels, in the order the read
// returns; distortion is NOT separately flagged. The mobile fork asserts the same in its own test.
describe('ProvenanceList', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('renders time-ordered entries with kind and source labels', () => {
    const html = renderToString(
      createElement(ProvenanceList, { entries, status: 'success', onRetry: () => undefined }),
    )
    expect(html).toContain('the first account')
    expect(html).toContain('a reworded account')
    expect(html).toContain(m.star_provenance_kind_created())
    expect(html).toContain(m.star_provenance_source_user())
    expect(html).toContain('2026-06-20')
    // The created baseline appears before the later reconsolidation (the read's order is preserved).
    expect(html.indexOf('the first account')).toBeLessThan(html.indexOf('a reworded account'))
  })

  it('shows the empty note when the history has no entries', () => {
    const html = renderToString(
      createElement(ProvenanceList, {
        entries: [],
        status: 'success',
        onRetry: () => undefined,
      }),
    )
    expect(html).toContain(m.star_provenance_empty())
  })

  it('shows the loading note while the read is in flight', () => {
    const html = renderToString(
      createElement(ProvenanceList, {
        entries: [],
        status: 'loading',
        onRetry: () => undefined,
      }),
    )
    expect(html).toContain(m.star_provenance_loading())
  })

  it('renders transport failure as retryable error, never as empty history', () => {
    const html = renderToString(
      createElement(ProvenanceList, {
        entries: [],
        status: 'error',
        onRetry: () => undefined,
      }),
    )

    expect(html).toContain(m.star_provenance_error())
    expect(html).toContain(m.common_retry())
    expect(html).not.toContain(m.star_provenance_empty())
  })

  it('distinguishes an in-flight retry from an initial load and an error', () => {
    const html = renderToString(
      createElement(ProvenanceList, {
        entries: [],
        status: 'retrying',
        onRetry: () => undefined,
      }),
    )

    expect(html).toContain(m.star_provenance_retrying())
    expect(html).not.toContain(m.star_provenance_error())
    expect(html).not.toContain(m.star_provenance_empty())
  })
})
