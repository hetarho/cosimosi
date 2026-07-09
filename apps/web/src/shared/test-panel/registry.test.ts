import { describe, expect, it } from 'vitest'

import {
  createCapabilitySet,
  createTestPanelRegistry,
  getMissingCapabilities,
  isPanelAvailable,
  type TestPanelDefinition,
} from './registry.ts'

const panel: TestPanelDefinition = {
  id: 'future-domain',
  titleKey: 'test_harness_title',
  requiredCapabilities: ['domainFixture', 'goldenParity'],
  render() {
    return null
  },
}

describe('test panel registry', () => {
  it('keeps a typed panel list that the route shell can render generically', () => {
    const registry = createTestPanelRegistry([panel] as const)

    expect(registry[0]?.id).toBe('future-domain')
    expect(registry[0]?.titleKey).toBe('test_harness_title')
  })

  it('reports missing capabilities for unavailable panels', () => {
    const available = createCapabilitySet(['domainFixture'])

    expect(isPanelAvailable(panel, available)).toBe(false)
    expect(getMissingCapabilities(panel, available)).toEqual(['goldenParity'])
  })

  it('rejects duplicate ids before the route shell sees them', () => {
    expect(() => createTestPanelRegistry([panel, panel] as const)).toThrow(
      /duplicate test panel id/,
    )
  })
})
