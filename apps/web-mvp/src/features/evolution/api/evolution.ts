// Evolution-history fetch (spec 24). unary only (constitution §6); demo branches to the
// in-memory dummy log (recall.ts is the blueprint). READ-ONLY — never writes.
import { createConnectQueryKey } from '@connectrpc/connect-query'
import { MemoryService, memoryClient, type EvolutionSnapshot } from '@/shared/api'
import { A_MIN } from '@/entities/memory'
import { isDemoMode, demoEvolution } from '@/shared/lib/demo'
import type { EvolutionSnapshotVM } from '../model'

// The stored snapshot carries the cumulative brightness OFFSET (spec 23 writes
// brightness_offset). The historical absolute brightness depended on the star's
// time-decayed activation at that moment, which the log doesn't capture — so the viewer
// reconstructs an illustrative display brightness as nominal + offset, floored at A_MIN
// (the same floor a real star never drops below). This keeps the timelapse readable
// (the variant's relative ↑/↓) without claiming a precision the log can't provide.
const NOMINAL_BRIGHTNESS = 0.7

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** proto EvolutionSnapshot → viewer VM (offset → display brightness). */
function toSnapshotVM(s: EvolutionSnapshot): EvolutionSnapshotVM {
  return {
    version: s.version,
    brightness: clamp(NOMINAL_BRIGHTNESS + s.brightness, A_MIN, 1),
    hueShift: s.hueShift,
    formSeedDelta: s.formSeedDelta,
    trigger: s.trigger,
    pe: s.pe,
    dir: s.dir,
    createdAt: s.createdAt,
    content: s.content, // 54: AI 내용 변형 텍스트(그 외 트리거는 "")
    abstractionStage: s.abstractionStage, // 32: 'nightly_gist' 시점 단계(그 외 0)
  }
}

/** GetEvolutionHistory 쿼리 키 — 별별 변천사 fetch 키이자 (장차) invalidate 키. 손 배열
 *  대신 스키마 파생으로 두면 키 모양이 바뀌어도 fetch·invalidate가 함께 움직여 무효화가
 *  조용히 no-op이 되지 않는다(universe/dormant 키 규약과 동일). input까지 넣어 별마다 분리. */
export function evolutionQueryKey(memoryId: string) {
  return createConnectQueryKey({
    schema: MemoryService.method.getEvolutionHistory,
    input: { memoryId },
    cardinality: 'finite',
  })
}

/** A star's variant log, version ascending. Empty is valid (a never-reshaped star). */
export async function getEvolutionHistory(memoryId: string): Promise<EvolutionSnapshotVM[]> {
  // 체험: 더미 변천사(백엔드 호출 없음). 데모는 내용 변형(spec 54)을 하지 않으니 content는 ""(형태/색 변주만).
  if (isDemoMode()) return demoEvolution(memoryId).map((s) => ({ ...s, content: '' }))
  const res = await memoryClient.getEvolutionHistory({ memoryId })
  return res.snapshots.map(toSnapshotVM)
}
