import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { useOrnamentPreviewStore, type Ornament } from '@cosimosi/store'
import { ORNAMENT_GROUP_TITLES } from '@cosimosi/store/i18n'
import { useOrnamentCatalog } from '@cosimosi/store/react'
import { m } from '@cosimosi/i18n'
import { tokens } from '@cosimosi/ui'

import { OrnamentRow } from './OrnamentRow.tsx'

// features/preview-ornament ui (native fork): the catalog as labelled groups in ONE scroll — no tabs,
// no ownership filter, no separate owned view ([P6]). `frozen` while a save is in flight: what is being
// bought must not change under the request.
export function OrnamentGroupList({ frozen = false }: { readonly frozen?: boolean }) {
  const { groups, loading } = useOrnamentCatalog()
  const previewed = useOrnamentPreviewStore((state) => state.previewed)
  const preview = useOrnamentPreviewStore((state) => state.preview)
  const handlePreview = (ornament: Ornament) => preview(ornament.kind, ornament.id)

  if (loading) return <Text style={styles.notice}>{m.common_loading()}</Text>
  if (groups.every((group) => group.ornaments.length === 0)) {
    return <Text style={styles.notice}>{m.store_catalog_empty()}</Text>
  }

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {groups.map((group) => (
        <View key={group.kind}>
          <Text style={styles.groupTitle}>{ORNAMENT_GROUP_TITLES[group.kind]()}</Text>
          {group.ornaments.map((ornament) => (
            <OrnamentRow
              key={ornament.id}
              ornament={ornament}
              applied={previewed[group.kind] === ornament.id}
              disabled={frozen}
              onPreview={handlePreview}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  body: { gap: tokens.spacing[5] },
  notice: {
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
    color: tokens.color['text-muted'],
    fontSize: tokens.fontSize.sm,
  },
  groupTitle: {
    paddingHorizontal: tokens.spacing[3],
    paddingBottom: tokens.spacing[1],
    color: tokens.color['text-muted'],
    fontSize: tokens.fontSize.xs,
    fontWeight: '500',
  },
})
