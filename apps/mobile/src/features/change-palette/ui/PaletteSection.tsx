import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { listPalettes } from '@cosimosi/emotion'
import {
  paletteDisplayName,
  useChangePalette,
  usePalettePreferenceStore,
} from '@cosimosi/emotion/react'
import { Badge, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// The palette picker ([P1], RN mirror of the web ui over the same model/api): it renders the
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
    <View style={styles.list}>
      {listPalettes().map(({ id, name }) => {
        const current = id === currentId
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected: current, disabled: saving }}
            disabled={saving}
            onPress={() => select(id)}
            style={({ pressed }) => [styles.row, (pressed || saving) && styles.rowDimmed]}
          >
            <Text style={styles.name}>{paletteDisplayName(id, name)}</Text>
            {current ? <Badge>{m.settings_palette_selected()}</Badge> : null}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: {
    alignItems: 'center',
    borderColor: tokens.color.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowDimmed: { opacity: 0.6 },
  name: { color: tokens.color.text, fontSize: 14 },
})
