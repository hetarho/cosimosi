import type { EpisodicMemory } from '@cosimosi/memory'
import { memoryReadings } from '@cosimosi/universe'

import { forgettingStageLabel, m, moodLabel, readingPercent } from '../../../shared/i18n/index.ts'
import { MetaRow } from '../../../shared/ui/MetaRow.tsx'

// entities/episodic-memory ui ([D1]): an episodic memory's readings — emotion color · brightness ·
// 작성일 · 강도 · current forgetting state, each reading but the date carrying the ⓘ that says what
// it means. Every derived value is read from the shared read-time functions
// (effectiveStrength/effectiveBrightness/currentDecayStage) — none re-derived here (A2), and the hints
// only describe what those functions already do.
export function EpisodicMemoryMeta({
  memory,
  universeTime,
}: {
  memory: EpisodicMemory
  // The read-time "now" that drives the forgetting fade + current decay stage [V2][F1].
  universeTime: string | null
}) {
  const { strength, brightness, stage } = memoryReadings(memory, universeTime)
  return (
    <dl className="flex flex-col gap-2">
      <Reading
        label={m.star_meta_emotion()}
        value={moodLabel(memory.emotion.mood)}
        hint={m.star_meta_hint_emotion()}
      />
      <Reading
        label={m.star_meta_brightness()}
        value={readingPercent(brightness)}
        hint={m.star_meta_hint_brightness()}
      />
      {/* The one row with nothing to explain: a date is the fact itself, and an ⓘ that only said
          "this is the date" would teach the diarist to stop pressing the others. */}
      <Reading label={m.star_meta_created()} value={memory.createdUniverseTime} />
      <Reading
        label={m.star_meta_strength()}
        value={strength.toFixed(2)}
        hint={m.star_meta_hint_strength()}
      />
      <Reading
        label={m.star_meta_forgetting_state()}
        value={forgettingStageLabel(stage)}
        hint={m.star_meta_hint_forgetting_state()}
      />
    </dl>
  )
}

// A reading row whose ⓘ is named after the reading it explains.
function Reading({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <MetaRow
      label={label}
      value={value}
      hint={hint ? { text: hint, label: m.star_meta_hint_label({ label }) } : undefined}
    />
  )
}
