import { useDecorationRequestStore } from './decoration-request-store.ts'
import { useOrnamentPreviewStore } from './ornament-preview-store.ts'

export { requestDecorate, type DecorateResult } from './decorate.ts'
export {
  decorationMachine,
  type DecorationContext,
  type DecorationEvent,
  type DecorationPhase,
} from './decoration.machine.ts'
export {
  useDecorationRequestStore,
  type DecorationRequestState,
} from './decoration-request-store.ts'
export {
  DEFAULT_ORNAMENT_IDS,
  ORNAMENT_KINDS,
  ornamentIdOf,
  ornamentKindPrefix,
  ornamentRegistryKey,
  ornamentRows,
  ornamentSelectionRows,
  selectedRegistryKey,
  type Ornament,
  type OrnamentAcquisition,
  type OrnamentKind,
  type OrnamentSelection,
} from './ornament.ts'
export {
  useOrnamentPreviewStore,
  type OrnamentIDsByKind,
  type OrnamentPreviewState,
} from './ornament-preview-store.ts'
export {
  ornamentCost,
  saveVerdict,
  unownedTotal,
  type OrnamentCost,
  type SaveInput,
  type SaveVerdict,
} from './save-eligibility.ts'

/** The store context's leg of the shared user-state reset: a scope change wears nobody's choices. */
export function resetStoreUserState(): void {
  useOrnamentPreviewStore.getState().resetStoreUserState()
  useDecorationRequestStore.getState().clear()
}
