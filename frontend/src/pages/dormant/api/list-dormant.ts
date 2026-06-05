// ListDormant client (spec 12) — unary call via the shared MemoryService client (02,
// constitution §6). Maps the proto Star[] to a view model; brightness is computed
// client-side with the same starBrightness (08) used in the canvas (no decay math on
// the server). The response is Star (no body) — the original is fetched on recall (11).
import { memoryClient } from '@/shared/api'
import { moodFromProto, starBrightness, type Mood } from '@/entities/memory'

export interface DormantStar {
  memoryId: string
  mood: Mood
  intensity: number
  lastRecalledAt: number // epoch ms
  brightness: number // floored star brightness (A_MIN ≤ b ≤ 1)
}

export async function listDormant(): Promise<DormantStar[]> {
  const res = await memoryClient.listDormant({})
  const now = Date.now()
  return res.stars.map((s) => {
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
}
