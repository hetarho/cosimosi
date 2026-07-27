import { StyleSheet, Text, View } from 'react-native'

import { LedgerEntryKind, LedgerEntryReason, type LedgerEntry } from '@cosimosi/api-client'
import { tokens } from '@cosimosi/ui'

import { m } from '../../../shared/i18n/index.ts'

// The reason→copy map is a TOTAL Record over the generated enum, so a reason added to the contract
// without copy fails typecheck rather than rendering blank. Two entries are load-bearing:
//
//   - PAYMENT must render. This unit retired the charge PATH, not the readability of rows written
//     before it — the ledger is append-only, and a row whose feature left is still the user's history.
//   - UNSPECIFIED is the only fallback there is, and it is a real one: an older client reading a row a
//     newer server wrote should say "something happened" rather than guess. DAILY_GRANT has no wire
//     value at all, so it never arrives here.
const REASON_LABEL: Readonly<Record<LedgerEntryReason, () => string>> = {
  [LedgerEntryReason.UNSPECIFIED]: m.me_stardust_reason_unknown,
  [LedgerEntryReason.WRITE_DIARY]: m.me_stardust_reason_write_diary,
  [LedgerEntryReason.INVITE]: m.me_stardust_reason_invite,
  [LedgerEntryReason.INVITE_SIGNUP]: m.me_stardust_reason_invite_signup,
  [LedgerEntryReason.SIGNUP_BONUS]: m.me_stardust_reason_signup_bonus,
  [LedgerEntryReason.ACHIEVEMENT_CLAIM]: m.me_stardust_reason_achievement_claim,
  [LedgerEntryReason.ADMIN_GRANT]: m.me_stardust_reason_admin_grant,
  [LedgerEntryReason.RECALL]: m.me_stardust_reason_recall,
  [LedgerEntryReason.GIST_VIEW]: m.me_stardust_reason_gist_view,
  [LedgerEntryReason.ORNAMENT_PURCHASE]: m.me_stardust_reason_ornament_purchase,
  [LedgerEntryReason.PAYMENT]: m.me_stardust_reason_payment,
}

// One ledger row: its reason, its signed amount, and — for a spend only — which kinds paid. `amount`
// is always positive in the ledger and `kind` carries the direction, so the sign is presentation.
//
// An EARN row shows no kind line, because every ledgered earn credits GENERAL: SMALL is refilled by
// derivation and never earned, so an earn has no split to show.
//
// A row is not pressable, and there is nowhere for it to go: the entry carries no episodic-memory id
// and no diary id, so a jump into a memory is unrepresentable rather than merely unwired ([I11]).
export function LedgerEntryRow({ entry }: { entry: LedgerEntry }) {
  const spend = entry.kind === LedgerEntryKind.SPEND
  const sign = spend ? '−' : '+'
  // The Record is total over the enum, so a missing arm is a typecheck failure. A value OUTSIDE the
  // enum still reaches here at runtime, though — protobuf-es keeps an unknown numeric enum value as-is
  // rather than coercing it — so a row a newer server wrote reads as "a record" instead of crashing the
  // whole history on `undefined is not a function`.
  const label = REASON_LABEL[entry.reason] ?? m.me_stardust_reason_unknown

  return (
    <View style={styles.row}>
      <View style={styles.line}>
        <Text style={styles.reason}>{label()}</Text>
        <Text style={styles.amount}>{`${sign}${String(entry.amount)}`}</Text>
      </View>
      {spend ? (
        <Text style={styles.split}>
          {`${m.me_stardust_spend_split_label()} ${m.twinkle_balance_small_label()} ${String(
            entry.fromSmall,
          )} · ${m.twinkle_balance_general_label()} ${String(entry.fromGeneral)}`}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    gap: tokens.spacing[1],
    paddingVertical: tokens.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.spacing[3],
  },
  reason: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
  amount: { color: tokens.color.text, fontSize: tokens.fontSize.sm },
  split: { color: tokens.color['text-muted'], fontSize: tokens.fontSize.xs },
})
