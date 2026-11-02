import { IconButton, NoticeIcon, Tooltip } from '@cosimosi/ui'

// A row of a reading table, and — for every row that is a reading rather than a fact anyone can read
// off a calendar — the ⓘ that says what the reading MEANS: where it comes from, what it does, and
// what makes it move. A number like 0.87 or a word like 아스라함 is not self-explaining, and a panel
// that shows five of them and explains none is asking the reader to guess.
//
// The mark rides INSIDE the term, next to the word it explains, and its negative inset gives its 24px
// hit area back to the row: a control tall enough to press must not be what sets the spacing of a
// table of readings. The tip opens on a press as well as on hover — the panel is a bottom sheet on a
// phone, where there is no hover to open anything with — sits ABOVE the row, since these rows are in
// the lower half of the screen on that shape, and hangs from the mark's left edge so a sentence-long
// tip stays on screen in a narrow sheet.
export function MetaRow({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  /** What the reading means, and the accessible name of the mark that opens it. */
  hint?: { text: string; label: string }
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="flex items-center gap-0.5 text-text-muted">
        {label}
        {hint ? (
          <Tooltip content={hint.text} side="top" align="start" press wrap>
            <IconButton
              variant="text"
              color="neutral"
              size="sm"
              className="-my-1.5 rounded-full"
              label={hint.label}
              icon={<NoticeIcon />}
            />
          </Tooltip>
        ) : null}
      </dt>
      <dd className="text-text">{value}</dd>
    </div>
  )
}
