// FE domain mirror of a 변천사 (provenance) entry ([R8a][D1]) — one representation event in a
// memory's history, mirroring the backend memory_provenance shape. A read model only: the panel
// renders the ordered list a read returns and never writes it ([I2]).
export type ProvenanceKind = 'created' | 'semanticized' | 'reconsolidated'
export type ProvenanceSource = 'original' | 'system' | 'user'

export interface ProvenanceEntry {
  readonly kind: ProvenanceKind
  readonly source: ProvenanceSource
  readonly text: string
  /** ISO DATE in universe time — the entries arrive time-ordered from the read. */
  readonly universeTime: string
}
