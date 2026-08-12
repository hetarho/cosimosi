import { LedgerEntryKind, LedgerEntryReason, type LedgerEntry } from '@cosimosi/api-client'

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
// The split rides in PARENTHESES beside the amount rather than on a line of its own, small and quiet:
// `−15 (작은 별가루 5 · 별가루 10)`. It is a breakdown OF the number it sits beside, not a second fact
// about the row, and a full-size line under the reason gave it the weight of one. No label introduces
// it either — the parentheses and the two kind names already say what it is, and "쓴 몫" was a caption
// for something the reader can simply read.
//
// An EARN row shows no split at all, because every ledgered earn credits GENERAL: SMALL is refilled by
// derivation and never earned, so an earn has no split to show. The two row shapes differ rather than
// one carrying a permanently empty field.
//
// A row is never a link. There is nowhere to go: the entry carries no episodic-memory id and no diary
// id, so a jump into a memory is unrepresentable rather than merely unwired ([I11]) — and the recall
// it would bypass is priced ([G4]).
export function LedgerEntryRow({ entry }: { entry: LedgerEntry }) {
  const spend = entry.kind === LedgerEntryKind.SPEND
  const sign = spend ? '−' : '+'
  // The Record is total over the enum, so a missing arm is a typecheck failure. A value OUTSIDE the
  // enum still reaches here at runtime, though — protobuf-es keeps an unknown numeric enum value as-is
  // rather than coercing it — so a row a newer server wrote reads as "a record" instead of crashing the
  // whole history on `undefined is not a function`.
  const label = REASON_LABEL[entry.reason] ?? m.me_stardust_reason_unknown

  return (
    <li className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <span className="text-sm text-text">{label()}</span>
      {/* One baseline, one reading: the amount, and the parenthetical breakdown of it a step smaller
          and a step quieter, so the eye takes the total first and the split only if it wants it. */}
      <span className="flex items-baseline gap-1.5 text-sm text-text tabular-nums">
        {`${sign}${String(entry.amount)}`}
        {spend ? (
          <span className="text-xs text-text-subtle">
            {`(${m.me_stardust_spend_split({
              small: String(entry.fromSmall),
              general: String(entry.fromGeneral),
            })})`}
          </span>
        ) : null}
      </span>
    </li>
  )
}
