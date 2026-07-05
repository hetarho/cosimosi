import { m, moodLabel } from '../../../shared/i18n/index.ts'

// Display-only view shape (structural): a proposed memory shows its name, primary mood, and
// neuron membership — nothing else. Edit controls live in features/revise-split (the plan
// consolidates hand-edits there); this feature only renders the current proposal.
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

// features/split-diary ui: the 2–5 proposed-memory list ([E2]), each with its suggested name
// ([W2a]) and primary emotion ([W2]). No position / color / strength / time is shown — the
// editable surface is name / emotion / membership only ([W4a][I3]).
export function ProposedMemoryList({ memories }: ProposedMemoryListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {memories.map((memory) => (
        <li key={memory.id} className="rounded-md border border-border bg-surface p-3">
          <p className="font-medium text-text">{memory.name}</p>
          <p className="flex gap-1 text-sm text-text-muted">
            <span>{m.writing_flow_emotion_label()}</span>
            <span>{moodLabel(memory.mood)}</span>
          </p>
          {memory.neurons.length > 0 ? (
            <p className="flex flex-wrap gap-1 text-sm text-text-subtle">
              <span>{m.writing_flow_neuron_label()}</span>
              <span>{memory.neurons.map((neuron) => neuron.name).join(' · ')}</span>
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
