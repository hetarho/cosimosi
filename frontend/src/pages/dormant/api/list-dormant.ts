// /dormant 목록의 뷰 모델 (spec 12). 쿼리의 정체성(키·queryFn·캐시 정책)은
// entities/memory의 dormantQueryOptions가 소유하고(16 — features/recall의 invalidate와
// 같은 출처), 이 페이지는 proto Star[] → DormantStar 매핑(select)만 얹는다. brightness는
// 캔버스와 같은 starBrightness(08)로 클라 계산(서버에 감쇠 수학 없음); 응답 Star에는
// body가 없다 — 원본은 회상(11)에서 가져온다.
import { queryOptions } from '@tanstack/react-query'
import type { ListDormantResponse } from '@/shared/api'
import { virtualNowMs } from '@/shared/lib/demo'
import {
  dormantQueryOptions,
  moodFromProto,
  parseEpochMs,
  starBrightness,
  type Mood,
} from '@/entities/memory'

export interface DormantStar {
  memoryId: string
  mood: Mood
  intensity: number
  lastRecalledAt: number // epoch ms
  brightness: number // floored star brightness (A_MIN ≤ b ≤ 1)
}

function toDormantStars(res: ListDormantResponse): DormantStar[] {
  // 가상 시계(spec 19): 데모 시간 머신과 캔버스 밝기가 같은 now를 보게 한다. 비데모 동일값.
  const now = virtualNowMs()
  return res.stars.map((s) => {
    const last = parseEpochMs(s.lastRecalledAt, now)
    return {
      memoryId: s.memoryId,
      mood: moodFromProto(s.mood),
      intensity: s.intensity,
      lastRecalledAt: last,
      brightness: starBrightness(last, now),
    }
  })
}

/** ListDormant 쿼리 + DormantStar 뷰 모델 select. */
export function dormantStarsQueryOptions() {
  return queryOptions({ ...dormantQueryOptions(), select: toDormantStars })
}
