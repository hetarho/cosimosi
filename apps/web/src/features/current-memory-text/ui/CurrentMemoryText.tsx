import { m } from '../../../shared/i18n/index.ts'

// features/current-memory-text ([R1][G1][F1]): the episodic star's forgotten current-memory text,
// shown FREE — a pure read that advances no clock, spends no 별가루, and restores nothing. The
// composing widget supplies the resolved current decay-stage text (whole while vivid, word-eroded as
// it decays [F1][R8a]); the erosion is not announced — the diarist reads it as it now stands. While
// no text has loaded the panel says so rather than inventing content.
export function CurrentMemoryText({ text }: { text: string | null }) {
  if (!text) {
    return <p className="text-sm text-text-muted italic">{m.star_detail_text_unavailable()}</p>
  }
  return <p className="text-sm leading-relaxed whitespace-pre-wrap text-text">{text}</p>
}
