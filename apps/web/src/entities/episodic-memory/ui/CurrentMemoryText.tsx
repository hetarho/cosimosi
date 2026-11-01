import { ObscuredText } from '@cosimosi/ui'
import type { DecayTextSpan } from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'

// features/current-memory-text ([R1][G1][F1]): the episodic star's forgotten current-memory text,
// shown FREE — a pure read that advances no clock, spends no 별가루, and restores nothing. The
// composing widget supplies the resolved current decay-stage text already cut into runs (whole while
// vivid, eroded as it decays [F1][R8a]); a run the forgetting took is drawn as a smear rather than
// as the marker standing in for it, so the loss is something the diarist sees rather than reads.
// The erosion is still not announced — there is no warning, no label, no count. While no text has
// loaded the panel says so rather than inventing content.
export function CurrentMemoryText({ spans }: { spans: readonly DecayTextSpan[] | null }) {
  if (!spans || spans.length === 0) {
    return <p className="text-sm text-text-muted italic">{m.star_detail_text_unavailable()}</p>
  }
  return (
    <ObscuredText
      spans={spans.map((span) => ({ text: span.text, obscured: span.lost }))}
      className="whitespace-pre-wrap"
    />
  )
}
