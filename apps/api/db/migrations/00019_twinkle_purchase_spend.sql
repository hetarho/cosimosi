-- +goose Up
-- [P9] An ornament purchase is GENERAL-only: SMALL (stored as basic) may never fund it. The domain's
-- spend planner already returns a zero SMALL draw for a purchase — this is the schema saying the same
-- thing, so the guarantee survives a caller that bypasses the use-case. The pair is deliberate: the
-- invariant is stated in code and in the schema, and as prose in neither.
--
-- Scoped to the one reason that guards money. The `reason` column stays a domain-owned TEXT closed set
-- with no membership CHECK: on an append-only ledger that would cost a migration per reason and risk
-- failing historical rows.
ALTER TABLE twinkle_ledger_entries
    ADD CONSTRAINT twinkle_ledger_entries_purchase_general_only
    CHECK (reason NOT IN ('ornament_purchase') OR from_basic = 0);

COMMENT ON COLUMN twinkle_ledger_entries.reason IS
    'closed set, owned by the twinkle domain: daily_grant(reserved, never written) | write_diary | '
    'invite | invite_signup | signup_bonus | achievement_claim | admin_grant | recall | gist_view | '
    'ornament_purchase | payment(historical, no write path)';

-- +goose Down
ALTER TABLE twinkle_ledger_entries
    DROP CONSTRAINT twinkle_ledger_entries_purchase_general_only;

-- The column carried no database comment before this migration (00007 documents `reason` in an inline
-- SQL comment only), so restoring that state means clearing it — otherwise a rollback would leave the
-- schema asserting a closed set the rolled-back code no longer enforces.
COMMENT ON COLUMN twinkle_ledger_entries.reason IS NULL;
