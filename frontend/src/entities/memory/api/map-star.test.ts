import { describe, expect, it } from 'vitest'
import { Mood as ProtoMood } from '@/shared/api'
import { moodFromProto } from './map-star'

describe('moodFromProto (proto Mood → domain mood)', () => {
  // Derived from the generated proto enum so a newly-added Mood value can't
  // silently fall through to the 'neutral' fallback unnoticed — the FE half of
  // spec 29's parity guard (AC 1.7), mirroring the BE TestEveryProtoMoodRoundTrips.
  const protoValues = Object.values(ProtoMood).filter(
    (v): v is ProtoMood => typeof v === 'number' && v !== ProtoMood.MOOD_UNSPECIFIED,
  )

  it('maps every non-UNSPECIFIED proto Mood to a distinct domain mood', () => {
    const mapped = protoValues.map(moodFromProto)
    // A proto value missing from PROTO_TO_MOOD would resolve to the 'neutral'
    // fallback, colliding with NEUTRAL and shrinking the set below the count.
    expect(new Set(mapped).size).toBe(protoValues.length)
  })

  it('falls back to neutral on UNSPECIFIED (never throws)', () => {
    expect(moodFromProto(ProtoMood.MOOD_UNSPECIFIED)).toBe('neutral')
  })
})
