import { useCallback, useEffect, useRef, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import { useEarnRequestStore } from '@cosimosi/twinkle'
import { useInvalidateTwinkleBalance, useTwinkleBalanceQuery } from '@cosimosi/twinkle/react'
import { Button } from '@cosimosi/ui'

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
    setEarnShown(true)
  }, [launchedNeuronIds, invalidateBalance])

  const openGuide = useCallback(() => setGuideOpen(true), [])
  const closeGuide = useCallback(() => setGuideOpen(false), [])

  return (
    <div className="flex flex-col items-end gap-2">
      <TwinkleBalanceHud />
      {/* A restrained proactive way in ([G3]): a shortfall is not the only reason to wonder how
          별가루 gathers. Shown only while the guide is closed. */}
      {guideOpen ? null : (
        <Button color="neutral" size="sm" className="pointer-events-auto" onClick={openGuide}>
          {m.twinkle_earn_title()}
        </Button>
      )}
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
