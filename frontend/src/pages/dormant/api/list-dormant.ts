// ListDormant client (spec 12) — unary call via the shared MemoryService client (02,
// constitution §6). Maps the proto Star[] to a view model; brightness is computed
// client-side with the same starBrightness (08) used in the canvas (no decay math on
// the server). The response is Star (no body) — the original is fetched on recall (11).
import { memoryClient } from '@/shared/api'
import { isDemoMode, demoStars } from '@/shared/lib/demo'
import { isDormant, moodFromProto, starBrightness, type Mood } from '@/entities/memory'

export interface DormantStar {
  memoryId: string
  mood: Mood
  intensity: number
  lastRecalledAt: number // epoch ms
  brightness: number // floored star brightness (A_MIN ≤ b ≤ 1)
}

export async function listDormant(): Promise<DormantStar[]> {
  const now = Date.now()
  // 체험 모드: 서버가 하던 잠듦 필터를 클라에서 동일 규칙(isDormant)으로 재현한다.
  // (실서버는 dormantCutoff로 미리 걸러주므로 일반 모드는 필터 없이 그대로 매핑한다.)
  const stars = isDemoMode() ? demoStars() : (await memoryClient.listDormant({})).stars
  return stars
    .map((s) => {
      const parsed = Date.parse(s.lastRecalledAt)
      const last = Number.isFinite(parsed) ? parsed : now
      return {
        memoryId: s.memoryId,
        mood: moodFromProto(s.mood),
        intensity: s.intensity,
        lastRecalledAt: last,
        brightness: starBrightness(last, now),
      }
    })
    .filter((s) => !isDemoMode() || isDormant(s.lastRecalledAt, now))
}
