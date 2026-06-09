// GetUniverse loader: fetch the universe once, map stars[] → StarNode[] into the
// authoritative store, and map synapses[] → SynapseEdge[] into the edge store. No
// three/React/DOM (constitution §4·3.2) — zustand's getState() is a vanilla call.
import { memoryClient } from '@/shared/api'
import { isDemoMode, demoStars, demoSynapses } from '@/shared/demo'
import { toSynapseEdge, useSynapseStore } from '@/entities/synapse/@x/memory'
import { A_MIN, activation } from '../model/activation'
import { useMemoryStore } from '../model/store'
import { mapStar } from './map-star'

/** Loads the universe once and replaces the star + synapse sets. The synapse `brightness`
 *  field is the time-DECAY factor max(A_MIN, activation(last_activated_at)) — NOT the
 *  weight-folded value: visualIntensity already multiplies by weight, so the final
 *  rendered strength is weight·max(A_MIN, activation) = synapseBrightness (the dormant
 *  link dims but never vanishes, constitution §2). Throws on RPC failure (caller surfaces it). */
export async function getUniverse(): Promise<void> {
  // 체험 모드: 백엔드 대신 프런트 더미 우주를 로드한다(같은 매퍼·스토어 경로 재사용).
  const res = isDemoMode()
    ? { stars: demoStars(), synapses: demoSynapses() }
    : await memoryClient.getUniverse({})
  const now = Date.now()
  const stars = res.stars.map((s, i) => mapStar(s, i))
  useMemoryStore.getState().setStars(stars)
  const edges = res.synapses.map((s) => {
    const base = toSynapseEdge(s)
    const last = Date.parse(s.lastActivatedAt)
    return {
      ...base,
      brightness: Math.max(A_MIN, activation(Number.isFinite(last) ? last : now, now)),
    }
  })
  useSynapseStore.getState().setEdges(edges)
}
