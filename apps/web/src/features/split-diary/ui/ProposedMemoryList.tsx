import { MoodChip, NeuronChips } from '../../../entities/episodic-memory/index.ts'

// Display-only view shape (structural): a proposed memory shows its name, primary mood, the diary
// passage it was encoded from, and neuron membership — nothing else. Edit controls live in
// features/revise-split (the plan consolidates hand-edits there); this feature only renders the
// current proposal.
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

// features/split-diary ui: the 2–5 proposed-memory list ([E2]), each with its suggested name
// ([W2a]), primary emotion ([W2]), and the passage of the diary it was encoded from. No position /
// color / strength / time is shown — the editable surface is name / emotion / passage / membership
// ([W4a][I3]).
//
// Visual language: rimmed, unfilled rows — the sheet they sit in is glass, and a second opaque
// surface inside it would kill the material (§5). The name carries the hierarchy, the passage reads
// as secondary copy, and the emotion arrives as a chip from the entity layer (§2.3).
export function ProposedMemoryList({ memories }: ProposedMemoryListProps) {
  return (
    <ul className="flex flex-col gap-3">
      {memories.map((memory) => (
        <li
          key={memory.id}
          className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 truncate text-base font-semibold text-text">{memory.name}</p>
            <MoodChip mood={memory.mood} />
          </div>
          <p className="text-sm leading-6 whitespace-pre-wrap text-text-muted">
            {memory.sourceText}
          </p>
          <NeuronChips neurons={memory.neurons} />
        </li>
      ))}
    </ul>
  )
}
