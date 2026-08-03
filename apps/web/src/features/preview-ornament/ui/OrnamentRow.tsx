import { ornamentCost, type Ornament } from '@cosimosi/store'
import { ornamentName } from '@cosimosi/store/i18n'
import { m } from '../../../shared/i18n/index.ts'

// features/preview-ornament ui: one catalog row. What it shows about ownership is a price or its
// absence, and nothing else ([P7]) — there is no badge, no lock icon and no ownership word, because
// the view model it reads carries no `owned` field to render. Nor does the live row say so in words:
// the selected treatment already says which one is on, so a label beside it only repeats it.
//
// Every row is selectable, owned or not: picking one applies it to the real universe at once, which
// is what makes the price the only thing left to say ([P6]).
export function OrnamentRow({
  ornament,
  applied,
  disabled = false,
  onPreview,
}: {
  readonly ornament: Ornament
  readonly applied: boolean
  /** True while a save is in flight: what is being bought must not change under the request. */
  readonly disabled?: boolean
  readonly onPreview: (ornament: Ornament) => void
}) {
  const cost = ornamentCost(ornament)
  return (
    <li>
      {/* The live choice takes the design system's selected treatment (`.item-selected`, the held
          form of the text button's highlight) rather than a one-step background change, which was not
          findable at a glance over a moving universe. */}
      <button
        type="button"
        aria-current={applied ? 'true' : undefined}
        disabled={disabled}
        onClick={() => onPreview(ornament)}
        className={`flex w-full items-baseline justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition hover:bg-surface-hover disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
          applied ? 'item-selected font-medium' : 'text-text-muted'
        }`}
      >
        <span className="truncate">{ornamentName(ornament.id)}</span>
        <span
          className={`shrink-0 text-xs tabular-nums ${applied ? 'text-current' : 'text-text-muted'}`}
        >
          {/* A price never disappears because a row is being previewed: "absence of a price means you
              own it" only holds if the price stays put while the user looks at the sky it buys. */}
          {cost.kind === 'price' ? m.store_price_amount({ amount: cost.amount }) : null}
          {cost.kind === 'condition' ? m.store_condition_locked() : null}
        </span>
      </button>
    </li>
  )
}
