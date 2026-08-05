import { currentDecayText, useEpisodicMemoryStore } from '@cosimosi/universe'

import { useHoveredMemoryStore } from '../model/hovered-memory-store.ts'

// The hover label is a glimpse, not the read (the panel holds the full text) — keep it to one line.
const GLIMPSE_LIMIT = 60

function truncateGlimpse(text: string): string {
  const trimmed = text.trim()
  return trimmed.length > GLIMPSE_LIMIT ? `${trimmed.slice(0, GLIMPSE_LIMIT)}…` : trimmed
}

/**
 * The hover glimpse: a truncated current decay-stage text, so an eroded memory reads as eroded
 * before the panel opens ([F1][R8a]). The label is the preview; the panel is the full read with
 * word-loss recovery.
 *
 * It subscribes to the hover index itself instead of taking it as a prop, so moving the pointer
 * between stars re-renders this one line rather than the composing scene host.
 */
export function HoverGlimpse({ universeTime }: { readonly universeTime: string | null }) {
  const index = useHoveredMemoryStore((state) => state.index)
  const ids = useEpisodicMemoryStore((state) => state.ids)
  const byId = useEpisodicMemoryStore((state) => state.byId)
  const hoveredId = index === null ? null : (ids[index] ?? null)
  const memory = hoveredId ? byId[hoveredId] : undefined
  const text = memory ? truncateGlimpse(currentDecayText(memory, universeTime)) : ''
  if (!text) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center px-4">
      <p className="max-w-measure truncate rounded-full border border-border bg-surface/80 px-4 py-1.5 text-sm text-text-muted backdrop-blur">
        {text}
      </p>
    </div>
  )
}
