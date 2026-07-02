-- +goose Up
CREATE TABLE diaries (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    body        TEXT NOT NULL,
    diary_date  DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE episodic_memories (
    id                          TEXT PRIMARY KEY,
    user_id                     TEXT NOT NULL,
    diary_id                    TEXT NOT NULL REFERENCES diaries(id),
    name                        TEXT NOT NULL,
    current_text                TEXT NOT NULL,
    seed                        BIGINT,
    mood                        TEXT NOT NULL,
    valence                     REAL NOT NULL,
    arousal                     REAL NOT NULL,
    intensity                   REAL NOT NULL,
    base_strength               REAL NOT NULL,
    recall_count                INT NOT NULL DEFAULT 0,
    created_universe_time       DATE NOT NULL,
    last_recalled_universe_time DATE,
    semantic_stage              SMALLINT NOT NULL DEFAULT 0,
    semanticize_timer_reset_at  DATE,
    semantic_stages             JSONB,
    decay_stages                JSONB,
    deleted_at                  TIMESTAMPTZ
);

CREATE TABLE neurons (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    name        TEXT,
    neuron_type TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    sealed_at   TIMESTAMPTZ
);

CREATE TABLE neuron_activations (
    episodic_memory_id TEXT NOT NULL REFERENCES episodic_memories(id),
    neuron_id          TEXT NOT NULL REFERENCES neurons(id),
    user_id            TEXT NOT NULL,
    weight             REAL NOT NULL,
    PRIMARY KEY (episodic_memory_id, neuron_id)
);

CREATE TABLE synapses (
    id                           TEXT PRIMARY KEY,
    user_id                      TEXT NOT NULL,
    neuron_a_id                  TEXT NOT NULL REFERENCES neurons(id),
    neuron_b_id                  TEXT NOT NULL REFERENCES neurons(id),
    strength                     REAL NOT NULL,
    co_activation_count          INT NOT NULL,
    last_activated_universe_time DATE NOT NULL,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (neuron_a_id < neuron_b_id),
    UNIQUE (user_id, neuron_a_id, neuron_b_id)
);

CREATE TABLE embeddings (
    neuron_id TEXT NOT NULL REFERENCES neurons(id),
    user_id   TEXT NOT NULL,
    vector    vector(1024) NOT NULL,
    PRIMARY KEY (neuron_id)
);

CREATE INDEX embeddings_vector_hnsw ON embeddings USING hnsw (vector vector_cosine_ops);

CREATE TABLE jobs (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    kind        TEXT NOT NULL,
    payload     JSONB NOT NULL,
    status      TEXT NOT NULL,
    attempts    INT NOT NULL DEFAULT 0,
    next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX diaries_user_diary_date_idx ON diaries (user_id, diary_date, id);
CREATE INDEX episodic_memories_user_universe_time_idx ON episodic_memories (user_id, created_universe_time, id) WHERE deleted_at IS NULL;
CREATE INDEX episodic_memories_user_diary_idx ON episodic_memories (user_id, diary_id);
CREATE INDEX neurons_user_type_idx ON neurons (user_id, neuron_type, id) WHERE sealed_at IS NULL;
CREATE INDEX neuron_activations_user_memory_idx ON neuron_activations (user_id, episodic_memory_id);
CREATE INDEX neuron_activations_user_neuron_idx ON neuron_activations (user_id, neuron_id);
CREATE INDEX synapses_user_neuron_a_idx ON synapses (user_id, neuron_a_id);
CREATE INDEX synapses_user_neuron_b_idx ON synapses (user_id, neuron_b_id);
CREATE INDEX synapses_user_last_activated_idx ON synapses (user_id, last_activated_universe_time);
CREATE INDEX embeddings_user_neuron_idx ON embeddings (user_id, neuron_id);
CREATE INDEX jobs_user_status_next_run_idx ON jobs (user_id, status, next_run_at);

-- +goose Down
DROP INDEX IF EXISTS jobs_user_status_next_run_idx;
DROP INDEX IF EXISTS embeddings_user_neuron_idx;
DROP INDEX IF EXISTS synapses_user_last_activated_idx;
DROP INDEX IF EXISTS synapses_user_neuron_b_idx;
DROP INDEX IF EXISTS synapses_user_neuron_a_idx;
DROP INDEX IF EXISTS neuron_activations_user_neuron_idx;
DROP INDEX IF EXISTS neuron_activations_user_memory_idx;
DROP INDEX IF EXISTS neurons_user_type_idx;
DROP INDEX IF EXISTS episodic_memories_user_diary_idx;
DROP INDEX IF EXISTS episodic_memories_user_universe_time_idx;
DROP INDEX IF EXISTS diaries_user_diary_date_idx;
DROP INDEX IF EXISTS embeddings_vector_hnsw;

DROP TABLE IF EXISTS jobs;
DROP TABLE IF EXISTS embeddings;
DROP TABLE IF EXISTS synapses;
DROP TABLE IF EXISTS neuron_activations;
DROP TABLE IF EXISTS neurons;
DROP TABLE IF EXISTS episodic_memories;
DROP TABLE IF EXISTS diaries;
