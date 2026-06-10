// proto Star → domain StarNode. Pure: no three/React/DOM (constitution §4·3.2).
// Coordinates are NOT mapped — they emerge from the client force-sim (constitution
// §3, acceptance 3.1). seed is derived from the memory id via the shared seedFromId,
// so the same id always yields the same star.
import { Mood as ProtoMood, type Star } from '@/shared/api'
import type { Mood } from '@/shared/config'
import { seedFromId } from '../model/seed'
import { parseEpochMs } from '../model/time'
import type { Memory, StarNode } from '../model/types'

const PROTO_TO_MOOD: Partial<Record<ProtoMood, Mood>> = {
  [ProtoMood.JOY]: 'joy',
  [ProtoMood.CALM]: 'calm',
  [ProtoMood.SAD]: 'sad',
  [ProtoMood.ANGER]: 'anger',
  [ProtoMood.FEAR]: 'fear',
  [ProtoMood.LOVE]: 'love',
  [ProtoMood.NEUTRAL]: 'neutral',
}

/** proto Mood enum → domain mood string; UNSPECIFIED/unknown → 'neutral'. */
export function moodFromProto(m: ProtoMood): Mood {
  return PROTO_TO_MOOD[m] ?? 'neutral'
}

/** Maps a proto Star to a domain StarNode at the given instance slot. */
export function mapStar(star: Star, index: number): StarNode {
  const id = star.memoryId
  const memory: Memory = {
    id,
    mood: moodFromProto(star.mood),
    intensity: star.intensity,
    lastRecalledAt: parseEpochMs(star.lastRecalledAt, Date.now()),
    seed: seedFromId(id),
  }
  return { id, memory, index }
}
