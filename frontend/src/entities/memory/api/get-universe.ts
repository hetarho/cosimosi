// GetUniverse loader (spec 10, extended by 11): fetch the universe once, map stars[] →
// StarNode[] into the authoritative store, AND map synapses[] → SynapseEdge[] into the
// 11 edge store (10 ignored synapses; 11 loads them — acceptance 1.12). No
// three/React/DOM (constitution §4·3.2) — zustand's getState() is a vanilla call.
import { memoryClient } from '@/shared/api'
import { toSynapseEdge, useSynapseStore } from '@/entities/synapse'
import { useMemoryStore } from '../model/store'
import { mapStar } from './map-star'

/** Loads the universe once and replaces the star + synapse sets. Throws on RPC failure
 *  (caller decides how to surface it). */
export async function getUniverse(): Promise<void> {
  const res = await memoryClient.getUniverse({})
  const stars = res.stars.map((s, i) => mapStar(s, i))
  useMemoryStore.getState().setStars(stars)
  useSynapseStore.getState().setEdges(res.synapses.map(toSynapseEdge))
}
