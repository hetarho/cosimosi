import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { createTestPanelRegistry, type TestPanelDefinition } from '../../../shared/test-panel/index.ts'
import { TestPage } from './TestPage.tsx'

describe('test harness page shell', () => {
  it('renders unavailable panels without calling their render function', () => {
    const render = vi.fn(() => createElement('span'))
    const futurePanel: TestPanelDefinition = {
      id: 'future-golden-parity',
      titleKey: 'test_harness_title',
      requiredCapabilities: ['goldenParity'],
      render,
    }
    const panels = createTestPanelRegistry([futurePanel] as const)
    const html = renderToString(createElement(TestPage, { panels, availableCapabilities: [] }))

    expect(html).toContain('Unavailable')
    expect(html).toContain('Golden parity')
    expect(render).not.toHaveBeenCalled()
  })
})
