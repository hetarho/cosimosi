// GetUniverse loader (spec 10): fetch the universe, map stars[] → StarNode[], load
// into the authoritative store. synapses are ignored here (09/11 own them). No
// three/React/DOM (constitution §4·3.2) — zustand's getState() is a vanilla call.
import { memoryClient } from '@/shared/api'
import { useMemoryStore } from '../model/store'
import { mapStar } from './map-star'

/** Loads the universe once and replaces the star set. Throws on RPC failure (caller
 *  decides how to surface it). */
export async function getUniverse(): Promise<void> {
  const res = await memoryClient.getUniverse({})
  const stars = res.stars.map((s, i) => mapStar(s, i))
  useMemoryStore.getState().setStars(stars)
}
