import type { ReactNode } from 'react'

import { m } from '@cosimosi/i18n'

export type TestPanelCapability =
  | 'transport'
  | 'auth'
  | 'queryClient'
  | 'values'
  | 'i18n'
  | 'designSystem'
  | 'stateMachine'
  | 'domainFixture'
  | 'goldenParity'

export type TestPanelMessageKey = keyof typeof m

export interface TestPanelRenderProps {
  panel: TestPanelDefinition
}

export interface TestPanelDefinition {
  id: string
  titleKey: TestPanelMessageKey
  descriptionKey?: TestPanelMessageKey
  requiredCapabilities: readonly TestPanelCapability[]
  render(props: TestPanelRenderProps): ReactNode
}

export const capabilityMessageKeys = {
  transport: 'test_harness_capability_transport',
  auth: 'test_harness_capability_auth',
  queryClient: 'test_harness_capability_query_client',
  values: 'test_harness_capability_values',
  i18n: 'test_harness_capability_i18n',
  designSystem: 'test_harness_capability_design_system',
  stateMachine: 'test_harness_capability_state_machine',
  domainFixture: 'test_harness_capability_domain_fixture',
  goldenParity: 'test_harness_capability_golden_parity',
} as const satisfies Record<TestPanelCapability, TestPanelMessageKey>

export function createTestPanelRegistry<const TPanels extends readonly TestPanelDefinition[]>(panels: TPanels): TPanels {
  const seen = new Set<string>()
  for (const panel of panels) {
    if (seen.has(panel.id)) throw new Error(`duplicate test panel id: ${panel.id}`)
    seen.add(panel.id)
  }
  return panels
}

export function createCapabilitySet(capabilities: readonly TestPanelCapability[]): ReadonlySet<TestPanelCapability> {
  return new Set(capabilities)
}

export function isPanelAvailable(
  panel: TestPanelDefinition,
  availableCapabilities: ReadonlySet<TestPanelCapability>,
): boolean {
  return getMissingCapabilities(panel, availableCapabilities).length === 0
}

export function getMissingCapabilities(
  panel: TestPanelDefinition,
  availableCapabilities: ReadonlySet<TestPanelCapability>,
): TestPanelCapability[] {
  return panel.requiredCapabilities.filter((capability) => !availableCapabilities.has(capability))
}

export function readTestPanelMessage(key: TestPanelMessageKey): string {
  return String((m[key] as () => string)())
}
