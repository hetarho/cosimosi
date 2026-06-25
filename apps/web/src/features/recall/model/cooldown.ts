// Re-recall cooldown (change 35). The BE service (service.go recallCooldownRemaining) is the
// authority; this mirrors the same formula so the panel can disable the recall button and the
// demo (no server) can gate locally against the virtual clock. Pure (constitution §4).
import { VALUES } from '@/shared/config'

/** 재회상 쿨다운(ms) — 마지막 회상 후 이만큼 지나야 같은 별 재회상 가능. values.yaml 단일 출처. */
export const RECALL_COOLDOWN_MS = VALUES.recall.recallCooldownMs

/** How long until this star may be recalled again. A never-recalled star (recallCount ≤ 1)
 *  returns 0 — its first recall is always allowed; otherwise RECALL_COOLDOWN_MS minus the time
 *  since the last recall, floored at 0 (0 = cooldown elapsed → recall allowed). now/last are
 *  epoch ms (demo passes the virtual clock). Mirrors BE recallCooldownRemaining. */
export function recallCooldownRemainingMs(
  recallCount: number,
  lastRecalledAtMs: number,
  nowMs: number,
): number {
  if (recallCount <= 1) return 0
  return Math.max(0, RECALL_COOLDOWN_MS - (nowMs - lastRecalledAtMs))
}
