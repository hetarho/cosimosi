import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { VALUES } from '@cosimosi/config'
import { Button, Dialog, TextField, tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// features/charge-twinkle ui (RN fork, [G3]): the charge sheet exposing the two interactive
// earn paths — payment (a single pack, its grant figure from generated config; the store
// receipt goes to the verified Charge, credit lands only after the backend confirms) and
// invite (redeem an inviter's code; the both-sides grant figure from config). There is NO
// login-bonus path — the daily basic grant plays that role ([G3], A8). Control-state is the
// stardust machine's; this is presentation, driven by props. Figures come only from
// generated config (CC3), copy is honest and unpressured.
export function ChargeSheet({
  open,
  paying,
  inviting,
  errored,
  onPay,
  onInvite,
  onClose,
}: {
  open: boolean
  paying: boolean
  inviting: boolean
  errored: boolean
  onPay: () => void
  onInvite: (inviteCode: string) => void
  onClose: () => void
}) {
  const [code, setCode] = useState('')
  const busy = paying || inviting

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={m.twinkle_charge_title()}
      closeLabel={m.common_dismiss()}
    >
      <View style={styles.body}>
        {errored ? <Text style={styles.error}>{m.twinkle_charge_error()}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.heading}>{m.twinkle_charge_pay_title()}</Text>
          <Text style={styles.muted}>{m.twinkle_charge_pay_body()}</Text>
          <View style={styles.row}>
            <Text style={styles.figure}>{String(VALUES.twinkle.chargePack)}</Text>
            <Button color="primary" size="sm" loading={paying} disabled={busy} onPress={onPay}>
              {m.twinkle_charge_pay_action()}
            </Button>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>{m.twinkle_charge_invite_title()}</Text>
          <Text style={styles.muted}>{m.twinkle_charge_invite_body()}</Text>
          <View style={styles.row}>
            <Text style={styles.muted}>{m.twinkle_charge_invite_bonus_label()}</Text>
            <Text style={styles.figure}>{String(VALUES.twinkle.earnInviteInvitee)}</Text>
          </View>
          <TextField
            label={m.twinkle_charge_invite_code_label()}
            placeholder={m.twinkle_charge_invite_code_placeholder()}
            value={code}
            onChangeText={setCode}
          />
          <View style={styles.actions}>
            <Button
              color="primary"
              size="sm"
              loading={inviting}
              disabled={busy || code.trim() === ''}
              onPress={() => onInvite(code.trim())}
            >
              {m.twinkle_charge_invite_action()}
            </Button>
          </View>
        </View>
      </View>
    </Dialog>
  )
}

const styles = StyleSheet.create({
  body: { gap: tokens.spacing[6] },
  section: { gap: tokens.spacing[2] },
  heading: { color: tokens.color.text, fontSize: tokens.fontSize.sm, fontWeight: '500' },
  muted: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.sm },
  figure: { color: tokens.color.text, fontSize: tokens.fontSize.base },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  error: { color: tokens.color.danger, fontSize: tokens.fontSize.sm },
})
