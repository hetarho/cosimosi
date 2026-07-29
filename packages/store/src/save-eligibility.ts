import type { Ornament, OrnamentKind } from './ornament.ts'
import type { OrnamentIDsByKind } from './ornament-preview-store.ts'

// What the save button may say, and whether it may be pressed. The authoritative total is derived
// inside Decorate from the rows it actually acquires, so the number here is advisory by design: a wrong
// one changes what the button READS, never what the user is charged.
//
// It does gate the press, which is why an UNREAD balance must never read as a shortfall: the point of
// the client's arithmetic is to save the user a refusal they can predict, not to refuse on their behalf
// when it knows nothing. When in doubt, let the server answer.

/**
 * What a row costs this user, as a discriminant rather than a boolean. There is deliberately no
 * `owned` field for the UI to render: ownership shows up as the ABSENCE of a price ([P7]), so a
 * badge, a filter or a locker has no value to key off.
 */
export type OrnamentCost =
  | { readonly kind: 'none' }
  | { readonly kind: 'price'; readonly amount: number }
  | { readonly kind: 'condition'; readonly achievementId: string | null }

export function ornamentCost(ornament: Ornament): OrnamentCost {
  if (ornament.owned) return { kind: 'none' }
  // An unachieved reward shows what to do, not what to pay. An unmatched achievement id degrades to
  // "no price" rather than inventing one — it still cannot be saved, because the server refuses it.
  if (ornament.acquisition === 'ACHIEVEMENT') return { kind: 'condition', achievementId: null }
  return { kind: 'price', amount: ornament.price }
}

/** The sum the save button shows: what the previewed rows would cost, counting only unowned ones. */
export function unownedTotal(catalog: readonly Ornament[], previewed: OrnamentIDsByKind): number {
  const previewedIds = new Set(Object.values(previewed))
  return catalog.reduce((total, ornament) => {
    if (!previewedIds.has(ornament.id)) return total
    const cost = ornamentCost(ornament)
    return cost.kind === 'price' ? total + cost.amount : total
  }, 0)
}

export type SaveVerdict =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'free' }
  | { readonly kind: 'ready'; readonly amount: number }
  | { readonly kind: 'shortfall'; readonly amount: number; readonly ornamentId: string }
  | { readonly kind: 'locked'; readonly ornamentId: string }

export interface SaveInput {
  readonly catalog: readonly Ornament[]
  readonly previewed: OrnamentIDsByKind
  readonly confirmed: OrnamentIDsByKind
  /** The GENERAL balance alone — SMALL may never fund an ornament, so it is not an input ([P9]). */
  readonly generalBalance: number
  /**
   * Whether that balance is a real figure yet. An unread balance is zero, and zero is indistinguishable
   * from broke — so before the read lands the verdict must NOT claim a shortfall, or a save the server
   * would have accepted is blocked by the client's own ignorance.
   */
  readonly balanceLoaded: boolean
}

/**
 * Whether this preview can be saved, and what to say about it. Five arms, checked in the order the
 * user would care about: nothing to do, something unbuyable, not enough, free, or ready.
 */
export function saveVerdict({
  catalog,
  previewed,
  confirmed,
  generalBalance,
  balanceLoaded,
}: SaveInput): SaveVerdict {
  if (!changed(previewed, confirmed)) return { kind: 'unchanged' }

  const byId = new Map(catalog.map((ornament) => [ornament.id, ornament]))
  const previewedRows = Object.values(previewed).flatMap((id) => {
    const ornament = byId.get(id)
    return ornament ? [ornament] : []
  })

  const locked = previewedRows.find((ornament) => ornamentCost(ornament).kind === 'condition')
  if (locked) return { kind: 'locked', ornamentId: locked.id }

  const priced = previewedRows.filter((ornament) => ornamentCost(ornament).kind === 'price')
  const total = priced.reduce((sum, ornament) => sum + ornament.price, 0)
  if (total === 0) return { kind: 'free' }
  if (balanceLoaded && total > generalBalance) {
    // Name the item the balance runs out on, filling cheapest-first — the same rule the server uses
    // for its own refusal, so the two never point at different rows.
    return {
      kind: 'shortfall',
      amount: total - generalBalance,
      ornamentId: shortItem(priced, generalBalance),
    }
  }
  return { kind: 'ready', amount: total }
}

function changed(previewed: OrnamentIDsByKind, confirmed: OrnamentIDsByKind): boolean {
  return (Object.keys(previewed) as OrnamentKind[]).some(
    (kind) => previewed[kind] !== confirmed[kind],
  )
}

function shortItem(priced: readonly Ornament[], covered: number): string {
  const ordered = [...priced].sort(
    (left, right) => left.price - right.price || left.id.localeCompare(right.id),
  )
  let remaining = covered
  for (const ornament of ordered) {
    if (ornament.price > remaining) return ornament.id
    remaining -= ornament.price
  }
  return ordered[ordered.length - 1]?.id ?? ''
}
