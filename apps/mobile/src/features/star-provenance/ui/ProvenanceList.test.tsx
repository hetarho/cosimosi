import { render } from '@testing-library/react-native'

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

// A4 [R8a][D1], RN fork: the 변천사 list renders each entry with kind + source labels; distortion
// is NOT separately flagged. Same invariant as the web ProvenanceList test.
describe('ProvenanceList (mobile)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('renders entries with kind and source labels', () => {
    const view = render(<ProvenanceList entries={entries} isLoading={false} />)
    expect(view.getByText('the first account')).toBeTruthy()
    expect(view.getByText('a reworded account')).toBeTruthy()
    expect(view.getByText(new RegExp(m.star_provenance_kind_created()))).toBeTruthy()
    expect(view.getByText(new RegExp(m.star_provenance_source_user()))).toBeTruthy()
  })

  it('shows the empty note when the history has no entries', () => {
    const view = render(<ProvenanceList entries={[]} isLoading={false} />)
    expect(view.getByText(m.star_provenance_empty())).toBeTruthy()
  })

  it('shows the loading note while the read is in flight', () => {
    const view = render(<ProvenanceList entries={[]} isLoading={true} />)
    expect(view.getByText(m.star_provenance_loading())).toBeTruthy()
  })
})
