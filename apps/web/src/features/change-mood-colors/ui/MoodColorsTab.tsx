import { useMemo, useState } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { createGetMoodColorsQueryOptions } from '@cosimosi/api-client'
import { MOODS, type Color, type Mood } from '@cosimosi/emotion'
import {
  moodColorPresetsQueryKey,
  moodColorRows,
  useMoodColorEditor,
} from '@cosimosi/emotion/react'
import { Alert, Card } from '@cosimosi/ui'

import { m, moodLabel } from '../../../shared/i18n/index.ts'
import { MoodColorDialog } from './MoodColorDialog.tsx'

/** The thirteen colours as they stand. Choosing happens in the dialog, one feeling at a time. */
export function MoodColorsTab() {
  const transport = useTransport()
  const queryClient = useQueryClient()
  const query = useQuery({ ...createGetMoodColorsQueryOptions(transport), retry: false })
  const rows = useMemo(() => moodColorRows(query.data?.colors ?? []), [query.data?.colors])
  const editor = useMoodColorEditor(rows)
  const [editing, setEditing] = useState<Mood>()

  // A failed write leaves the dialog open: the failure notice is on this card and the save is what
  // the person needs to reach next. A landed one contributed to the aggregate the presets are drawn
  // from, so the cached ranking and shares are dropped before the dialog can be opened again.
  const save = async (mood: Mood, color: Color) => {
    if (!(await editor.choose(mood, color))) return
    setEditing(undefined)
    await queryClient.invalidateQueries({ queryKey: moodColorPresetsQueryKey(mood) })
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-medium text-text">{m.palette_editor_title()}</h2>
        <p className="mt-1 text-sm text-text-muted">{m.palette_editor_body()}</p>
      </div>
      {query.isPending ? <p className="text-sm text-text-muted">{m.common_loading()}</p> : null}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {MOODS.map((mood) => (
          <li key={mood}>
            <button
              type="button"
              aria-label={m.palette_swatch_label({ mood: moodLabel(mood) })}
              disabled={query.isPending || editor.savingMood !== undefined}
              onClick={() => setEditing(mood)}
              className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left text-sm text-text hover:border-text disabled:opacity-60"
            >
              <span
                aria-hidden="true"
                className="size-5 shrink-0 rounded-full border border-border"
                style={{ backgroundColor: editor.colorFor(mood) }}
              />
              <span className="truncate">{moodLabel(mood)}</span>
            </button>
          </li>
        ))}
      </ul>
      {editor.duplicateMood ? (
        <Alert variant="warning" live="status">
          {m.palette_near_duplicate({ mood: moodLabel(editor.duplicateMood) })}
        </Alert>
      ) : null}
      {editor.error ? <Alert variant="danger">{m.palette_save_failed()}</Alert> : null}
      {editing ? (
        // Keyed by feeling: the dialog seeds its draft from `current` once, so a different feeling
        // has to be a different instance rather than the same one handed new props.
        <MoodColorDialog
          key={editing}
          mood={editing}
          current={editor.colorFor(editing)}
          saving={editor.savingMood !== undefined}
          onClose={() => setEditing(undefined)}
          onSave={(color) => void save(editing, color)}
        />
      ) : null}
    </Card>
  )
}
