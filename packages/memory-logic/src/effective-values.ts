import { VALUES } from '@cosimosi/config'

// effectiveStrength grows a memory's size ([V3]) and universe-color weight ([M4]) with recall
// accumulation ([R3]). It mirrors the Go internal/memory implementation byte-for-byte (golden-parity):
// Potentiate's saturating headroom-proportional shape applied recallCount times has the closed form
// cap − (cap − base)·(1 − gain)^recallCount — identity at count 0, monotone, capped.
export function effectiveStrength(baseStrength: number, recallCount: number): number {
  const base = clamp(baseStrength, 0, VALUES.synapse.strengthCap)
  if (recallCount <= 0) return base
  const remaining =
    (VALUES.synapse.strengthCap - base) *
    Math.pow(1 - VALUES.reconsolidation.recallStrengthGain, recallCount)
  return clamp(VALUES.synapse.strengthCap - remaining, base, VALUES.synapse.strengthCap)
}

// effectiveBrightness stays the Epic-D stub (full brightness) until the forgetting decay ([V2]) drives
// it, so callers read through it now without a later signature change.
export function effectiveBrightness(_elapsedUniverseDays: number): number {
  return 1
}

function clamp(value: number, minValue: number, maxValue: number): number {
  if (value < minValue) return minValue
  if (value > maxValue) return maxValue
  return value
}
