import { useTwinkleBalanceFigures } from '@cosimosi/twinkle/react'
import { TwinkleGeneralIcon, TwinkleSmallIcon, VisuallyHidden } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// entities/twinkle ui ([G2][G5]): the balance reading. SMALL (today's recall-only allowance) and
// GENERAL (the universal permanent reserve) are always distinct — the same glyph at two densities —
// and there is NO SUMMED FIGURE: beside the two it only repeats them, and a total would overstate
// spending power, since what an act costs is drawn from one kind or the other ([G5][P9]). Figures
// only: no meaning-layer or placement control ([I11]).
//
// One reading in three forms, all from the same shared figures and their placeholder:
// - `inline`: one line, both labels inline — the over-canvas reading where there is room to name them.
// - `stacked`: icons and figures alone, the names kept for assistive tech — the phone's corner.
// - `list`: each figure named beside its own glyph, at rest on a surface that has room for them.
// The inline and stacked forms draw no surface and no frame: the composing surface decides whether
// the reading is a control and how it sits on the sky.
export function TwinkleBalance({ form }: { readonly form: 'inline' | 'stacked' | 'list' }) {
  const { small, general } = useTwinkleBalanceFigures()
  const kinds = [
    { icon: TwinkleSmallIcon, label: m.twinkle_balance_small_label(), value: small },
    { icon: TwinkleGeneralIcon, label: m.twinkle_balance_general_label(), value: general },
  ]

  if (form === 'list') {
    return (
      <dl className="flex flex-col gap-2">
        {kinds.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-sm text-text-muted">
              <Icon className="shrink-0" />
              {label}
            </dt>
            <dd className="text-lg font-medium tabular-nums text-text">{value}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <>
      {kinds.map(({ icon: Icon, label, value }) => (
        <span key={label} className="flex items-center gap-1.5">
          <Icon className="shrink-0 text-text-muted" />
          {form === 'inline' ? (
            <span className="whitespace-nowrap text-xs text-text-muted">{label}</span>
          ) : (
            <VisuallyHidden>{label}</VisuallyHidden>
          )}
          <span className="text-sm font-medium tabular-nums text-text">{value}</span>
        </span>
      ))}
    </>
  )
}
