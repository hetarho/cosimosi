-- +goose Up
-- Memory graph foreign keys lead with the owning user ([U1], ARCH-13). A single-column key whose
-- child indexes all start with user_id makes every parent delete (release sweep, withdrawal purge)
-- check or cascade by scanning the whole all-user child table. A composite (user_id, x) key is
-- served by the existing user-leading indexes and also states that a child belongs to its parent's
-- user. Each key is added NOT VALID, validated without blocking writes, then the old key is dropped.
-- The parents' (user_id, id) candidate keys: neurons gains one here, and diaries and memories carry
-- theirs from the receipts migration — added here too wherever a database lacks them.
-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'diaries_user_id_id_unique') THEN
        ALTER TABLE diaries ADD CONSTRAINT diaries_user_id_id_unique UNIQUE (user_id, id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'episodic_memories_user_id_id_unique') THEN
        ALTER TABLE episodic_memories
            ADD CONSTRAINT episodic_memories_user_id_id_unique UNIQUE (user_id, id);
    END IF;
END
$$;
-- +goose StatementEnd
ALTER TABLE neurons
    ADD CONSTRAINT neurons_user_id_id_unique UNIQUE (user_id, id);

ALTER TABLE episodic_memories
    ADD CONSTRAINT episodic_memories_user_diary_fkey
        FOREIGN KEY (user_id, diary_id) REFERENCES diaries(user_id, id) NOT VALID;
ALTER TABLE neuron_activations
    ADD CONSTRAINT neuron_activations_user_memory_fkey
        FOREIGN KEY (user_id, episodic_memory_id) REFERENCES episodic_memories(user_id, id) NOT VALID;
ALTER TABLE neuron_activations
    ADD CONSTRAINT neuron_activations_user_neuron_fkey
        FOREIGN KEY (user_id, neuron_id) REFERENCES neurons(user_id, id) NOT VALID;
ALTER TABLE synapses
    ADD CONSTRAINT synapses_user_neuron_a_fkey
        FOREIGN KEY (user_id, neuron_a_id) REFERENCES neurons(user_id, id) NOT VALID;
ALTER TABLE synapses
    ADD CONSTRAINT synapses_user_neuron_b_fkey
        FOREIGN KEY (user_id, neuron_b_id) REFERENCES neurons(user_id, id) NOT VALID;
ALTER TABLE embeddings
    ADD CONSTRAINT embeddings_user_neuron_fkey
        FOREIGN KEY (user_id, neuron_id) REFERENCES neurons(user_id, id) NOT VALID;
ALTER TABLE memory_provenance
    ADD CONSTRAINT memory_provenance_user_memory_fkey
        FOREIGN KEY (user_id, episodic_memory_id) REFERENCES episodic_memories(user_id, id)
        ON DELETE CASCADE NOT VALID;

ALTER TABLE episodic_memories VALIDATE CONSTRAINT episodic_memories_user_diary_fkey;
ALTER TABLE neuron_activations VALIDATE CONSTRAINT neuron_activations_user_memory_fkey;
ALTER TABLE neuron_activations VALIDATE CONSTRAINT neuron_activations_user_neuron_fkey;
ALTER TABLE synapses VALIDATE CONSTRAINT synapses_user_neuron_a_fkey;
ALTER TABLE synapses VALIDATE CONSTRAINT synapses_user_neuron_b_fkey;
ALTER TABLE embeddings VALIDATE CONSTRAINT embeddings_user_neuron_fkey;
ALTER TABLE memory_provenance VALIDATE CONSTRAINT memory_provenance_user_memory_fkey;

ALTER TABLE episodic_memories DROP CONSTRAINT episodic_memories_diary_id_fkey;
ALTER TABLE neuron_activations DROP CONSTRAINT neuron_activations_episodic_memory_id_fkey;
ALTER TABLE neuron_activations DROP CONSTRAINT neuron_activations_neuron_id_fkey;
ALTER TABLE synapses DROP CONSTRAINT synapses_neuron_a_id_fkey;
ALTER TABLE synapses DROP CONSTRAINT synapses_neuron_b_id_fkey;
ALTER TABLE embeddings DROP CONSTRAINT embeddings_neuron_id_fkey;
ALTER TABLE memory_provenance DROP CONSTRAINT memory_provenance_episodic_memory_id_fkey;

-- Receipts are declared with composite keys and user-leading cascade indexes; a database may hold
-- single-column ones instead. Converge both shapes on the declared one.
ALTER TABLE memory_paid_action_receipts
    DROP CONSTRAINT IF EXISTS memory_paid_action_receipts_episodic_memory_id_fkey;
ALTER TABLE memory_paid_action_receipts
    DROP CONSTRAINT IF EXISTS memory_paid_action_receipts_diary_id_fkey;
-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'memory_paid_action_receipts_user_id_episodic_memory_id_fkey'
    ) THEN
        ALTER TABLE memory_paid_action_receipts
            ADD CONSTRAINT memory_paid_action_receipts_user_id_episodic_memory_id_fkey
                FOREIGN KEY (user_id, episodic_memory_id)
                REFERENCES episodic_memories(user_id, id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'memory_paid_action_receipts_user_id_diary_id_fkey'
    ) THEN
        ALTER TABLE memory_paid_action_receipts
            ADD CONSTRAINT memory_paid_action_receipts_user_id_diary_id_fkey
                FOREIGN KEY (user_id, diary_id)
                REFERENCES diaries(user_id, id) ON DELETE CASCADE;
    END IF;
END
$$;
-- +goose StatementEnd
DROP INDEX IF EXISTS memory_paid_action_receipts_by_memory;
DROP INDEX IF EXISTS memory_paid_action_receipts_by_diary;
CREATE INDEX memory_paid_action_receipts_by_memory
    ON memory_paid_action_receipts (user_id, episodic_memory_id)
    WHERE episodic_memory_id IS NOT NULL;
CREATE INDEX memory_paid_action_receipts_by_diary
    ON memory_paid_action_receipts (user_id, diary_id)
    WHERE diary_id IS NOT NULL;

-- +goose Down
-- The receipt keys stay in their declared composite shape; only the graph keys revert.
ALTER TABLE memory_provenance
    ADD CONSTRAINT memory_provenance_episodic_memory_id_fkey
        FOREIGN KEY (episodic_memory_id) REFERENCES episodic_memories(id) ON DELETE CASCADE;
ALTER TABLE embeddings
    ADD CONSTRAINT embeddings_neuron_id_fkey FOREIGN KEY (neuron_id) REFERENCES neurons(id);
ALTER TABLE synapses
    ADD CONSTRAINT synapses_neuron_b_id_fkey FOREIGN KEY (neuron_b_id) REFERENCES neurons(id);
ALTER TABLE synapses
    ADD CONSTRAINT synapses_neuron_a_id_fkey FOREIGN KEY (neuron_a_id) REFERENCES neurons(id);
ALTER TABLE neuron_activations
    ADD CONSTRAINT neuron_activations_neuron_id_fkey FOREIGN KEY (neuron_id) REFERENCES neurons(id);
ALTER TABLE neuron_activations
    ADD CONSTRAINT neuron_activations_episodic_memory_id_fkey
        FOREIGN KEY (episodic_memory_id) REFERENCES episodic_memories(id);
ALTER TABLE episodic_memories
    ADD CONSTRAINT episodic_memories_diary_id_fkey FOREIGN KEY (diary_id) REFERENCES diaries(id);

ALTER TABLE memory_provenance DROP CONSTRAINT memory_provenance_user_memory_fkey;
ALTER TABLE embeddings DROP CONSTRAINT embeddings_user_neuron_fkey;
ALTER TABLE synapses DROP CONSTRAINT synapses_user_neuron_b_fkey;
ALTER TABLE synapses DROP CONSTRAINT synapses_user_neuron_a_fkey;
ALTER TABLE neuron_activations DROP CONSTRAINT neuron_activations_user_neuron_fkey;
ALTER TABLE neuron_activations DROP CONSTRAINT neuron_activations_user_memory_fkey;
ALTER TABLE episodic_memories DROP CONSTRAINT episodic_memories_user_diary_fkey;
ALTER TABLE neurons DROP CONSTRAINT neurons_user_id_id_unique;
