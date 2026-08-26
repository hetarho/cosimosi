import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { VALUES } from '@cosimosi/config'
import { useEarnRequestStore } from '@cosimosi/twinkle'
import { useInvalidateAchievements } from '@cosimosi/achievement/react'
import { useInvalidateTwinkleBalance, useTwinkleBalanceQuery } from '@cosimosi/twinkle/react'
import { IconButton, NoticeIcon, tokens } from '@cosimosi/ui'

import { useErrorToast } from '@cosimosi/errors/react'
import { EarnGuideSheet, WriteEarnFeedback } from '../../../features/earn-twinkle/index.ts'
import { useLaunchedNeuronsStore } from '../../../features/launch-stars/index.ts'
import { TwinkleBalanceHud } from '../../../features/twinkle-balance-hud/index.ts'
import { m } from '../../../shared/i18n/index.ts'
// widgets/stardust (RN fork, [G2][G3]): the persistent economy overlay over the running canvas — it
// composes the balance HUD, the earn guide, and the write-earn feedback. It never remounts the
// renderer and imports no three/visual entity (§3.4); the figures live in Query/config (§3.2). Shares
// every model/api module with web verbatim; only this shell forks for RN primitives.
//
// The guide's open/closed state is LOCAL, not a machine: §3.2 reserves XState for genuinely exclusive
// phases, and the guide issues no request — there is no in-flight state to be exclusive about, so a
// boolean is the honest model.
export function StardustOverlay({ onOpenAchievements }: { onOpenAchievements?: () => void }) {
  const showError = useErrorToast()
  // Owns the single GetBalance fetch → populates the shared balance mirror the HUD reads.
  const balanceQuery = useTwinkleBalanceQuery()
  const invalidateBalance = useInvalidateTwinkleBalance()
  // Every action that can record progress refreshes the achievement read on resolution, which is
  // also what feeds the unlock notice's diff — there is no push and no polling anywhere.
  const invalidateAchievements = useInvalidateAchievements()

  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    if (balanceQuery.error) showError(balanceQuery.error)
  }, [balanceQuery.error, showError])

  // A shortfall in a cost display (recall / gist-view) requests the guide through the decoupled seam,
  // so the spend flows and this widget never import each other (§3.1).
  const earnRequested = useEarnRequestStore((state) => state.requested)
  const clearEarnRequest = useEarnRequestStore((state) => state.clear)
  useEffect(() => {
    if (!earnRequested) return
    setGuideOpen(true)
    clearEarnRequest()
  }, [earnRequested, clearEarnRequest])

  // Write-earn feedback rides the writing flow's existing public launch-completion: a star-creating
  // launch earned Twinkle server-side, so refetch the balance and show the restrained reward once.
  const launchedNeuronIds = useLaunchedNeuronsStore((state) => state.newNeuronIds)
  const seenLaunchRef = useRef(launchedNeuronIds)
  const [earnShown, setEarnShown] = useState(false)
  useEffect(() => {
    if (launchedNeuronIds === seenLaunchRef.current) return
    seenLaunchRef.current = launchedNeuronIds
    if (launchedNeuronIds.length === 0) return
    invalidateBalance()
    invalidateAchievements()
    setEarnShown(true)
  }, [launchedNeuronIds, invalidateBalance, invalidateAchievements])

  const openGuide = useCallback(() => setGuideOpen(true), [])
  const closeGuide = useCallback(() => setGuideOpen(false), [])

  return (
    <View style={styles.root}>
      {/* A restrained proactive way in ([G3]): a shortfall is not the only reason to wonder how
          별가루 gathers. It rides in the balance reading's own action slot, because what it explains is
          the figures beside it — an icon-only control, so its name lives in `label` (there is no hover
          on touch; the accessible name is the whole affordance).
          It stays put while the guide is open: an affordance that vanishes as its own surface opens
          takes the anchor out from under the thing that just appeared, and leaves a hole in the
          reading beside it that fills back in on close. */}
      <TwinkleBalanceHud
        action={
          <IconButton
            variant="text"
            color="neutral"
            size="sm"
            label={m.twinkle_earn_title()}
            icon={<NoticeIcon />}
            onPress={openGuide}
          />
        }
      />
      {earnShown ? (
        <WriteEarnFeedback
          amount={VALUES.twinkle.earnWrite}
          onDismiss={() => setEarnShown(false)}
        />
      ) : null}
      <EarnGuideSheet
        open={guideOpen}
        onOpenAchievements={() => {
          closeGuide()
          onOpenAchievements?.()
        }}
        onClose={closeGuide}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { alignItems: 'flex-end', gap: tokens.spacing[2] },
})
