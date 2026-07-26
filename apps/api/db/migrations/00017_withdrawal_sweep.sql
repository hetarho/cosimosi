-- +goose Up
ALTER TABLE job_targets
    DROP CONSTRAINT job_targets_kind_revision_check,
    ADD CONSTRAINT job_targets_kind_revision_check CHECK (
        (target_kind IN ('release_group', 'user') AND expected_revision IS NULL)
        OR (
            target_kind IN ('episodic_memory', 'neuron')
            AND expected_revision > 0
        )
    );

COMMENT ON TABLE twinkle_ledger_entries IS
    'Append-only against system behavior; the only DELETE is the user-originated, post-retention account withdrawal sweep.';
COMMENT ON TABLE twinkle_balances IS
    'Authoritative per-user balance; the only DELETE is the user-originated, post-retention account withdrawal sweep.';

-- +goose Down
COMMENT ON TABLE twinkle_balances IS NULL;
COMMENT ON TABLE twinkle_ledger_entries IS NULL;

ALTER TABLE job_targets
    DROP CONSTRAINT job_targets_kind_revision_check,
    ADD CONSTRAINT job_targets_kind_revision_check CHECK (
        (target_kind = 'release_group' AND expected_revision IS NULL)
        OR (
            target_kind IN ('episodic_memory', 'neuron')
            AND expected_revision > 0
        )
    );
