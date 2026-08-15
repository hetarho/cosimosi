import { StyleSheet, Text, View } from 'react-native'

import { m } from '../../../shared/i18n/index.ts'
import { requestOnboardingReplay } from '@cosimosi/onboarding'
import { Button, Card, tokens } from '@cosimosi/ui'

// features/replay-onboarding ui (RN fork) ([O5]): the /me profile tab's last row.
//
// There is no teardown to do and nothing to reset — a replay is a `START` with a fresh run id, so the
// row places the request, hands control to the page's own exit callback, and the universe screen reads
// it when focus returns. It is also the reason a skip needs no confirmation: a mis-skip costs one tap
// to undo, forever.
export function ReplayOnboarding({ onExit }: { onExit: () => void }) {
  return (
    <Card style={styles.card}>
      <Text style={styles.muted}>{m.sequence_tour_replay_description()}</Text>
      <View style={styles.action}>
        <Button
          color="neutral"
          size="sm"
          onPress={() => {
            requestOnboardingReplay()
            onExit()
          }}
        >
          {m.sequence_tour_replay_action()}
        </Button>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: tokens.spacing[3] },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  action: { alignItems: 'flex-end' },
})
