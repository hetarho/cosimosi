import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Button, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// The honest-mirror notice ([M5], PRD §1.4) — the RN fork of the web disclosure (§3.5, primitive
// differs: RN View/Text vs DOM). A tap reveals that the universe's color is the emotions you
// re-read, not your emotional average, so the field never reads as a lie. Renders no color and
// reads no domain data; copy is i18n message content (`m.*`), never a hardcoded string ([A9]).
export function NebulaNotice() {
  const [open, setOpen] = useState(false)
  return (
    <View style={styles.root}>
      {open ? <Text style={styles.body}>{m.universe_nebula_notice_body()}</Text> : null}
      <Button color="neutral" onPress={() => setOpen((value) => !value)}>
        {m.universe_nebula_notice_title()}
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { maxWidth: 280, gap: 8, alignItems: 'flex-start' },
  body: {
    color: tokens.color.text,
    backgroundColor: tokens.color['surface-raised'],
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    lineHeight: 20,
  },
})
