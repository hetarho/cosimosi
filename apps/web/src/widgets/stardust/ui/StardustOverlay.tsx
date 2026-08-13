import { useCallback, useEffect, useRef, useState } from 'react'

import { VALUES } from '@cosimosi/config'
import { useEarnRequestStore } from '@cosimosi/twinkle'
import { useInvalidateAchievements } from '@cosimosi/achievement/react'
import { useInvalidateTwinkleBalance, useTwinkleBalanceQuery } from '@cosimosi/twinkle/react'
import { WriteEarnFeedback } from '../../../features/earn-twinkle/index.ts'
import { useLaunchedNeuronsStore } from '../../../features/launch-stars/index.ts'
import { TwinkleBalanceHud } from '../../../features/twinkle-balance-hud/index.ts'
import { useErrorToast } from '../../../shared/model/index.ts'
import { TwinkleDetailSheet } from './TwinkleDetailSheet.tsx'

// widgets/stardust ([G2][G3]): the persistent economy overlay over the running canvas — it composes
// the balance HUD, the 별가루 panel that reading opens, and the write-earn feedback. It never remounts
// the renderer and imports no three/visual entity (§3.4); the balance and the earn figures live in
// Query/config (§3.2).
//
// The panel's open/closed state is LOCAL, not a machine: §3.2 reserves XState for genuinely exclusive
// phases, and the panel issues no request — there is no in-flight state to be exclusive about, so a
// boolean is the honest model.
export function StardustOverlay({ onOpenAchievements }: { onOpenAchievements?: () => void }) {
  const showError = useErrorToast()
  // Owns the single GetBalance fetch → populates the shared balance mirror the HUD reads.
  const balanceQuery = useTwinkleBalanceQuery()
  const invalidateBalance = useInvalidateTwinkleBalance()
  // Every action that can record progress refreshes the achievement read on resolution, which is
  // also what feeds the unlock notice's diff — there is no push and no polling anywhere.
  const invalidateAchievements = useInvalidateAchievements()

  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    if (balanceQuery.error) showError(balanceQuery.error)
  }, [balanceQuery.error, showError])

  // A shortfall in a cost display (recall / gist-view) requests the panel through the decoupled seam,
  // so the spend flows and this widget never import each other (§3.1).
  const earnRequested = useEarnRequestStore((state) => state.requested)
  const clearEarnRequest = useEarnRequestStore((state) => state.clear)
  useEffect(() => {
    if (!earnRequested) return
    setDetailOpen(true)
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

  const openDetail = useCallback(() => setDetailOpen(true), [])
  const closeDetail = useCallback(() => setDetailOpen(false), [])

  return (
    <div className="flex flex-col items-end gap-2">
      {/* The reading IS the way in ([G3]): pressing the figures opens what they are about. A shortfall
          is not the only reason to wonder how 별가루 gathers, and the mark that used to stand beside
          the numbers asking that question put a second, smaller thing in the corner to aim at — while
          the numbers themselves were what the reader was already looking at. */}
      <TwinkleBalanceHud onOpenDetail={openDetail} />
      {earnShown ? (
        <WriteEarnFeedback
          amount={VALUES.twinkle.earnWrite}
          onDismiss={() => setEarnShown(false)}
        />
      ) : null}
      <TwinkleDetailSheet
        open={detailOpen}
        onOpenAchievements={() => {
          closeDetail()
          onOpenAchievements?.()
        }}
        onClose={closeDetail}
      />
    </div>
  )
}
