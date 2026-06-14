// proto Star → domain StarNode. Pure: no three/React/DOM (constitution §4·3.2).
// Coordinates are NOT mapped — they emerge from the client force-sim (constitution
// §3, acceptance 3.1). seed is derived from the memory id via the shared seedFromId,
// so the same id always yields the same star.
import { Mood as ProtoMood, type Star } from '@/shared/api'
import type { Mood } from '@/shared/config'
import { virtualNowMs } from '@/shared/lib/demo'
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
  [ProtoMood.EXCITEMENT]: 'excitement',
  [ProtoMood.GRATITUDE]: 'gratitude',
  [ProtoMood.RELIEF]: 'relief',
  [ProtoMood.STRESS]: 'stress',
  [ProtoMood.TIRED]: 'tired',
  [ProtoMood.EMPTINESS]: 'emptiness',
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
    valence: star.valence,
    // 서버가 GetUniverse에서 계산한 "요즘 토픽" 정합도(spec 26); 데모/구버전 응답엔 0.
    relevance: star.relevance,
    // 폴백 now도 가상 시계(spec 19)로 — 파싱 불가 타임스탬프가 데모 시간과 어긋나지 않게.
    lastRecalledAt: parseEpochMs(star.lastRecalledAt, virtualNowMs()),
    // 일기 단위 그룹/조망 키(spec 28). 구 응답/데모엔 ""·0 — 그룹 셀렉터가 빈 키를 무시한다.
    recordId: star.recordId,
    fragmentIndex: star.fragmentIndex,
    seed: seedFromId(id),
    // 재공고화 상태(spec 23) — proto 기본값 0이면 무변형(기존 별과 동일).
    brightnessOffset: star.brightnessOffset,
    hueShift: star.hueShift,
    formSeedDelta: star.formSeedDelta,
    version: star.version,
  }
  return { id, memory, index }
}
