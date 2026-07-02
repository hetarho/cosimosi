import { VALUES } from '@cosimosi/config'

export function arousalToInitialStrength(arousal: number): number {
  const boundedArousal = Math.min(1, Math.max(0, arousal))
  return (
    VALUES.emotion.arousalStrengthMin +
    boundedArousal * (VALUES.emotion.arousalStrengthMax - VALUES.emotion.arousalStrengthMin)
  )
}
