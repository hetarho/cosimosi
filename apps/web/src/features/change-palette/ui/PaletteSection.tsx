import { useState } from 'react'

import { listPalettes } from '@cosimosi/emotion'
import { Badge } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'
import { useChangePalette } from '../api/change-palette.ts'
import { usePalettePreferenceStore } from '../model/palette-preference-store.ts'
import { paletteDisplayName } from '../lib/palette-display-name.ts'

// The palette picker ([P1]): the settings page hosts it, this slice owns it. It renders the
// registry and nothing else — only guardrail-respecting palettes exist there ([P3] is enforced at
// the registry, no free editor here), marks the stored preference, and routes a selection through
// the slice's set-and-apply (optimistic re-color + persist + revert-on-failure) — never a direct
// setMoodPalette. Save-in-flight is a trivial local flag (§3.2); the chosen id lives in the
// preference store, not here. The swap changes the emotion→color mapping only ([I11]).
export function PaletteSection() {
  const currentId = usePalettePreferenceStore((state) => state.paletteId)
  const changePalette = useChangePalette()
  const [saving, setSaving] = useState(false)

  const select = (id: string) => {
    if (saving || id === currentId) return
    setSaving(true)
    // A rejected persist has already reverted the color and the store (the slice's api); the
    // picker's selection mark simply follows the store back.
    changePalette(id)
      .catch(() => undefined)
      .finally(() => setSaving(false))
  }

  return (
    <ul className="flex flex-col gap-2">
      {listPalettes().map(({ id, name }) => {
        const current = id === currentId
        return (
          <li key={id}>
            <button
              type="button"
              aria-pressed={current}
              disabled={saving}
              onClick={() => select(id)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-left text-sm text-text transition-colors hover:bg-surface disabled:opacity-60"
            >
              <span>{paletteDisplayName(id, name)}</span>
              {current ? <Badge>{m.settings_palette_selected()}</Badge> : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
