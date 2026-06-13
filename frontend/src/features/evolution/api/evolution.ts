// Evolution-history fetch (spec 24). unary only (constitution §6); demo branches to the
// in-memory dummy log (recall.ts is the blueprint). READ-ONLY — never writes.
import { memoryClient, type EvolutionSnapshot } from '@/shared/api'
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
export function toSnapshotVM(s: EvolutionSnapshot): EvolutionSnapshotVM {
  return {
    version: s.version,
    brightness: clamp(NOMINAL_BRIGHTNESS + s.brightness, A_MIN, 1),
    hueShift: s.hueShift,
    formSeedDelta: s.formSeedDelta,
    trigger: s.trigger,
    pe: s.pe,
    dir: s.dir,
    createdAt: s.createdAt,
  }
}

/** A star's variant log, version ascending. Empty is valid (a never-reshaped star). */
export async function getEvolutionHistory(memoryId: string): Promise<EvolutionSnapshotVM[]> {
  if (isDemoMode()) return demoEvolution(memoryId) // 체험: 더미 변천사(백엔드 호출 없음)
  const res = await memoryClient.getEvolutionHistory({ memoryId })
  return res.snapshots.map(toSnapshotVM)
}
