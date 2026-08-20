import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { VALUES } from '@cosimosi/config'
import { MOODS } from '@cosimosi/emotion'
import { Button, Select, TextArea, TextField, tokens } from '@cosimosi/ui'

import { MoodDot, NeuronChips } from '../../../entities/episodic-memory/index.ts'
import { m, moodLabel } from '../../../shared/i18n/index.ts'

export interface EditableMemoryView {
  /** Session-local key for stable reconciliation across merge/split reorder; not a wire/visible field. */
  readonly id: string
  readonly name: string
  readonly mood: string
  readonly sourceText: string
  readonly neurons: readonly { readonly name: string }[]
}

export interface ReviseControlsProps {
  readonly memories: readonly EditableMemoryView[]
  readonly onRename: (index: number, name: string) => void
  readonly onSetMood: (index: number, mood: string) => void
  readonly onSetSourceText: (index: number, sourceText: string) => void
  readonly onMerge: (index: number) => void
  readonly onSplit: (index: number) => void
  readonly onRevise: (instruction: string) => void
  readonly busy?: boolean
}

// features/revise-split ui (RN fork): hand-edit controls (rename · mood selection · passage
// correction · memory merge/split — the neuron-membership edits [W4][E10]) + the natural-language
// instruction ([W4a]). Mood is a bounded picker; merge/split honor the encode 2–5
// bound from generated config. Only name / emotion / passage / membership are editable — no
// position/color/strength/time ([I3]).
//
// Visual language (web parity): one rimmed, unfilled card per memory (§5), the structural edits as
// low-emphasis outlined controls so the launch stays the sheet's only committing action (§6).
export function ReviseControls({
  memories,
  onRename,
  onSetMood,
  onSetSourceText,
  onMerge,
  onSplit,
  onRevise,
  busy,
}: ReviseControlsProps) {
  const [instruction, setInstruction] = useState('')
  // The floor is what a launch accepts, not the 2–5 target — offering less than the server would
  // take, or more, puts the button and the launch out of step.
  const canMerge = memories.length > VALUES.encode.minMemoriesAccepted
  const canSplit = memories.length < VALUES.encode.maxMemories

  return (
    <View style={styles.root}>
      <View style={styles.cards}>
        {memories.map((memory, index) => (
          <View key={memory.id} style={styles.card}>
            <TextField
              label={m.writing_flow_name_label()}
              value={memory.name}
              onChangeText={(value) => onRename(index, value)}
            />
            <TextArea
              label={m.writing_flow_source_text_label()}
              description={m.writing_flow_source_text_hint()}
              value={memory.sourceText}
              onChangeText={(value) => onSetSourceText(index, value)}
            />
            <View style={styles.moodField}>
              {/* The selected mood's colour rides beside the label as a dot: emotion is domain
                  output shown next to the control, never mixed into the control itself (§2.3). */}
              <View style={styles.labelRow}>
                <MoodDot mood={memory.mood} />
                <Text style={styles.label}>{m.writing_flow_emotion_label()}</Text>
              </View>
              {/* The emotion stays a BOUNDED selection of MOODS ([W4a][I3]) — only the affordance
                  changed. Built per render because the labels are i18n output. */}
              <Select
                ariaLabel={m.writing_flow_emotion_label()}
                items={MOODS.map((mood) => ({ value: mood, label: moodLabel(mood) }))}
                value={memory.mood}
                disabled={busy}
                onValueChange={(mood) => onSetMood(index, mood)}
              />
            </View>
            <NeuronChips neurons={memory.neurons} />
            <View style={styles.actions}>
              <Button
                variant="outlined"
                color="neutral"
                size="sm"
                disabled={busy || !canMerge || index >= memories.length - 1}
                onPress={() => onMerge(index)}
              >
                {m.writing_flow_merge_action()}
              </Button>
              <Button
                variant="outlined"
                color="neutral"
                size="sm"
                disabled={busy || !canSplit}
                onPress={() => onSplit(index)}
              >
                {m.writing_flow_split_memory_action()}
              </Button>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.revise}>
        <TextField
          label={m.writing_flow_revise_action()}
          placeholder={m.writing_flow_instruction_placeholder()}
          value={instruction}
          editable={!busy}
          onChangeText={setInstruction}
        />
        <Button
          variant="outlined"
          color="primary"
          style={styles.reviseAction}
          disabled={busy || instruction.trim().length === 0}
          onPress={() => {
            onRevise(instruction)
            setInstruction('')
          }}
        >
          {m.writing_flow_revise_action()}
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: tokens.spacing[5] },
  cards: { gap: tokens.spacing[3] },
  revise: { gap: tokens.spacing[2] },
  reviseAction: { alignSelf: 'flex-end' },
  card: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing[4],
    gap: tokens.spacing[3],
  },
  moodField: { gap: tokens.spacing[2] },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  label: { color: tokens.color.text, fontSize: tokens.fontSize.sm, fontWeight: '500' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
})
