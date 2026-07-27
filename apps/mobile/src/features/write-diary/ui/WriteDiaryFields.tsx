import { StyleSheet, View } from 'react-native'

import { TextArea, TextField, tokens } from '@cosimosi/ui'
import { useDiaryDraftStore } from '@cosimosi/universe'

import { m } from '../../../shared/i18n/index.ts'

// features/write-diary ui — RN fork of the web fields (§3.5, DOM ↔ RN primitives). The date is a
// plain text field on mobile MVP (no native date-picker dependency yet); the model/logic is shared
// verbatim with web ([W5]).
export function WriteDiaryFields() {
  const body = useDiaryDraftStore((state) => state.body)
  const diaryDate = useDiaryDraftStore((state) => state.diaryDate)
  const setBody = useDiaryDraftStore((state) => state.setBody)
  const setDiaryDate = useDiaryDraftStore((state) => state.setDiaryDate)
  return (
    <View style={styles.fields}>
      <TextArea
        label={m.writing_flow_body_label()}
        placeholder={m.writing_flow_body_placeholder()}
        value={body}
        onChangeText={setBody}
      />
      <TextField
        label={m.writing_flow_date_label()}
        value={diaryDate}
        onChangeText={setDiaryDate}
        autoCapitalize="none"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  // One field group, the inside-a-panel step (§4) — read from the token scale, not a loose 16.
  fields: { gap: tokens.spacing[4] },
})
