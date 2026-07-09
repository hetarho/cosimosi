import { useState } from 'react'

import { VALUES } from '@cosimosi/config'
import { MOODS } from '@cosimosi/emotion'
import { Button, TextField } from '@cosimosi/ui'

import { m, moodLabel } from '../../../shared/i18n/index.ts'

// The editable view — only name / mood / neuron membership; there is structurally no field for
// position / color / strength / time here ([W4a][I3]).
export interface EditableMemoryView {
  /** Session-local key for stable reconciliation across merge/split reorder; not a wire/visible field. */
  readonly id: string
  readonly name: string
  readonly mood: string
  readonly neurons: readonly { readonly name: string }[]
}

export interface ReviseControlsProps {
  readonly memories: readonly EditableMemoryView[]
  readonly onRename: (index: number, name: string) => void
  readonly onSetMood: (index: number, mood: string) => void
  /** Merge memory `index` with the one after it. */
  readonly onMerge: (index: number) => void
  /** Split memory `index` into two. */
  readonly onSplit: (index: number) => void
  /** Round-trip the current proposal + the instruction through ReviseSplit. */
  readonly onRevise: (instruction: string) => void
  readonly busy?: boolean
}

// features/revise-split ui: the hand-edit controls (rename · primary-emotion selection · memory
// merge/split — the neuron-membership edits [W4][E10]) PLUS the natural-language instruction that
// re-runs the split ([W4a]). Both reach the same result; the widget applies hand-edits locally and
// replaces the proposal on an NL revise. Merge/split honor the encode 2–5 bound ([E2], surfaced
// from generated config, never hardcoded).
export function ReviseControls({
  memories,
  onRename,
  onSetMood,
  onMerge,
  onSplit,
  onRevise,
  busy,
}: ReviseControlsProps) {
  const [instruction, setInstruction] = useState('')
  const canMerge = memories.length > VALUES.encode.minMemories
  const canSplit = memories.length < VALUES.encode.maxMemories

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {memories.map((memory, index) => (
          <li
            key={memory.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3"
          >
            <TextField
              label={m.writing_flow_name_label()}
              value={memory.name}
              onChange={(event) => onRename(index, event.target.value)}
            />
            <label className="flex flex-col gap-1.5 text-sm font-medium text-text">
              <span>{m.writing_flow_emotion_label()}</span>
              <select
                className="h-10 rounded-md border border-border bg-surface px-3 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                value={memory.mood}
                onChange={(event) => onSetMood(index, event.target.value)}
              >
                {MOODS.map((mood) => (
                  <option key={mood} value={mood}>
                    {moodLabel(mood)}
                  </option>
                ))}
              </select>
            </label>
            {memory.neurons.length > 0 ? (
              <p className="flex flex-wrap gap-1 text-sm text-text-subtle">
                <span>{m.writing_flow_neuron_label()}</span>
                <span>{memory.neurons.map((neuron) => neuron.name).join(' · ')}</span>
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button
                color="neutral"
                disabled={busy || !canMerge || index >= memories.length - 1}
                onClick={() => onMerge(index)}
              >
                {m.writing_flow_merge_action()}
              </Button>
              <Button color="neutral" disabled={busy || !canSplit} onClick={() => onSplit(index)}>
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
          color="neutral"
          className="self-start"
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
