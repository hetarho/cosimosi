// Optimistic record flow (spec 10): submit → optimistic addStar → RecordMemory →
// replaceStar(server id) on success / removeStar rollback on failure (StarNode-based,
// constitution §2/§3·§6). body/entryDate stay in the draft (never the render store).
import { useCallback } from 'react'
import { moodFromProto, seedFromId, useMemoryStore, type StarNode } from '@/entities/memory'
import { recordMemory } from '../api/record-memory'
import { useDraftStore } from './draft-store'

type DomainMood = StarNode['memory']['mood']

function buildStar(id: string, mood: DomainMood, intensity: number): StarNode {
  return {
    id,
    index: 0, // store assigns the real slot on add/replace
    memory: { id, mood, intensity, lastRecalledAt: Date.now(), seed: seedFromId(id) },
  }
}

export function useRecordMemory() {
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
      // 서버 id로 확정 별 교체, 기존 별 위치 유지 (1.2)
      useMemoryStore.getState().replaceStar(tempId, buildStar(memoryId, moodStr, draft.intensity))
      useDraftStore.getState().reset()
    } catch {
      // 임시 별만 롤백, 서버 별 보존 (1.3 / 헌법2)
      useMemoryStore.getState().removeStar(tempId)
      useDraftStore.getState().setError('별을 띄우지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }, [])

  return { submit }
}
