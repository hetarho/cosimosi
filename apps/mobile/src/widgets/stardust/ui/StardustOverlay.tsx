import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'

import { useTransport } from '@connectrpc/connect-query'

import { VALUES } from '@cosimosi/config'
import { useChargeRequestStore } from '@cosimosi/twinkle'
import { useInvalidateTwinkleBalance, useTwinkleBalanceQuery } from '@cosimosi/twinkle/react'
import { Button, tokens } from '@cosimosi/ui'
import { stardustMachine, type StardustPhase } from '@cosimosi/universe'
import {
  CHARGE_PACK,
  ChargeSheet,
  WriteEarnFeedback,
  chargeTwinkle,
  claimInvite,
  startStorePurchase,
} from '../../../features/charge-twinkle/index.ts'
import { useLaunchedNeuronsStore } from '../../../features/launch-stars/index.ts'
import { TwinkleBalanceHud } from '../../../features/twinkle-balance-hud/index.ts'
import { m } from '../../../shared/i18n/index.ts'
import { useMachine } from '../../../shared/model/index.ts'

// The store round trip reports the platform so a receipt is scoped to it.
const PLATFORM = Platform.OS

// widgets/stardust (RN fork, [G2][G3], A10/A13): the persistent economy overlay over the
// running canvas — it composes the balance HUD, the charge sheet, and the write-earn
// feedback, and owns the charge-sheet machine + the earn orchestration. It never remounts
// the renderer and imports no three/visual entity (§3.4); the figures live in Query/config,
// only the phase in the machine (§3.2). Shares model/api + the machine with web verbatim; a
// shortfall reaches this sheet through the decoupled charge-request store.
export function StardustOverlay() {
  const transport = useTransport()
  // Owns the single GetBalance fetch → populates the shared balance mirror the HUD reads.
  useTwinkleBalanceQuery()
  const invalidateBalance = useInvalidateTwinkleBalance()

  const [snapshot, send] = useMachine(stardustMachine)
  const phase = snapshot.value as StardustPhase
  const [errored, setErrored] = useState(false)

  const chargeRequested = useChargeRequestStore((state) => state.requested)
  const clearChargeRequest = useChargeRequestStore((state) => state.clear)
  useEffect(() => {
    if (!chargeRequested) return
    setErrored(false)
    send({ type: 'OPEN_CHARGE' })
    clearChargeRequest()
  }, [chargeRequested, send, clearChargeRequest])

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

  const onPay = useCallback(() => {
    setErrored(false)
    send({ type: 'PAY' })
    startStorePurchase(CHARGE_PACK.id, PLATFORM)
      .then((receipt) =>
        chargeTwinkle(transport, { packId: CHARGE_PACK.id, platform: PLATFORM, receipt }),
      )
      .then(() => {
        invalidateBalance()
        send({ type: 'DONE' })
      })
      .catch(() => {
        setErrored(true)
        send({ type: 'ERROR' })
      })
  }, [transport, invalidateBalance, send])

  const onInvite = useCallback(
    (inviteCode: string) => {
      setErrored(false)
      send({ type: 'INVITE' })
      claimInvite(transport, inviteCode)
        .then(() => {
          invalidateBalance()
          send({ type: 'DONE' })
        })
        .catch(() => {
          setErrored(true)
          send({ type: 'ERROR' })
        })
    },
    [transport, invalidateBalance, send],
  )

  const onClose = useCallback(() => send({ type: 'CLOSE' }), [send])

  // A restrained proactive entry to the earn paths ([G3]): a shortfall is not the only way
  // in, so invite + payment stay reachable when the balance is ample. Shown only while the
  // sheet is closed (a shortfall opens it via the charge-request store above).
  const openCharge = useCallback(() => {
    setErrored(false)
    send({ type: 'OPEN_CHARGE' })
  }, [send])

  return (
    <View style={styles.root}>
      <TwinkleBalanceHud />
      {phase === 'idle' ? (
        <Button color="neutral" size="sm" onPress={openCharge}>
          {m.twinkle_charge_title()}
        </Button>
      ) : null}
      {earnShown ? (
        <WriteEarnFeedback
          amount={VALUES.twinkle.earnWrite}
          onDismiss={() => setEarnShown(false)}
        />
      ) : null}
      <ChargeSheet
        open={phase !== 'idle'}
        paying={phase === 'paying'}
        inviting={phase === 'inviting'}
        errored={errored}
        onPay={onPay}
        onInvite={onInvite}
        onClose={onClose}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { alignItems: 'flex-end', gap: tokens.spacing[2] },
})
