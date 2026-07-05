-- +goose Up
-- A monotonic lease token per job. The worker bumps it on every claim, so a stale
-- worker whose lease expired (its job was re-claimed) can no longer finalize the row:
-- the terminal transitions match only the current generation. It also counts claims,
-- which the runner uses to dead-letter a job that keeps killing its worker.
ALTER TABLE jobs ADD COLUMN lease_generation BIGINT NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE jobs DROP COLUMN lease_generation;
