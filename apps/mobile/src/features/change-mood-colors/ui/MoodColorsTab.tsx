import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { createGetMoodColorsQueryOptions } from '@cosimosi/api-client'
import { MOODS, type Color, type Mood } from '@cosimosi/emotion'
import {
  moodColorPresetsQueryKey,
  moodColorRows,
  useMoodColorEditor,
} from '@cosimosi/emotion/react'
import { Card, tokens } from '@cosimosi/ui'

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
  // What all thirteen wear right now, live: the dialog needs the other twelve to warn about a colour
  // that would be hard to tell apart from one of them, and this card is the only place that knows.
  const { colorFor } = editor
  const palette = useMemo(
    () => Object.fromEntries(MOODS.map((mood) => [mood, colorFor(mood)])) as Record<Mood, Color>,
    [colorFor],
  )

  // A failed write leaves the dialog open: the failure notice is on this card and the save is what
  // the person needs to reach next. A landed one contributed to the aggregate the presets are drawn
  // from, so the cached ranking and shares are dropped before the dialog can be opened again.
  const save = async (mood: Mood, color: Color) => {
    if (!(await editor.choose(mood, color))) return
    setEditing(undefined)
    await queryClient.invalidateQueries({ queryKey: moodColorPresetsQueryKey(mood) })
  }

  return (
    <Card style={styles.card}>
      <View>
        <Text style={styles.title}>{m.palette_editor_title()}</Text>
        <Text style={styles.body}>{m.palette_editor_body()}</Text>
      </View>
      {query.isPending ? <Text style={styles.body}>{m.common_loading()}</Text> : null}
      <View style={styles.grid}>
        {MOODS.map((mood) => (
          <Pressable
            key={mood}
            accessibilityRole="button"
            accessibilityLabel={m.palette_swatch_label({ mood: moodLabel(mood) })}
            disabled={query.isPending || editor.savingMood !== undefined}
            onPress={() => setEditing(mood)}
            style={({ pressed }) => [styles.cell, pressed && styles.dimmed]}
          >
            <View style={[styles.swatch, { backgroundColor: editor.colorFor(mood) }]} />
            <Text numberOfLines={1} style={styles.name}>
              {moodLabel(mood)}
            </Text>
          </Pressable>
        ))}
      </View>
      {editor.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {m.palette_save_failed()}
        </Text>
      ) : null}
      {editing ? (
        // Keyed by feeling: the dialog seeds its draft from `current` once, so a different feeling
        // has to be a different instance rather than the same one handed new props.
        //
        // The whole palette is handed down, so "too close to another feeling" is raised WHILE choosing
        // instead of as a line on this card after the save landed. This card therefore carries no
        // near-duplicate notice of its own.
        <MoodColorDialog
          key={editing}
          mood={editing}
          current={editor.colorFor(editing)}
          otherColors={palette}
          saving={editor.savingMood !== undefined}
          onClose={() => setEditing(undefined)}
          onSave={(color) => {
            // `save` awaits an editor call that resolves either way — the failure lands on this
            // card as a notice, so there is nothing here for a rejection handler to do.
            save(editing, color)
          }}
        />
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: tokens.spacing[4] },
  title: { color: tokens.color.text, fontSize: tokens.fontSize.base, fontWeight: '600' },
  body: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    alignItems: 'center',
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dimmed: { opacity: 0.6 },
  swatch: {
    borderColor: tokens.color.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    width: 20,
  },
  name: { color: tokens.color.text, flexShrink: 1, fontSize: tokens.fontSize.sm },
  error: { color: tokens.color.danger, fontSize: tokens.fontSize.sm },
})
