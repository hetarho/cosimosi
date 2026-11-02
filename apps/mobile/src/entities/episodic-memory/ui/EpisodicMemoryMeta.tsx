import { StyleSheet, View } from 'react-native'

import type { EpisodicMemory } from '@cosimosi/memory'
import { tokens } from '@cosimosi/ui'
import { memoryReadings } from '@cosimosi/universe'

import { forgettingStageLabel, m, moodLabel, readingPercent } from '../../../shared/i18n/index.ts'
import { MetaRow } from '../../../shared/ui/MetaRow.tsx'

// entities/episodic-memory ui (RN fork, [D1]): an episodic memory's readings — emotion · brightness ·
// written date · strength · current forgetting state. Every derived value is read from the shared
// read-time functions, none re-derived (A2) — identical logic to the web fork.
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
    <View style={styles.readingList}>
      <MetaRow
        reading
        label={m.star_meta_emotion()}
        value={moodLabel(memory.emotion.mood)}
        hint={m.star_meta_hint_emotion()}
      />
      <MetaRow
        reading
        label={m.star_meta_brightness()}
        value={readingPercent(brightness)}
        hint={m.star_meta_hint_brightness()}
      />
      <MetaRow reading label={m.star_meta_created()} value={memory.createdUniverseTime} />
      <MetaRow
        reading
        label={m.star_meta_strength()}
        value={strength.toFixed(2)}
        hint={m.star_meta_hint_strength()}
      />
      <MetaRow
        reading
        fullWidth
        label={m.star_meta_forgetting_state()}
        value={forgettingStageLabel(stage)}
        hint={m.star_meta_hint_forgetting_state()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  readingList: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[5] },
})
