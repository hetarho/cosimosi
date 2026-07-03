-- Dev-only seed: a small, coherent memory universe for the VITE_DEV_USER_ID / dev bypass
-- user ('dev-user'), so `pnpm dev` renders a real graph without the writing flow (job 32).
-- Re-runnable: it clears only this dev user's rows, then re-inserts. Never run against a
-- real user's data. Apply with:  psql "$DATABASE_URL" -f scripts/seed-dev-universe.sql
--
-- Mood strings are uppercase (the emotion MOODS the FE mapper accepts); neuron_type is
-- semantic|spatial|entity; synapses keep the canonical neuron_a_id < neuron_b_id order.
-- Values (valence/arousal) follow spec/values.yaml mood coordinates for consistency.

BEGIN;

-- FK-safe teardown, scoped strictly to the dev user.
DELETE FROM synapses            WHERE user_id = 'dev-user';
DELETE FROM neuron_activations  WHERE user_id = 'dev-user';
DELETE FROM embeddings          WHERE user_id = 'dev-user';
DELETE FROM episodic_memories   WHERE user_id = 'dev-user';
DELETE FROM neurons             WHERE user_id = 'dev-user';
DELETE FROM diaries             WHERE user_id = 'dev-user';

INSERT INTO diaries (id, user_id, body, diary_date) VALUES
  ('dev-diary-01', 'dev-user', '개발용 시드 일기 — 여러 기억으로 분할된 원본.', DATE '2026-06-28');

-- neurons: ids are zero-padded so lexical order matches, keeping synapse a<b trivial.
INSERT INTO neurons (id, user_id, name, neuron_type) VALUES
  ('dev-neuron-01', 'dev-user', '바다',   'semantic'),
  ('dev-neuron-02', 'dev-user', '여름',   'semantic'),
  ('dev-neuron-03', 'dev-user', '할머니', 'entity'),
  ('dev-neuron-04', 'dev-user', '감나무', 'semantic'),
  ('dev-neuron-05', 'dev-user', '해운대', 'spatial'),
  ('dev-neuron-06', 'dev-user', '마당',   'spatial'),
  ('dev-neuron-07', 'dev-user', '마감',   'semantic'),
  ('dev-neuron-08', 'dev-user', '사무실', 'spatial');

INSERT INTO episodic_memories
  (id, user_id, diary_id, name, current_text, seed, mood, valence, arousal, intensity, base_strength, created_universe_time) VALUES
  ('dev-memory-01', 'dev-user', 'dev-diary-01', '차가운 바다에서의 첫 수영', '여름 초입, 해운대 바다에 처음 뛰어들었다.', 101, 'JOY',        0.82,  0.72, 0.7, 0.68, DATE '2026-06-28'),
  ('dev-memory-02', 'dev-user', 'dev-diary-01', '할머니 댁 마당의 감나무',   '할머니 댁 마당에 선 오래된 감나무.',       102, 'GRATITUDE',  0.76,  0.38, 0.7, 0.55, DATE '2026-06-29'),
  ('dev-memory-03', 'dev-user', 'dev-diary-01', '밤샘 마감 후의 탈진',       '사무실에서 밤을 새워 마감을 끝냈다.',      103, 'TIRED',     -0.55,  0.18, 0.7, 0.41, DATE '2026-06-30'),
  ('dev-memory-04', 'dev-user', 'dev-diary-01', '여름 저녁의 마당 산책',     '해질녘 마당을 천천히 걸었다.',            104, 'CALM',       0.62,  0.22, 0.7, 0.5,  DATE '2026-07-01'),
  ('dev-memory-05', 'dev-user', 'dev-diary-01', '해운대 불꽃축제',           '해운대에서 본 여름밤의 불꽃.',            105, 'EXCITEMENT', 0.78,  0.9,  0.7, 0.72, DATE '2026-07-02');

-- membership edges (memory ↔ neuron); weight 1.0 matches encode.activation_weight.
INSERT INTO neuron_activations (episodic_memory_id, neuron_id, user_id, weight) VALUES
  ('dev-memory-01', 'dev-neuron-01', 'dev-user', 1.0),
  ('dev-memory-01', 'dev-neuron-02', 'dev-user', 1.0),
  ('dev-memory-01', 'dev-neuron-05', 'dev-user', 1.0),
  ('dev-memory-02', 'dev-neuron-03', 'dev-user', 1.0),
  ('dev-memory-02', 'dev-neuron-04', 'dev-user', 1.0),
  ('dev-memory-02', 'dev-neuron-06', 'dev-user', 1.0),
  ('dev-memory-03', 'dev-neuron-07', 'dev-user', 1.0),
  ('dev-memory-03', 'dev-neuron-08', 'dev-user', 1.0),
  ('dev-memory-04', 'dev-neuron-02', 'dev-user', 1.0),
  ('dev-memory-04', 'dev-neuron-06', 'dev-user', 1.0),
  ('dev-memory-05', 'dev-neuron-01', 'dev-user', 1.0),
  ('dev-memory-05', 'dev-neuron-05', 'dev-user', 1.0);

-- synapses: neuron↔neuron only, canonical a<b; co_activation_count = shared memories.
INSERT INTO synapses (id, user_id, neuron_a_id, neuron_b_id, strength, co_activation_count, last_activated_universe_time) VALUES
  ('dev-synapse-01', 'dev-user', 'dev-neuron-01', 'dev-neuron-02', 0.32, 1, DATE '2026-06-28'),
  ('dev-synapse-02', 'dev-user', 'dev-neuron-01', 'dev-neuron-05', 0.58, 2, DATE '2026-07-02'),
  ('dev-synapse-03', 'dev-user', 'dev-neuron-02', 'dev-neuron-05', 0.32, 1, DATE '2026-06-28'),
  ('dev-synapse-04', 'dev-user', 'dev-neuron-03', 'dev-neuron-04', 0.32, 1, DATE '2026-06-29'),
  ('dev-synapse-05', 'dev-user', 'dev-neuron-03', 'dev-neuron-06', 0.32, 1, DATE '2026-06-29'),
  ('dev-synapse-06', 'dev-user', 'dev-neuron-04', 'dev-neuron-06', 0.32, 1, DATE '2026-06-29'),
  ('dev-synapse-07', 'dev-user', 'dev-neuron-02', 'dev-neuron-06', 0.20, 1, DATE '2026-07-01'),
  ('dev-synapse-08', 'dev-user', 'dev-neuron-07', 'dev-neuron-08', 0.32, 1, DATE '2026-06-30');

COMMIT;
