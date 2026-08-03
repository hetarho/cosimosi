import { useOrnamentPreviewStore, type Ornament } from '@cosimosi/store'
import { ORNAMENT_GROUP_TITLES } from '@cosimosi/store/i18n'
import { useOrnamentCatalog } from '@cosimosi/store/react'
import { m } from '../../../shared/i18n/index.ts'
import { OrnamentRow } from './OrnamentRow.tsx'

// features/preview-ornament ui: the catalog as labelled groups in ONE scroll — no tabs, no filter,
// no separate owned view ([P6]). Selecting installs a preview; the bridge inside the canvas is what
// turns that into pixels, so this slice never touches the renderer.
//
// `frozen` while a save is in flight: what is being bought must not change under the request, or the
// universe would show one thing and the receipt name another.
export function OrnamentGroupList({ frozen = false }: { readonly frozen?: boolean }) {
  const { groups, loading } = useOrnamentCatalog()
  const previewed = useOrnamentPreviewStore((state) => state.previewed)
  const preview = useOrnamentPreviewStore((state) => state.preview)
  const handlePreview = (ornament: Ornament) => preview(ornament.kind, ornament.id)

  if (loading) return <p className="px-3 py-2 text-sm text-text-muted">{m.common_loading()}</p>
  if (groups.every((group) => group.ornaments.length === 0)) {
    return <p className="px-3 py-2 text-sm text-text-muted">{m.store_catalog_empty()}</p>
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section key={group.kind} aria-label={ORNAMENT_GROUP_TITLES[group.kind]()}>
          {/* The group title is the panel's own structure, so it carries the brightest ink and a
              heavier weight than the rows beneath it — a muted, light label read as one more row. */}
          <h3 className="px-3 pb-1.5 text-xs font-semibold tracking-wide text-text">
            {ORNAMENT_GROUP_TITLES[group.kind]()}
          </h3>
          <ul className="flex flex-col">
            {group.ornaments.map((ornament) => (
              <OrnamentRow
                key={ornament.id}
                ornament={ornament}
                applied={previewed[group.kind] === ornament.id}
                disabled={frozen}
                onPreview={handlePreview}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
