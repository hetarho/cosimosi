// Recall panel (spec 11) — a 2D HUD outside the R3F canvas (Architecture §3.1).
// Clicking a star selects it; the panel opens in a "dwelling" state and only after a
// ≥2s ACTIVE view (1.2/1.11) does it fire RecallMemory — which re-ignites the star
// (last_recalled_at=now) AND returns the immutable original Record (read-only, no edit
// path — constitution §1). The same 2s threshold accumulates the co-recall pair (1.3).
import { useEffect, useState } from 'react'
import type { Record as RecordMsg } from '@/shared/api/gen/cosimosi/v1/memory_pb'
import { moodFromProto, useMemoryStore } from '@/entities/memory'
import { moodLabel } from '@/shared/config'
import { recallMemory } from '../api/recall'
import { DWELL_MS } from '../model'
import { useRecallStore } from '../model/store'
import { NeighborNav } from './NeighborNav'

type Phase = 'dwelling' | 'loading' | 'shown' | 'error'

/** Inner panel for one selected star. Keyed by memoryId so a new selection remounts it
 *  fresh (state resets without a setState-in-effect). */
function RecallView({ memoryId }: { memoryId: string }) {
  const select = useMemoryStore((s) => s.select)
  const recordActiveView = useRecallStore((s) => s.recordActiveView)
  const [record, setRecord] = useState<RecordMsg | null>(null)
  const [phase, setPhase] = useState<Phase>('dwelling')

  useEffect(() => {
    let cancelled = false
    // ≥2s active dwell → a real recall (1.2/1.11). A glance (<2s: closed or star
    // switched) clears the timer → no touch, no co-recall.
    const timer = setTimeout(() => {
      recordActiveView(memoryId) // co-recall pair with the previous active view (1.3)
      setPhase('loading')
      recallMemory(memoryId)
        .then((r) => {
          if (cancelled) return
          setRecord(r ?? null)
          setPhase(r ? 'shown' : 'error')
        })
        .catch(() => {
          if (!cancelled) setPhase('error')
        })
    }, DWELL_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [memoryId, recordActiveView])

  return (
    <div className="flex w-96 max-w-[90vw] flex-col gap-3 rounded-xl border border-white/10 bg-black/50 p-4 backdrop-blur">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-white/80">회상 — 원본 일기</h2>
        <button
          type="button"
          onClick={() => select(null)}
          aria-label="닫기"
          className="rounded-md px-2 text-white/50 transition hover:text-white/90"
        >
          ✕
        </button>
      </header>

      {phase === 'dwelling' && (
        <p className="text-sm text-white/50">별을 바라보는 중… (2초간 머무르면 회상됩니다)</p>
      )}
      {phase === 'loading' && <p className="text-sm text-white/50">기억을 불러오는 중…</p>}
      {phase === 'error' && (
        <p className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300">
          ⚠ 이 기억을 회상하지 못했어요.
        </p>
      )}

      {phase === 'shown' && record && (
        // Read-only: no edit/delete controls (constitution §1, acceptance 1.1).
        <article className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-white/45">
            <span>{record.entryDate}</span>
            <span>·</span>
            <span>{moodLabel(moodFromProto(record.mood))}</span>
            <span>·</span>
            <span>강도 {record.intensity.toFixed(2)}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/85">{record.body}</p>
        </article>
      )}

      <NeighborNav />
    </div>
  )
}

export function MemoryPanel() {
  const selectedId = useMemoryStore((s) => s.selectedId)
  if (!selectedId) return null
  return <RecallView key={selectedId} memoryId={selectedId} />
}
