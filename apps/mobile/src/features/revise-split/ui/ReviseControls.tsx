import {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {VALUES} from '@cosimosi/config';
import {MOODS} from '@cosimosi/emotion';
import {Button, TextField, tokens} from '@cosimosi/ui';

import {m, moodLabel} from '../../../shared/i18n/index.ts';

export interface EditableMemoryView {
  /** Session-local key for stable reconciliation across merge/split reorder; not a wire/visible field. */
  readonly id: string;
  readonly name: string;
  readonly mood: string;
  readonly neurons: readonly {readonly name: string}[];
}

export interface ReviseControlsProps {
  readonly memories: readonly EditableMemoryView[];
  readonly onRename: (index: number, name: string) => void;
  readonly onSetMood: (index: number, mood: string) => void;
  readonly onMerge: (index: number) => void;
  readonly onSplit: (index: number) => void;
  readonly onRevise: (instruction: string) => void;
  readonly busy?: boolean;
}

// features/revise-split ui (RN fork): hand-edit controls (rename · mood selection · memory
// merge/split — the neuron-membership edits [W4][E10]) + the natural-language instruction ([W4a]).
// Mood is a chip row (RN has no <select>); merge/split honor the encode 2–5 bound from generated
// config. Only name / emotion / membership are editable — no position/color/strength/time ([I3]).
export function ReviseControls({memories, onRename, onSetMood, onMerge, onSplit, onRevise, busy}: ReviseControlsProps) {
  const [instruction, setInstruction] = useState('');
  const canMerge = memories.length > VALUES.encode.minMemories;
  const canSplit = memories.length < VALUES.encode.maxMemories;

  return (
    <View style={styles.root}>
      <View style={styles.cards}>
        {memories.map((memory, index) => (
          <View key={memory.id} style={styles.card}>
            <TextField label={m.writing_flow_name_label()} value={memory.name} onChangeText={value => onRename(index, value)} />
            <Text style={styles.label}>{m.writing_flow_emotion_label()}</Text>
            <View style={styles.chips}>
              {MOODS.map(mood => {
                const selected = mood === memory.mood;
                return (
                  <Pressable
                    key={mood}
                    accessibilityRole="button"
                    accessibilityState={{selected}}
                    disabled={busy}
                    onPress={() => onSetMood(index, mood)}
                    style={[styles.chip, selected ? styles.chipSelected : null]}>
                    <Text style={selected ? styles.chipTextSelected : styles.chipText}>{moodLabel(mood)}</Text>
                  </Pressable>
                );
              })}
            </View>
            {memory.neurons.length > 0 ? (
              <Text style={styles.neurons}>
                {m.writing_flow_neuron_label()} {memory.neurons.map(neuron => neuron.name).join(' · ')}
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Button color="neutral" disabled={busy || !canMerge || index >= memories.length - 1} onPress={() => onMerge(index)}>
                {m.writing_flow_merge_action()}
              </Button>
              <Button color="neutral" disabled={busy || !canSplit} onPress={() => onSplit(index)}>
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
          color="neutral"
          disabled={busy || instruction.trim().length === 0}
          onPress={() => {
            onRevise(instruction);
            setInstruction('');
          }}>
          {m.writing_flow_revise_action()}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {gap: 16},
  cards: {gap: 12},
  revise: {gap: 8},
  card: {borderWidth: 1, borderColor: tokens.color.border, borderRadius: 8, backgroundColor: tokens.color.surface, padding: 12, gap: 8},
  label: {color: tokens.color.text, fontSize: 13, fontWeight: '500'},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  chip: {borderWidth: 1, borderColor: tokens.color.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4},
  chipSelected: {borderColor: tokens.color.primary, backgroundColor: tokens.color.primary},
  chipText: {color: tokens.color['text-muted'], fontSize: 13},
  chipTextSelected: {color: tokens.color['primary-foreground'], fontSize: 13},
  neurons: {color: tokens.color['text-subtle'], fontSize: 13},
  actions: {flexDirection: 'row', gap: 8},
});
