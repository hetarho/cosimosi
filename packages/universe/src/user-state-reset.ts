import { useAwakenRegistryStore } from './awaken-registry.ts'
import { useChargeRequestStore } from './charge-request-store.ts'
import { useDeletionTargetStore } from './deletion-target-store.ts'
import { useDiaryStore } from './diary-store.ts'
import { useEpisodicMemoryStore } from './episodic-memory-store.ts'
import { useLatentConsumedStore } from './latent-consumed-store.ts'
import { useNeuronStore } from './neuron-store.ts'
import { useOpenDiaryTargetStore } from './open-diary-target-store.ts'
import { usePendingFlyTargetStore } from './pending-fly-target-store.ts'
import { useRecallTargetStore } from './recall-target-store.ts'
import { useReleasedGroupsStore } from './released-groups-store.ts'
import { useSynapseStore } from './synapse-store.ts'
import { useTwinkleBalanceStore } from './twinkle-balance-store.ts'
import { useUniverseClockStore } from './universe-clock-store.ts'

/**
 * Clears every user-owned singleton in this package while the auth scope boundary withholds
 * consumers. Keep new read mirrors and cross-route channels registered here so account changes
 * cannot carry one user's state into another user's subtree.
 */
export function resetUniverseUserState(): void {
  useEpisodicMemoryStore.getState().clear()
  useNeuronStore.getState().clear()
  useSynapseStore.getState().clear()
  useUniverseClockStore.getState().clear()
  useDiaryStore.getState().clear()
  useTwinkleBalanceStore.getState().clear()
  useReleasedGroupsStore.getState().reset()
  useRecallTargetStore.getState().clear()
  useOpenDiaryTargetStore.getState().clear()
  usePendingFlyTargetStore.getState().clear()
  useChargeRequestStore.getState().clear()
  useDeletionTargetStore.getState().clear()
  useLatentConsumedStore.getState().reset()
  useAwakenRegistryStore.getState().reset()
}
