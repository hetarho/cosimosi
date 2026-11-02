-- Consolidation use-case writes run INSIDE the advance transaction the
-- progression hook fires on launch and sync ([T4]) — the interval read reuses
-- ListUniverseEpisodicMemories (universe.sql), the same non-deleted per-user shape the read
-- path sees. Every statement is scoped to the authenticated user (§4, lint:persistence).
-- Nothing here deletes a row or touches a Diary ([I1][I2]); no coordinate is stored ([I5]).

-- Batch stage advance ([C1][C6][C7]): the risen stage plus the consumed gist-timer anchor per
-- memory. GREATEST guards both in SQL too (defense-in-depth — a stage never decrements and the
-- timer anchor never rewinds [I10]), and the anchor write is what makes an already-consolidated
-- interval imply zero further units (A10 convergence).
-- name: ApplyConsolidationStageAdvances :exec
UPDATE episodic_memories AS em
SET semantic_stage = GREATEST(em.semantic_stage, advance.stage),
    semanticize_timer_reset_at = GREATEST(
        COALESCE(em.semanticize_timer_reset_at, em.created_universe_time),
        advance.timer_reset_at
    )
FROM (
    SELECT
        UNNEST(sqlc.arg(memory_ids)::text[]) AS memory_id,
        UNNEST(sqlc.arg(stages)::smallint[]) AS stage,
        UNNEST(sqlc.arg(timer_reset_ats)::date[]) AS timer_reset_at
) AS advance
WHERE em.user_id = sqlc.arg(user_id)
  AND em.id = advance.memory_id
  AND em.deleted_at IS NULL;

-- The consolidation watermark's locked read: the universe-time this user's consolidation has
-- already processed through (NULL = never consolidated). FOR UPDATE holds the row so
-- overlapping advance transactions serialize on the clamp instead of racing it. The row always
-- exists here — the hook fires only after AdvanceUniverseClock upserted it in this transaction.
-- name: ConsolidationWatermarkForUpdate :one
SELECT consolidated_through
FROM universe_state
WHERE user_id = $1
FOR UPDATE;

-- Moves the watermark to the consolidated interval's end, after every interval effect
-- succeeded in this same transaction. GREATEST keeps it monotone ([I10]) — a rolled-back
-- attempt leaves it untouched, so the interval stays retryable.
-- name: SetConsolidationWatermark :exec
UPDATE universe_state
SET consolidated_through = GREATEST(COALESCE(consolidated_through, sqlc.arg(through)::date), sqlc.arg(through)::date),
    updated_at = now()
WHERE user_id = sqlc.arg(user_id);

-- Records a gist rise whose ladder text is missing as pending work instead of publishing
-- it: the visible semantic_stage stays at the last readable stage; the semanticize
-- completion transaction finalizes the rise once real text exists. GREATEST extends an
-- existing pending target; COALESCE keeps the FIRST crossing's universe-time as the event
-- time the finalized 변천사 rows will carry.
-- name: RecordPendingGistRises :exec
UPDATE episodic_memories AS em
SET pending_semantic_stage = GREATEST(COALESCE(em.pending_semantic_stage, 0::smallint), pending.stage),
    pending_semantic_rise_at = COALESCE(em.pending_semantic_rise_at, pending.rise_at)
FROM (
    SELECT
        UNNEST(sqlc.arg(memory_ids)::text[]) AS memory_id,
        UNNEST(sqlc.arg(stages)::smallint[]) AS stage,
        UNNEST(sqlc.arg(rise_ats)::date[]) AS rise_at
) AS pending
WHERE em.user_id = sqlc.arg(user_id)
  AND em.id = pending.memory_id
  AND em.deleted_at IS NULL;

-- Whole-array decay-stage text writes ([F1][R8a]), one batch: the use-case merges (existing
-- entries are never overwritten — the merge fills missing slots only) and the per-user advisory
-- lock the advance transaction holds serializes the read-merge-write. Arrays travel as JSON text.
-- name: FillConsolidationDecayStages :exec
UPDATE episodic_memories AS em
SET decay_stages = fill.decay_stages::jsonb
FROM (
    SELECT
        UNNEST(sqlc.arg(memory_ids)::text[]) AS memory_id,
        UNNEST(sqlc.arg(decay_stages)::text[]) AS decay_stages
) AS fill
WHERE em.user_id = sqlc.arg(user_id)
  AND em.id = fill.memory_id
  AND em.deleted_at IS NULL;

-- Consolidation's scalar view of the universe: the anchors and stage integers the interval math
-- reads, with text presence summarized instead of the text itself, so ladder and decay texts are
-- fetched only for memories whose stage crosses. semantic_stages_present sets bit (stage - 1) for
-- each of the four ladder rungs (SemanticStages is a fixed four-rung array) holding a
-- non-whitespace character; decay_stages_filled counts the non-empty stored decay texts, so it
-- equals decay_stage_count exactly when the stored array has no hole.
-- name: ListConsolidationMemories :many
SELECT
    id,
    arousal,
    base_strength,
    recall_count,
    created_universe_time,
    last_recalled_universe_time,
    forgetting_offset_days,
    semantic_stage,
    semanticize_timer_reset_at,
    pending_semantic_stage,
    representation_revision,
    (CASE WHEN COALESCE(semantic_stages->>0, '') ~ '[^[:space:]]' THEN 1 ELSE 0 END
     | CASE WHEN COALESCE(semantic_stages->>1, '') ~ '[^[:space:]]' THEN 2 ELSE 0 END
     | CASE WHEN COALESCE(semantic_stages->>2, '') ~ '[^[:space:]]' THEN 4 ELSE 0 END
     | CASE WHEN COALESCE(semantic_stages->>3, '') ~ '[^[:space:]]' THEN 8 ELSE 0 END)::int AS semantic_stages_present,
    COALESCE(jsonb_array_length(decay_stages), 0)::int AS decay_stage_count,
    COALESCE(jsonb_array_length(
        jsonb_path_query_array(decay_stages, '$[*] ? (@.type() == "string" && @ != "")')
    ), 0)::int AS decay_stages_filled
FROM episodic_memories
WHERE user_id = sqlc.arg(user_id)
  AND deleted_at IS NULL
ORDER BY created_universe_time, id;

-- The texts a crossing memory needs: its ladder for the provenance rows a rise publishes, and its
-- current text, seed and stored decay texts for the decay fill.
-- name: ListConsolidationTexts :many
SELECT id, current_text, seed, semantic_stages, decay_stages
FROM episodic_memories
WHERE user_id = sqlc.arg(user_id)
  AND id = ANY(sqlc.arg(memory_ids)::text[])
  AND deleted_at IS NULL;

-- A rise's semanticized provenance rows in one batch ([R8a][CC5]). semantic_stage 0 is stored as
-- NULL: stages start at 1, and only a semanticized row carries one.
-- name: AppendMemoryProvenances :exec
INSERT INTO memory_provenance (
    id,
    user_id,
    episodic_memory_id,
    kind,
    source,
    text,
    universe_time,
    semantic_stage,
    created_at
)
SELECT
    entry.id,
    sqlc.arg(user_id),
    entry.episodic_memory_id,
    entry.kind,
    entry.source,
    entry.text,
    entry.universe_time,
    NULLIF(entry.semantic_stage, 0),
    clock_timestamp()
FROM (
    SELECT
        UNNEST(sqlc.arg(ids)::text[]) AS id,
        UNNEST(sqlc.arg(episodic_memory_ids)::text[]) AS episodic_memory_id,
        UNNEST(sqlc.arg(kinds)::text[]) AS kind,
        UNNEST(sqlc.arg(sources)::text[]) AS source,
        UNNEST(sqlc.arg(texts)::text[]) AS text,
        UNNEST(sqlc.arg(universe_times)::date[]) AS universe_time,
        UNNEST(sqlc.arg(semantic_stages)::smallint[]) AS semantic_stage
) AS entry;

-- The live neurons activated by a memory set — the replay-set expansion step ([C2]).
-- name: ListReplaySetNeurons :many
SELECT DISTINCT n.id, n.name, n.neuron_type, n.representation_revision
FROM neuron_activations AS na
JOIN neurons AS n
  ON n.user_id = na.user_id
 AND n.id = na.neuron_id
 AND n.sealed_at IS NULL
WHERE na.user_id = sqlc.arg(user_id)
  AND na.episodic_memory_id = ANY(sqlc.arg(memory_ids)::text[])
ORDER BY n.id;

-- The non-deleted memories activating any of the given neurons — the shared-neuron neighbor
-- hop ([C2]).
-- name: ListMemoriesActivatingNeurons :many
SELECT DISTINCT na.episodic_memory_id
FROM neuron_activations AS na
JOIN episodic_memories AS em
  ON em.user_id = na.user_id
 AND em.id = na.episodic_memory_id
 AND em.deleted_at IS NULL
WHERE na.user_id = sqlc.arg(user_id)
  AND na.neuron_id = ANY(sqlc.arg(neuron_ids)::text[])
ORDER BY na.episodic_memory_id;

-- The replay marker ([C2][I5]): refresh the activation recency of every synapse with BOTH
-- endpoints inside the touched replay set — the same trace a recall's reinforcement leaves,
-- consumed at read (the synapse strength fade / effective strength), never a stored coordinate. GREATEST
-- keeps the marker forward-only ([I10]).
-- name: TouchReplaySetSynapses :exec
UPDATE synapses
SET last_activated_universe_time = GREATEST(last_activated_universe_time, sqlc.arg(universe_time)::date)
WHERE user_id = sqlc.arg(user_id)
  AND neuron_a_id = ANY(sqlc.arg(neuron_ids)::text[])
  AND neuron_b_id = ANY(sqlc.arg(neuron_ids)::text[]);

-- The Downscale input ([C4]): the user's synapses that actually slept through the interval —
-- an edge last activated at/after the advance target was linked in this very transaction (or
-- replay-refreshed) and did not exist through the slept days, so it is excluded.
-- Both endpoint neurons must be alive ([X3]): a sealed-endpoint edge leaves the dynamics via
-- the canonical alive-predicate, so it is never Downscaled — no invisible-but-still-renormalizing ghost.
-- name: ListSynapseStrengthsForDownscale :many
SELECT s.id, s.strength
FROM synapses AS s
JOIN neurons AS na
  ON na.id = s.neuron_a_id
 AND na.user_id = s.user_id
 AND na.sealed_at IS NULL
JOIN neurons AS nb
  ON nb.id = s.neuron_b_id
 AND nb.user_id = s.user_id
 AND nb.sealed_at IS NULL
WHERE s.user_id = sqlc.arg(user_id)
  AND s.last_activated_universe_time < sqlc.arg(activated_before)::date
ORDER BY s.id;

-- Batch base-strength write for the Downscale renormalization ([C4]): values are computed by
-- the pure domain fn (the source of truth) and written absolutely — rows update in place,
-- nothing is inserted or deleted ([I1]).
-- name: ApplySynapseDownscale :exec
UPDATE synapses AS s
SET strength = downscaled.strength
FROM (
    SELECT
        UNNEST(sqlc.arg(synapse_ids)::text[]) AS id,
        UNNEST(sqlc.arg(strengths)::real[]) AS strength
) AS downscaled
WHERE s.user_id = sqlc.arg(user_id)
  AND s.id = downscaled.id;
