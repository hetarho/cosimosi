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

// effectiveBrightness is the read-time brightness of a memory ([F1][F2]), mirroring the Go
// internal/memory implementation for golden-parity: a floored exponential fade of the offset-
// inclusive elapsed days, stretched (slowed) by arousal ([F6]) and connection strength ([F7]). Shape
// is code; only the coefficients and floor are values. 1.0 at elapsed 0, monotone non-increasing in
// elapsed, clamped into [brightnessFloor, 1] — never below the floor, never 0.
export function effectiveBrightness(
  effectiveElapsedDays: number,
  arousal: number,
  effectiveStrength: number,
): number {
  const floor = VALUES.forgetting.brightnessFloor
  const days = Math.max(0, effectiveElapsedDays)
  const slow = slowFactor(arousal, effectiveStrength)
  const decayFactor = clamp(1 - VALUES.forgetting.brightnessDecayPerDay, 0, 1)
  const brightness = floor + (1 - floor) * decayFactor ** (days / slow)
  return clamp(brightness, floor, 1)
}

// slowFactor stretches the decay time-axis by arousal and connection strength — both non-negative,
// so the factor is >= 1 and dividing by it always slows (never speeds) the fade ([F6][F7]). Shared
// by effectiveBrightness and decayStage so brightness and stage move together ([F1]).
export function slowFactor(arousal: number, effectiveStrength: number): number {
  return (
    1 +
    Math.max(0, arousal) * VALUES.forgetting.arousalSlowCoefficient +
    Math.max(0, effectiveStrength) * VALUES.forgetting.connectionSlowCoefficient
  )
}

function clamp(value: number, minValue: number, maxValue: number): number {
  if (value < minValue) return minValue
  if (value > maxValue) return maxValue
  return value
}
