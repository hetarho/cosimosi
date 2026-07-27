import { useId, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import { MOODS } from '@cosimosi/emotion'
import { Button, TextArea, TextField } from '@cosimosi/ui'

import { MoodDot, NeuronChips } from '../../../entities/episodic-memory/index.ts'
import { m, moodLabel } from '../../../shared/i18n/index.ts'

// The editable view — only name / mood / source text / neuron membership; there is structurally no
// field for position / color / strength / time here ([W4a][I3]).
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
  /** Merge memory `index` with the one after it. */
  readonly onMerge: (index: number) => void
  /** Split memory `index` into two. */
  readonly onSplit: (index: number) => void
  /** Round-trip the current proposal + the instruction through ReviseSplit. */
  readonly onRevise: (instruction: string) => void
  readonly busy?: boolean
}

// There is no Select primitive in the design system, so the native control wears the design
// system's own field recipe (`field-surface` — the recessed well, its focus ring and validation
// rim included) instead of a rim and fill painted on here. Geometry matches TextField `md`.
const SELECT_CLASS =
  'field-surface w-full rounded-lg px-3 text-base text-text h-10 ' +
  'disabled:opacity-50 disabled:pointer-events-none'

// features/revise-split ui: the hand-edit controls (rename · primary-emotion selection · passage
// correction · memory merge/split — the neuron-membership edits [W4][E10]) PLUS the natural-language instruction that
// re-runs the split ([W4a]). Both reach the same result; the widget applies hand-edits locally and
// replaces the proposal on an NL revise. Merge/split honor the encode 2–5 bound ([E2], surfaced
// from generated config, never hardcoded).
//
// Visual language: one rimmed, unfilled card per memory (§5 — the sheet is glass), the fields in
// their own well material, and the structural edits as low-emphasis outlined controls so the
// launch stays the only committing action in the sheet (§6).
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
  const canMerge = memories.length > VALUES.encode.minMemories
  const canSplit = memories.length < VALUES.encode.maxMemories

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-3">
        {memories.map((memory, index) => (
          <li key={memory.id} className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <TextField
              label={m.writing_flow_name_label()}
              value={memory.name}
              onChange={(event) => onRename(index, event.target.value)}
            />
            <TextArea
              label={m.writing_flow_source_text_label()}
              description={m.writing_flow_source_text_hint()}
              value={memory.sourceText}
              rows={4}
              onChange={(event) => onSetSourceText(index, event.target.value)}
            />
            <MoodField
              mood={memory.mood}
              disabled={busy}
              onChange={(mood) => onSetMood(index, mood)}
            />
            <NeuronChips neurons={memory.neurons} />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outlined"
                color="neutral"
                size="sm"
                disabled={busy || !canMerge || index >= memories.length - 1}
                onClick={() => onMerge(index)}
              >
                {m.writing_flow_merge_action()}
              </Button>
              <Button
                variant="outlined"
                color="neutral"
                size="sm"
                disabled={busy || !canSplit}
                onClick={() => onSplit(index)}
              >
                {m.writing_flow_split_memory_action()}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2">
        <TextField
          label={m.writing_flow_revise_action()}
          placeholder={m.writing_flow_instruction_placeholder()}
          value={instruction}
          disabled={busy}
          onChange={(event) => setInstruction(event.target.value)}
        />
        <Button
          variant="outlined"
          color="primary"
          className="self-end"
          disabled={busy || instruction.trim().length === 0}
          onClick={() => {
            onRevise(instruction)
            setInstruction('')
          }}
        >
          {m.writing_flow_revise_action()}
        </Button>
      </div>
    </div>
  )
}

// The mood field mirrors TextField's label rhythm, and the selected mood's colour rides beside the
// label as a dot — the emotion is domain output shown next to the control, never mixed into the
// control's own fill (§2.3). The label still carries the meaning, so the dot can be ignored.
function MoodField({
  mood,
  disabled,
  onChange,
}: {
  mood: string
  disabled?: boolean
  onChange: (mood: string) => void
}) {
  const fieldId = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="flex items-center gap-2 text-sm font-medium text-text">
        <MoodDot mood={mood} />
        {m.writing_flow_emotion_label()}
      </label>
      <select
        id={fieldId}
        className={SELECT_CLASS}
        value={mood}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {MOODS.map((option) => (
          <option key={option} value={option}>
            {moodLabel(option)}
          </option>
        ))}
      </select>
    </div>
  )
}
