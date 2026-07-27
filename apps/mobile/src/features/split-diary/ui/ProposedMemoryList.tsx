import { StyleSheet, Text, View } from 'react-native'

import { tokens } from '@cosimosi/ui'

import { MoodChip, NeuronChips } from '../../../entities/episodic-memory/index.ts'

// The display-only proposed-memory view (structural shape shared with web). RN fork of the list.
export interface ProposedMemoryView {
  /** Session-local key for stable reconciliation across merge/split reorder; not a wire/visible field. */
  readonly id: string
  readonly name: string
  readonly mood: string
  readonly sourceText: string
  readonly neurons: readonly { readonly name: string }[]
}

export interface ProposedMemoryListProps {
  readonly memories: readonly ProposedMemoryView[]
}

// features/split-diary ui (RN): the 2–5 proposed memories, each with name + the diary passage it
// was encoded from + primary emotion + neuron membership. No position / color / strength / time is
// shown ([W4a][I3]).
//
// Visual language (web parity): rimmed, unfilled rows — the sheet is a panel already, and a second
// filled surface inside it reads as a slab (§5). The name carries the hierarchy, the passage reads
// as secondary copy, and the emotion arrives as the entity layer's chip (§2.3).
export function ProposedMemoryList({ memories }: ProposedMemoryListProps) {
  return (
    <View style={styles.list}>
      {memories.map((memory) => (
        <View key={memory.id} style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>
              {memory.name}
            </Text>
            <MoodChip mood={memory.mood} />
          </View>
          <Text style={styles.sourceText}>{memory.sourceText}</Text>
          <NeuronChips neurons={memory.neurons} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: tokens.spacing[3] },
  card: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    paddingHorizontal: tokens.spacing[4],
    paddingVertical: tokens.spacing[3],
    gap: tokens.spacing[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[2],
  },
  name: {
    color: tokens.color.text,
    flexShrink: 1,
    fontSize: tokens.fontSize.base,
    fontWeight: '600',
  },
  sourceText: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm, lineHeight: 24 },
})
