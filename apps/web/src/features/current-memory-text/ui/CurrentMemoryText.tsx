import { m } from '../../../shared/i18n/index.ts'

// features/current-memory-text ([R1][G1][F1]): the episodic star's forgotten current memory text,
// shown FREE — a pure read that advances no clock, spends no 별가루, and restores nothing (A3).
// The decay-stage word erasure ([F1]) renders the text faded once the forgetting layer stores the
// per-stage forgetting-texts; until then the full text shows unerased (CC1). The text is supplied
// by the composing widget from the memory-representation read (still deferred); while no source is
// wired the panel says so rather than inventing content.
export function CurrentMemoryText({ text }: { text: string | null }) {
  if (!text) {
    return <p className="text-sm text-text-muted italic">{m.star_detail_text_unavailable()}</p>
  }
  return <p className="text-sm leading-relaxed whitespace-pre-wrap text-text">{text}</p>
}
