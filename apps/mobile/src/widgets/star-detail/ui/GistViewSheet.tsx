import { StyleSheet, Text, View } from 'react-native'
import { useEarnRequestStore } from '@cosimosi/twinkle'
import { Button, Dialog, tokens } from '@cosimosi/ui'
import { useGistViewController } from '@cosimosi/universe/react/flows'
import { useInvalidateAchievements } from '@cosimosi/achievement/react'
import { useInvalidateTwinkleBalance } from '@cosimosi/twinkle/react'
import { useErrorToast } from '@cosimosi/errors/react'
import { SpendCostDisplay, gistViewSpend } from '../../../features/spend-cost-display/index.ts'
import { m } from '../../../shared/i18n/index.ts'

// widgets/star-detail ui: the 요지 보기 sheet. The paid read, its operation id, refusal routing and
// the busy/close rules are the package's gist-view controller; this file is the dialog markup.
export function GistViewSheet({
  episodicMemoryId,
  onClose,
}: {
  episodicMemoryId: string
  onClose: () => void
}) {
  const requestEarnGuide = useEarnRequestStore((state) => state.request)
  const { text, busy, failed, proceed, retry, close } = useGistViewController({
    episodicMemoryId,
    onClose,
    onError: useErrorToast(),
    invalidateBalance: useInvalidateTwinkleBalance(),
    invalidateAchievements: useInvalidateAchievements(),
    requestEarnGuide,
  })

  return (
    <Dialog open onClose={close} title={m.gist_view_title()} closeLabel={m.common_dismiss()}>
      <View style={styles.body}>
        {text !== null ? (
          <>
            <Text style={styles.text}>{text}</Text>
            <View style={styles.actions}>
              <Button color="neutral" size="sm" onPress={close}>
                {m.common_dismiss()}
              </Button>
            </View>
          </>
        ) : busy ? (
          <Text style={styles.muted}>{m.gist_view_loading()}</Text>
        ) : failed ? (
          <View style={styles.body}>
            <Text style={styles.muted}>{m.gist_view_error()}</Text>
            <View style={styles.actions}>
              <Button color="neutral" size="sm" onPress={close}>
                {m.twinkle_cost_cancel()}
              </Button>
              {/* Ambiguous → retry replays the same operation id directly; known refusal → re-quote. */}
              <Button color="primary" size="sm" onPress={retry}>
                {m.common_retry()}
              </Button>
            </View>
          </View>
        ) : (
          <SpendCostDisplay
            pending={gistViewSpend(episodicMemoryId)}
            onProceed={proceed}
            onCancel={close}
            onEarn={requestEarnGuide}
          />
        )}
      </View>
    </Dialog>
  )
}

const styles = StyleSheet.create({
  body: { gap: tokens.spacing[4] },
  text: { color: tokens.color.text, fontSize: tokens.fontSize.sm, lineHeight: 22 },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spacing[2] },
})
