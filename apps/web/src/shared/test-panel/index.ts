export {
  capabilityMessageKeys,
  createCapabilitySet,
  createTestPanelRegistry,
  getMissingCapabilities,
  isPanelAvailable,
  readTestPanelMessage,
  type TestPanelCapability,
  type TestPanelDefinition,
  type TestPanelMessageKey,
  type TestPanelRenderProps,
} from './registry.ts'
export { createTestHarnessFakes, type CreateTestHarnessFakesOptions, type TestHarnessFakes } from './fakes.ts'
export { PHASE_ONE_TEST_CAPABILITIES, platformTestPanels } from './platform-panels.ts'
