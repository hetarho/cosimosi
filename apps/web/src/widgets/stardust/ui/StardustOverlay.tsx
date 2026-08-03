import { useCallback, useEffect, useRef, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import { useEarnRequestStore } from '@cosimosi/twinkle'
import { useInvalidateAchievements } from '@cosimosi/achievement/react'
import { useInvalidateTwinkleBalance, useTwinkleBalanceQuery } from '@cosimosi/twinkle/react'
import { IconButton, NoticeIcon, Tooltip } from '@cosimosi/ui'

import { EarnGuideSheet, WriteEarnFeedback } from '../../../features/earn-twinkle/index.ts'
import { useLaunchedNeuronsStore } from '../../../features/launch-stars/index.ts'
import { TwinkleBalanceHud } from '../../../features/twinkle-balance-hud/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { useErrorToast } from '../../../shared/model/index.ts'

// widgets/stardust ([G2][G3]): the persistent economy overlay over the running canvas — it composes
// the balance HUD, the earn guide, and the write-earn feedback. It never remounts the renderer and
// imports no three/visual entity (§3.4); the balance and the earn figures live in Query/config (§3.2).
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

  // Write-earn feedback rides the writing flow's existing public launch-completion (the
  // launched-neurons announce, [27]): a star-creating launch earned Twinkle server-side, so
  // refetch the balance and show the restrained reward once. Composed, never rebuilt.
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
    <div className="flex flex-col items-end gap-2">
      {/* A restrained proactive way in ([G3]): a shortfall is not the only reason to wonder how
          별가루 gathers. It rides in the balance reading's own action slot, because what it explains is
          the figures beside it — an icon-only control, so its name lives in `label` and the tooltip is
          mandatory (design-language §8).
          It stays put while the guide is open: an affordance that vanishes as its own surface opens
          takes the anchor out from under the thing that just appeared, and leaves a hole in the
          reading beside it that fills back in on close. */}
      <TwinkleBalanceHud
        action={
          <Tooltip content={m.twinkle_earn_title()} side="bottom" align="end">
            <IconButton
              variant="text"
              color="neutral"
              size="sm"
              className="rounded-full"
              label={m.twinkle_earn_title()}
              icon={<NoticeIcon />}
              onClick={openGuide}
            />
          </Tooltip>
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
    </div>
  )
}
