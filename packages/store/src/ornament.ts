import {
  OrnamentAcquisition as WireAcquisition,
  OrnamentKind as WireKind,
  type Ornament as WireOrnament,
  type OrnamentSelection as WireSelection,
} from '@cosimosi/api-client'

// The frontend's ornament vocabulary: the five decoration kinds, the catalog row as the UI reads it,
// and the id↔registry-key translation the renderer needs. Shared by both apps rather than copied
// into each, because a per-app copy of this mapping would let one app drift from the other's idea of
// which sky a selection means.
//
// An ornament id is `<lower(kind)>.<registry key>` and stays OPAQUE to the server: everything about
// what it looks like belongs to the renderer's registries. This module holds the split, never the
// looks — no color, size, brightness or seed passes through here ([V10][I11]).

export type OrnamentKind = 'BACKGROUND' | 'STAR_SHADER' | 'GIST_SHADER' | 'MOTE' | 'MOTE_FIELD'

/** How a row is come by. FREE is owned by everyone; ACHIEVEMENT is unbuyable at any price. */
export type OrnamentAcquisition = 'FREE' | 'PURCHASE' | 'ACHIEVEMENT'

/** One catalog row as the panel reads it: what it is, what it costs, and what is true of it for
 *  this user. Every row arrives — owned and unowned alike ([P6][P7]). */
export interface Ornament {
  readonly id: string
  readonly kind: OrnamentKind
  readonly acquisition: OrnamentAcquisition
  /** Server-resolved; 0 for every free and achievement row. The client never holds a price table. */
  readonly price: number
  readonly owned: boolean
  readonly selected: boolean
}

/** What the universe wears for one kind. The server always answers one entry per kind. */
export interface OrnamentSelection {
  readonly kind: OrnamentKind
  readonly ornamentId: string
}

/** The kinds in the order every surface lists them — the server's read order, so the panel's groups
 *  and the catalog's rows cannot disagree about which comes first. */
export const ORNAMENT_KINDS: readonly OrnamentKind[] = [
  'BACKGROUND',
  'STAR_SHADER',
  'GIST_SHADER',
  'MOTE',
  'MOTE_FIELD',
]

/** Each kind's free default, mirroring the owning registry's own default — DEFAULT_SKY_EFFECT,
 *  DEFAULT_STAR_SHAPE, DEFAULT_GIST_SHAPE, DEFAULT_BACKDROP_MOTE and DEFAULT_BACKDROP_FIELD.
 *  Absence of a selection IS the default, so these are what a boot renders before the read lands,
 *  and what the server coerces an unknown stored id to. */
export const DEFAULT_ORNAMENT_IDS: Readonly<Record<OrnamentKind, string>> = {
  BACKGROUND: 'background.grainient',
  STAR_SHADER: 'star_shader.facet',
  GIST_SHADER: 'gist_shader.halo',
  MOTE: 'mote.pinprick',
  MOTE_FIELD: 'mote_field.even',
}

export function ornamentKindPrefix(kind: OrnamentKind): string {
  return `${kind.toLowerCase()}.`
}

/** The registry key an id names, or null when the id does not belong to that kind. Split on the
 *  FIRST '.' only: a registry key may contain dots, the prefix may not. */
export function ornamentRegistryKey(kind: OrnamentKind, ornamentId: string): string | null {
  const prefix = ornamentKindPrefix(kind)
  if (!ornamentId.startsWith(prefix) || ornamentId.length === prefix.length) return null
  return ornamentId.slice(prefix.length)
}

export function ornamentIdOf(kind: OrnamentKind, registryKey: string): string {
  return `${ornamentKindPrefix(kind)}${registryKey}`
}

/** The registry key one kind currently wears — the selection's, or the kind's default when the read
 *  has not landed or carries no entry for it. Never null, so a renderer seam always has a key. */
export function selectedRegistryKey(
  selections: readonly OrnamentSelection[],
  kind: OrnamentKind,
): string {
  const applied = selections.find((selection) => selection.kind === kind)?.ornamentId
  const fallback = ornamentRegistryKey(kind, DEFAULT_ORNAMENT_IDS[kind]) ?? ''
  if (!applied) return fallback
  return ornamentRegistryKey(kind, applied) ?? fallback
}

export function ornamentRows(rows: readonly WireOrnament[]): readonly Ornament[] {
  return rows.flatMap((row) => {
    const kind = toOrnamentKind(row.kind)
    const acquisition = toOrnamentAcquisition(row.acquisition)
    if (!kind || !acquisition) return []
    return [
      {
        id: row.ornamentId,
        kind,
        acquisition,
        price: Number(row.price),
        owned: row.owned,
        selected: row.selected,
      },
    ]
  })
}

export function ornamentSelectionRows(
  rows: readonly WireSelection[],
): readonly OrnamentSelection[] {
  return rows.flatMap((row) => {
    const kind = toOrnamentKind(row.kind)
    return kind ? [{ kind, ornamentId: row.ornamentId }] : []
  })
}

// An unspecified or future wire value is DROPPED rather than guessed at: a client that cannot name a
// kind cannot render it either, and inventing one would put a made-up id in front of the user.
function toOrnamentKind(kind: WireKind): OrnamentKind | null {
  switch (kind) {
    case WireKind.BACKGROUND:
      return 'BACKGROUND'
    case WireKind.STAR_SHADER:
      return 'STAR_SHADER'
    case WireKind.GIST_SHADER:
      return 'GIST_SHADER'
    case WireKind.MOTE:
      return 'MOTE'
    case WireKind.MOTE_FIELD:
      return 'MOTE_FIELD'
    default:
      return null
  }
}

function toOrnamentAcquisition(acquisition: WireAcquisition): OrnamentAcquisition | null {
  switch (acquisition) {
    case WireAcquisition.FREE:
      return 'FREE'
    case WireAcquisition.PURCHASE:
      return 'PURCHASE'
    case WireAcquisition.ACHIEVEMENT:
      return 'ACHIEVEMENT'
    default:
      return null
  }
}
