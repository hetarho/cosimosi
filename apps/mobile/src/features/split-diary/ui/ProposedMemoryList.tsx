import { StyleSheet, Text, View } from 'react-native'

import { tokens } from '@cosimosi/ui'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

// The display-only proposed-memory view (structural shape shared with web). RN fork of the list.
export interface ProposedMemoryView {
  /** Session-local key for stable reconciliation across merge/split reorder; not a wire/visible field. */
  readonly id: string
  readonly name: string
  readonly mood: string
  readonly neurons: readonly { readonly name: string }[]
}

export interface ProposedMemoryListProps {
  readonly memories: readonly ProposedMemoryView[]
}

// features/split-diary ui (RN): the 2–5 proposed memories, each with name + primary emotion +
// neuron membership. No position / color / strength / time is shown ([W4a][I3]).
export function ProposedMemoryList({ memories }: ProposedMemoryListProps) {
  return (
    <View style={styles.list}>
      {memories.map((memory) => (
        <View key={memory.id} style={styles.card}>
          <Text style={styles.name}>{memory.name}</Text>
          <Text style={styles.meta}>
            {m.writing_flow_emotion_label()} {moodLabel(memory.mood)}
          </Text>
          {memory.neurons.length > 0 ? (
            <Text style={styles.neurons}>
              {m.writing_flow_neuron_label()}{' '}
              {memory.neurons.map((neuron) => neuron.name).join(' · ')}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  card: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 8,
    backgroundColor: tokens.color.surface,
    padding: 12,
    gap: 2,
  },
  name: { color: tokens.color.text, fontWeight: '500' },
  meta: { color: tokens.color['text-muted'], fontSize: 13 },
  neurons: { color: tokens.color['text-subtle'], fontSize: 13 },
})
