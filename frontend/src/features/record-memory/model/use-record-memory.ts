// Optimistic record flow (spec 10): submit → optimistic addStar → RecordMemory →
// replaceStar(server id) on success / removeStar rollback on failure (StarNode-based,
// constitution §2/§3·§6). body/entryDate stay in the draft (never the render store).
import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  moodFromProto,
  seedFromId,
  universeInvalidateKey,
  useMemoryStore,
  type StarNode,
} from '@/entities/memory'
import { recordMemory } from '../api/record-memory'
import { useDraftStore } from './draft-store'

type DomainMood = StarNode['memory']['mood']

// 워커가 임베딩→시냅스를 만들 시간(§4.6 "연결은 다음 refetch에서"). 횟수 제한 1회 —
// 무한/조건 폴링 금지(spec 16): 이웃이 없어 링크가 0개여도 정상이다.
const WORKER_SYNC_DELAY_MS = 10_000

// 연속 기록을 하나로 코알레스: 마지막 기록 +10s에 1회만 invalidate(그 refetch가 그동안의
// 별·시냅스를 전부 포함한다) — K개 연속 제출이 K번의 전체 우주 refetch가 되지 않게.
let workerSyncTimer: ReturnType<typeof setTimeout> | null = null

function buildStar(id: string, mood: DomainMood, intensity: number): StarNode {
  return {
    id,
    index: 0, // store assigns the real slot on add/replace
    memory: { id, mood, intensity, lastRecalledAt: Date.now(), seed: seedFromId(id) },
  }
}

export function useRecordMemory() {
  const queryClient = useQueryClient()
  const submit = useCallback(async () => {
    const draft = useDraftStore.getState()

    if (draft.status === 'submitting') return // guard a fast double-submit
    if (!draft.body.trim()) {
      useDraftStore.getState().setError('일기 본문을 입력하세요')
      return
    }

    const moodStr = moodFromProto(draft.mood)
    const tempId = `temp-${crypto.randomUUID()}`
    useMemoryStore.getState().addStar(buildStar(tempId, moodStr, draft.intensity)) // 별 즉시 등장 (1.1)
    useDraftStore.getState().setStatus('submitting')

    try {
      const memoryId = await recordMemory({
        body: draft.body,
        mood: draft.mood,
        intensity: draft.intensity,
        entryDate: draft.entryDate,
        idempotencyKey: tempId, // dedup a retried submit server-side
      })
      const memory = useMemoryStore.getState()
      // 출처 리셋(로그아웃·체험 전환)이 제출 중에 일어났으면 temp가 이미 사라졌다 — 이
      // 별은 이전 출처 소유라 새 세션에 반영하지 않는다(replaceStar도 no-op). 서버엔
      // 커밋돼 있으므로 소유자의 다음 GetUniverse가 보여준다.
      const tempAlive = memory.stars.some((st) => st.id === tempId)
      // 서버 id로 확정 별 교체, 기존 별 위치 유지 (1.2)
      memory.replaceStar(tempId, buildStar(memoryId, moodStr, draft.intensity))
      useDraftStore.getState().reset()
      // 별은 즉시(위 낙관), 연결은 다음 refetch에서(spec 16 1.3): ~10s 뒤 1회 invalidate →
      // 워커가 만든 시냅스가 새로고침 없이 나타난다. queryClient는 앱 수명 싱글턴이라
      // 페이지를 떠나도 안전하다(비활성 쿼리는 stale 마킹 → 다음 마운트에서 refetch).
      if (tempAlive) {
        if (workerSyncTimer) clearTimeout(workerSyncTimer)
        workerSyncTimer = setTimeout(() => {
          workerSyncTimer = null
          void queryClient.invalidateQueries({ queryKey: universeInvalidateKey() })
        }, WORKER_SYNC_DELAY_MS)
      }
    } catch {
      // 임시 별만 롤백, 서버 별 보존 (1.3 / 헌법2)
      useMemoryStore.getState().removeStar(tempId)
      useDraftStore.getState().setError('별을 띄우지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }, [queryClient])

  return { submit }
}
