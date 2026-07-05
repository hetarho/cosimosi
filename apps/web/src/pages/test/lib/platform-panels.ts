import { createElement } from 'react'

import {
  AuthSessionPanel,
  DesignSystemPanel,
  I18nPanel,
  QueryCachePanel,
  TransportPingPanel,
  ValuesPanel,
} from './platform-panel-components.tsx'
import { NebulaDemoPanel } from './nebula-demo-panel.tsx'
import { RenderDemoPanel } from './render-demo-panel.tsx'
import { createTestPanelRegistry, type TestPanelCapability, type TestPanelDefinition } from '../../../shared/test-panel/index.ts'

export const PHASE_ONE_TEST_CAPABILITIES = [
  'transport',
  'auth',
  'queryClient',
  'values',
  'i18n',
  'designSystem',
] as const satisfies readonly TestPanelCapability[]

export const platformTestPanels = createTestPanelRegistry([
  {
    id: 'transport-ping',
    titleKey: 'test_harness_transport_title',
    descriptionKey: 'test_harness_transport_description',
    requiredCapabilities: ['transport'],
    render: () => createElement(TransportPingPanel),
  },
  {
    id: 'auth-session',
    titleKey: 'test_harness_auth_title',
    descriptionKey: 'test_harness_auth_description',
    requiredCapabilities: ['auth'],
    render: () => createElement(AuthSessionPanel),
  },
  {
    id: 'query-cache',
    titleKey: 'test_harness_query_title',
    descriptionKey: 'test_harness_query_description',
    requiredCapabilities: ['queryClient'],
    render: () => createElement(QueryCachePanel),
  },
  {
    id: 'values',
    titleKey: 'test_harness_values_title',
    descriptionKey: 'test_harness_values_description',
    requiredCapabilities: ['values'],
    render: () => createElement(ValuesPanel),
  },
  {
    id: 'i18n-locale',
    titleKey: 'test_harness_i18n_title',
    descriptionKey: 'test_harness_i18n_description',
    requiredCapabilities: ['i18n'],
    render: () => createElement(I18nPanel),
  },
  {
    id: 'design-system',
    titleKey: 'test_harness_design_system_title',
    descriptionKey: 'test_harness_design_system_description',
    requiredCapabilities: ['designSystem'],
    render: () => createElement(DesignSystemPanel),
  },
  {
    id: 'rendering-foundation',
    titleKey: 'test_harness_render_title',
    descriptionKey: 'test_harness_render_description',
    // No capability gate: the panel self-handles GPU absence (WebGPU → WebGL2 → none).
    requiredCapabilities: [],
    render: () => createElement(RenderDemoPanel),
  },
  {
    id: 'nebula-color-field',
    titleKey: 'test_harness_nebula_title',
    descriptionKey: 'test_harness_nebula_description',
    // No capability gate: the panel self-handles GPU absence (WebGPU → WebGL2 → none).
    requiredCapabilities: [],
    render: () => createElement(NebulaDemoPanel),
  },
] as const satisfies readonly TestPanelDefinition[])
