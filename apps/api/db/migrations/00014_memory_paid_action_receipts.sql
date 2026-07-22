-- +goose Up
-- memory_paid_action_receipts — per-user idempotency receipts for the three paid actions
-- (recall / whole-diary recall / gist view), [R1][R8] (A2/A3). One row per client-minted
-- operation_id: it records the canonical request fingerprint and the original typed response, so a
-- response-loss retry (same id + same canonical input) replays the committed result WITHOUT
-- re-spending or re-applying effects, while a different input under the same id is a conflict, not
-- a hit. Written in the SAME transaction as the debit + sync/effects, so the receipt and its side
-- effects commit wholly or not at all (A3). NEVER updated (a committed receipt is immutable [I1]);
-- deleted only when its retained target is hard-deleted, via the target FK cascade — the receipt is
-- meaningful only while its target exists, and the 30-day post-delete sweep is the sole hard delete
-- (Epic H), so a receipt needs no independent retention timer.
-- Composite candidate keys let the receipt FKs enforce that the retained target belongs to the
-- same user as the receipt; globally unique ids alone would not encode that tenant relationship.
ALTER TABLE diaries
    ADD CONSTRAINT diaries_user_id_id_unique UNIQUE (user_id, id);
ALTER TABLE episodic_memories
    ADD CONSTRAINT episodic_memories_user_id_id_unique UNIQUE (user_id, id);

CREATE TABLE memory_paid_action_receipts (
    user_id             TEXT NOT NULL,                  -- per-user isolation [U1]
    operation_id        TEXT NOT NULL,                  -- client-minted idempotency key (A2)
    action_kind         TEXT NOT NULL,                  -- 'recall' | 'diary_recall' | 'view_semantic'
    request_fingerprint TEXT NOT NULL,                  -- canonical hash of the request input (A2)
    -- The retained target the receipt is tied to for cascade cleanup: recall/gist-view reference an
    -- episodic memory, a whole-diary recall references a diary. Exactly one is set (CHECK), and the
    -- matching FK cascades the receipt away when that target is swept.
    episodic_memory_id  TEXT,
    diary_id            TEXT,
    response            JSONB NOT NULL,                 -- the original typed response, replayed verbatim (A2)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, operation_id),
    FOREIGN KEY (user_id, episodic_memory_id)
        REFERENCES episodic_memories(user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, diary_id)
        REFERENCES diaries(user_id, id) ON DELETE CASCADE,
    CHECK (
        (episodic_memory_id IS NOT NULL AND diary_id IS NULL) OR
        (episodic_memory_id IS NULL AND diary_id IS NOT NULL)
    )
);

-- Cascade-support indexes: a hard delete of a memory/diary must find its referencing receipts
-- without a full scan (the FK cascade's lookup).
CREATE INDEX memory_paid_action_receipts_by_memory
    ON memory_paid_action_receipts (user_id, episodic_memory_id)
    WHERE episodic_memory_id IS NOT NULL;
CREATE INDEX memory_paid_action_receipts_by_diary
    ON memory_paid_action_receipts (user_id, diary_id)
    WHERE diary_id IS NOT NULL;

-- +goose Down
DROP TABLE memory_paid_action_receipts;
ALTER TABLE episodic_memories DROP CONSTRAINT episodic_memories_user_id_id_unique;
ALTER TABLE diaries DROP CONSTRAINT diaries_user_id_id_unique;
