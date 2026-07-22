import { Button } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
import type { ProvenanceEntry, ProvenanceKind, ProvenanceSource } from '@cosimosi/memory'

function kindLabel(kind: ProvenanceKind): string {
  if (kind === 'created') return m.star_provenance_kind_created()
  if (kind === 'semanticized') return m.star_provenance_kind_semanticized()
  return m.star_provenance_kind_reconsolidated()
}

function sourceLabel(source: ProvenanceSource): string {
  if (source === 'original') return m.star_provenance_source_original()
  if (source === 'system') return m.star_provenance_source_system()
  return m.star_provenance_source_user()
}

// features/star-provenance ui ([R8a][D1]): the time-ordered stage-text list, each entry labelled
// by kind (생성/요지화/재공고화) and source (원본/시스템/사용자). Distortion is NOT separately
// flagged — the user discovers change by reading the entries. The list renders exactly the ordered
// entries the read returns; ordering and the synthesized baseline are the read's concern.
export function ProvenanceList({
  entries,
  status,
  onRetry,
}: {
  entries: readonly ProvenanceEntry[]
  status: 'loading' | 'retrying' | 'error' | 'success'
  onRetry: () => void
}) {
  if (status === 'loading') {
    return <p className="text-sm text-text-muted">{m.star_provenance_loading()}</p>
  }
  if (status === 'retrying') {
    return <p className="text-sm text-text-muted">{m.star_provenance_retrying()}</p>
  }
  if (status === 'error') {
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className="text-sm text-text-muted">{m.star_provenance_error()}</p>
        <Button color="neutral" size="sm" onClick={onRetry}>
          {m.common_retry()}
        </Button>
      </div>
    )
  }
  if (entries.length === 0) {
    return <p className="text-sm text-text-muted italic">{m.star_provenance_empty()}</p>
  }
  return (
    <ol className="flex flex-col gap-3">
      {entries.map((entry, index) => (
        <li key={`${entry.universeTime}-${index}`} className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>{kindLabel(entry.kind)}</span>
            <span aria-hidden>·</span>
            <span>{sourceLabel(entry.source)}</span>
            <span aria-hidden>·</span>
            <span>{entry.universeTime}</span>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-text">{entry.text}</p>
        </li>
      ))}
    </ol>
  )
}
