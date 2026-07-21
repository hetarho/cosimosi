-- +goose Up
-- Payment transactions are provider-global facts, not per-account facts. Refuse to add the
-- guard if historical cross-user replays exist; append-only ledger history must be investigated,
-- never rewritten or deleted to make the migration pass.
-- +goose StatementBegin
DO $$
DECLARE
    duplicate_summary TEXT;
BEGIN
    SELECT string_agg(format('%s (%s users, %s rows)', dedup_key, user_count, row_count), ', ' ORDER BY dedup_key)
    INTO duplicate_summary
    FROM (
        SELECT dedup_key,
               count(DISTINCT user_id) AS user_count,
               count(*) AS row_count
        FROM twinkle_ledger_entries
        WHERE reason = 'payment'
          AND dedup_key IS NOT NULL
        GROUP BY dedup_key
        HAVING count(DISTINCT user_id) > 1
    ) duplicates;

    IF duplicate_summary IS NOT NULL THEN
        RAISE EXCEPTION 'cannot enforce global Twinkle payment transaction uniqueness; investigate duplicate append-only ledger keys: %', duplicate_summary
            USING ERRCODE = '23505',
                  HINT = 'Do not UPDATE or DELETE twinkle_ledger_entries. Reconcile the affected provider transactions before retrying this migration.';
    END IF;
END $$;
-- +goose StatementEnd

CREATE UNIQUE INDEX twinkle_ledger_payment_transaction_key_unique
    ON twinkle_ledger_entries (dedup_key)
    WHERE reason = 'payment' AND dedup_key IS NOT NULL;

-- +goose Down
DROP INDEX twinkle_ledger_payment_transaction_key_unique;
