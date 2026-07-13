import { render } from '@testing-library/react-native'

import { createEmotion } from '@cosimosi/emotion'
import { defaultLocale, setActiveLocale } from '@cosimosi/i18n'
import type { EpisodicMemory, Neuron } from '@cosimosi/memory'

import { m, moodLabel } from '../../../shared/i18n/index.ts'
import { MetaBlock } from './MetaBlock.tsx'

const memory = {
  id: 'm1',
  name: 'Market run',
  emotion: createEmotion('JOY'),
  baseStrength: 0.5,
  recallCount: 0,
  createdUniverseTime: '2026-06-20',
  lastRecalledUniverseTime: null,
  seed: 123n,
  activations: [],
  decayStages: [],
  forgettingOffsetDays: 0,
  currentText: 'a memory',
  semanticStage: 0,
} as EpisodicMemory

const neuron: Neuron = { id: 'n1', name: 'market', neuronType: 'spatial', connectivity: 3 }

// A2 [D1][I3], RN fork: an episodic star shows its emotion; a neuron shows info only, NO emotion —
// the same invariant the web MetaBlock test pins, asserted here against the rendered RN tree.
describe('MetaBlock (mobile)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale)
  })

  it('shows an episodic star with its emotion and written date', () => {
    const view = render(
      <MetaBlock selection={{ kind: 'episodic', memory }} universeTime="2026-06-25" />,
    )
    expect(view.getByText(moodLabel('JOY'))).toBeTruthy()
    expect(view.getByText('2026-06-20')).toBeTruthy()
  })

  it('shows the current forgetting degree — vivid when fresh, deeper as it fades [F1][D1]', () => {
    const fresh = render(
      <MetaBlock selection={{ kind: 'episodic', memory }} universeTime="2026-06-20" />,
    )
    expect(fresh.getByText(m.star_meta_forgetting_vivid())).toBeTruthy()

    const faded = render(
      <MetaBlock selection={{ kind: 'episodic', memory }} universeTime="2035-06-20" />,
    )
    expect(faded.queryByText(m.star_meta_forgetting_vivid())).toBeNull()
    expect(faded.getByText(m.star_meta_forgetting_distant())).toBeTruthy()
  })

  it('shows a neuron with info only and no emotion', () => {
    const view = render(<MetaBlock selection={{ kind: 'neuron', neuron }} universeTime={null} />)
    expect(view.getByText('market')).toBeTruthy()
    expect(view.queryByText(moodLabel('JOY'))).toBeNull()
  })
})
