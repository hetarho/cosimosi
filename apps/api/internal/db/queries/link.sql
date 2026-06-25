-- name: ListLinksByUser :many
-- Every synapse for the user, dormant included (no weight filter — constitution
-- §2). Scoped by memory_links.user_id.
SELECT ml.a_id, ml.b_id, ml.weight, ml.link_type, ml.co_activation_count, ml.last_activated_at
FROM memory_links ml
WHERE ml.user_id = $1;

-- name: ListLinksForConsolidate :many
-- 야간 패스 입력(spec 27): 재안정화 스프링·성단 도출·재가중·가지치기·반지름 연결성에 쓰는 전체 시냅스.
-- ListLinksByUser와 달리 link_type(재가중 분류)과 severed(끊김 상태·재-KNN 되살림 대상)를 함께 싣는다.
-- 삭제 없음(헌법2)이라 잠든/끊긴 선 포함 전체를 weight 필터 없이 반환. user_id = isolation.
SELECT ml.a_id, ml.b_id, ml.weight, ml.link_type, ml.severed, ml.last_activated_at
FROM memory_links ml
WHERE ml.user_id = $1;

-- name: BatchUpsertLinks :exec
-- Initial semantic synapses from the embedding worker, one statement via
-- UNNEST, with link_type literal 'semantic' (memory_links.link_type is NOT
-- NULL, no default). On conflict we keep the stronger weight (GREATEST) so
-- re-running a job never weakens an existing link; co-recall reinforcement is
-- handled by ReinforceLinks.
--
-- IMPORTANT: the (a_id, b_id) pair is normalized HERE with LEAST/GREATEST, not by
-- the caller, so ordering uses the SAME database collation (en_US.utf8) as the
-- a_id<b_id CHECK and the (a_id,b_id) PK. The ids are mixed-case base64url; a Go
-- byte-order swap disagrees with the locale collation (e.g. 'Zx' < 'aB' is true
-- in Go but false in Postgres) and would violate the CHECK — so the DB decides.
INSERT INTO memory_links (a_id, b_id, weight, user_id, link_type)
SELECT LEAST(a, b), GREATEST(a, b), w, u, 'semantic'
FROM (
    SELECT
        unnest(@a_ids::text[])     AS a,
        unnest(@b_ids::text[])     AS b,
        unnest(@weights::float8[]) AS w,
        unnest(@user_ids::text[])  AS u
) AS pairs
ON CONFLICT (a_id, b_id) DO UPDATE
SET weight = GREATEST(memory_links.weight, EXCLUDED.weight);

-- name: BatchUpsertIntraEntryLinks :exec
-- Within-event binding (spec 21): fragments of the SAME diary entry are bound
-- with a strong fixed weight (the caller passes values.ConnectionIntraEntryWeight =
-- spec/values.yaml connection.intra_entry_weight, kept always above the capped
-- cross-entry semantic links). a<b is normalized HERE with LEAST/GREATEST under the
-- DB collation (same reasoning as BatchUpsertLinks above). GREATEST on conflict keeps
-- a re-run from weakening anything.
INSERT INTO memory_links (a_id, b_id, weight, user_id, link_type)
SELECT LEAST(a, b), GREATEST(a, b), sqlc.arg(weight)::float4, u, 'intra_entry'
FROM (
    SELECT
        unnest(@a_ids::text[])    AS a,
        unnest(@b_ids::text[])    AS b,
        unnest(@user_ids::text[]) AS u
) AS pairs
ON CONFLICT (a_id, b_id) DO UPDATE
SET weight = GREATEST(memory_links.weight, EXCLUDED.weight);

-- name: ReinforceLinks :exec
-- Co-recall (Hebbian) reinforcement: apply per-pair
-- INCREMENTAL deltas. New row → weight=LEAST(1.0, delta), link_type='co_recall';
-- existing → weight=LEAST(1.0, weight+delta), co_activation_count++,
-- last_activated_at=now. The cap is on BOTH branches: a single batch's summed delta
-- for a pair can exceed 1.0 (the client accumulates uncapped), so a first-ever link
-- must clamp too — weight is a 0..1 invariant, not just on conflict.
-- a_id<b_id is normalized HERE with LEAST/GREATEST under the DB collation (matches
-- the a_id<b_id CHECK / PK — a Go byte-order swap would disagree with en_US.utf8).
INSERT INTO memory_links (a_id, b_id, user_id, weight, link_type, co_activation_count, last_activated_at, created_at)
SELECT LEAST(a, b), GREATEST(a, b), @user_id, LEAST(1.0, d), 'co_recall', 1, now(), now()
FROM (
    SELECT
        unnest(@a_ids::text[])    AS a,
        unnest(@b_ids::text[])    AS b,
        unnest(@deltas::float8[]) AS d
) AS pairs
ON CONFLICT (a_id, b_id) DO UPDATE
SET weight              = LEAST(1.0, memory_links.weight + EXCLUDED.weight),
    co_activation_count = memory_links.co_activation_count + 1,
    last_activated_at   = now();

-- name: ListLinksForCluster :many
-- Synapses touching any of the candidate stars (spec 22): the server derives clusters
-- as connected components over these edges (union-find), with no cluster column — the
-- weak semantic-graph clustering that competitive allocation biases toward. Returns the
-- 1-hop endpoints + last_activated_at (an excitability event). user_id = isolation.
SELECT ml.a_id, ml.b_id, ml.last_activated_at
FROM memory_links ml
WHERE ml.user_id = @user_id
  AND (ml.a_id = ANY(@ids::text[]) OR ml.b_id = ANY(@ids::text[]));

-- name: ReweightLinks :exec
-- 야간 링크 재가중(spec 27 change 20): 시간 기반 연결은 약화, 의미 기반 연결은 강화. 과학 — 시간창
-- (그때 같이 썼다)은 짧고 의미·도식 연결이 장기 보존된다. temporal 계열(같은-사건 결속 'intra_entry' +
-- 정의만 있는 'temporal')은 weight × temporal_decay(<1)로 매일 조금씩 약화하고, 'semantic'은
-- weight + semantic_gain 으로 semantic_cap까지 강화한다. 'co_recall'(능동 공동회상 헵)은 사용으로
-- 강화되는 별개 신호라 건드리지 않는다. 절대 음수 없음(GREATEST 0). user_id = isolation.
UPDATE memory_links
SET weight = CASE
    WHEN link_type IN ('intra_entry', 'temporal') THEN GREATEST(0, weight * sqlc.arg(temporal_decay)::float4)
    WHEN link_type = 'semantic' THEN LEAST(sqlc.arg(semantic_cap)::float4, weight + sqlc.arg(semantic_gain)::float4)
    ELSE weight END
WHERE user_id = @user_id
  AND severed = false
  AND link_type IN ('intra_entry', 'temporal', 'semantic');

-- name: PruneWeakLinks :exec
-- 야간 가지치기 + 마지막 1링크 보호(spec 27 change 20): 약하고(weight < weak_threshold) 안 쓰인
-- (last_activated_at < idle_cutoff) 선의 weight를 바닥으로(LEAST) 낮추고 severed=true로 끊은 듯 처리한다.
-- 단 **별마다 살아있는 가장 강한 링크 1개는 보호**(degree ≥ 1 — 완전 고립 금지): 보호·가지치기 모두
-- 이미 끊긴(severed) 행은 빼고 **미severed 링크만** 본다 — 안 그러면 이미 끊긴 최강 행이 보호되어
-- 노드의 마지막 *살아있는* 링크가 끊길 수 있다(degree 0). 각 노드 관점 weight 최강(동률은 a_id,b_id
-- 결정론적 tie-break)이 어느 한쪽 끝에서라도 1순위면 제외한다. 삭제(DELETE) 없음 — 행은 남고 클릭
-- 가능, severed는 재-KNN이 닮은 기억을 다시 찾으면 되살린다(헌법2). WHERE는 비교만(sargable).
WITH incident AS (
    SELECT a_id AS node, a_id, b_id, weight FROM memory_links WHERE user_id = @user_id AND severed = false
    UNION ALL
    SELECT b_id AS node, a_id, b_id, weight FROM memory_links WHERE user_id = @user_id AND severed = false
),
ranked AS (
    SELECT node, a_id, b_id,
           row_number() OVER (PARTITION BY node ORDER BY weight DESC, a_id, b_id) AS rn
    FROM incident
),
protected AS (
    SELECT DISTINCT a_id, b_id FROM ranked WHERE rn = 1
)
UPDATE memory_links ml
SET weight = LEAST(ml.weight, sqlc.arg(floor)::float4), severed = true
WHERE ml.user_id = @user_id
  AND ml.severed = false
  AND ml.weight < sqlc.arg(weak_threshold)::float4
  AND ml.last_activated_at < sqlc.arg(idle_cutoff)::timestamptz
  AND NOT EXISTS (SELECT 1 FROM protected p WHERE p.a_id = ml.a_id AND p.b_id = ml.b_id);

-- name: ReknnUpsertLinks :exec
-- 재-KNN 재연결(spec 27 change 20): 고립/끊긴 옛 별이 의미 KNN으로 다시 찾은 닮은 기억과 잇는다. 신규
-- 행은 link_type='semantic', severed=false, last_activated_at=now. 기존 행은 weight=GREATEST(약화시키지
-- 않음)·severed=false로 **되살린다**(끊겼던 선이 닮은 기억 재발견으로 부활). a_id<b_id는 BatchUpsertLinks와
-- 같은 이유로 DB 콜레이션 LEAST/GREATEST로 정규화(Go 바이트 순서 스왑 금지). 삭제 없음(헌법2).
INSERT INTO memory_links (a_id, b_id, weight, user_id, link_type, severed, last_activated_at)
SELECT LEAST(a, b), GREATEST(a, b), w, u, 'semantic', false, now()
FROM (
    SELECT
        unnest(@a_ids::text[])     AS a,
        unnest(@b_ids::text[])     AS b,
        unnest(@weights::float8[]) AS w,
        unnest(@user_ids::text[])  AS u
) AS pairs
ON CONFLICT (a_id, b_id) DO UPDATE
SET weight = GREATEST(memory_links.weight, EXCLUDED.weight), severed = false;

-- name: ClaimBatch :execrows
-- Idempotency CLAIM: insert the batch_id row FIRST, inside the
-- reinforce tx. Returns 1 if THIS tx claimed the batch (proceed with the upsert), 0 if
-- it was already processed (skip). Because the insert runs before the upsert, the
-- batch_id PK holds a lock for the whole tx, so a concurrent duplicate batch_id BLOCKS
-- here until the first tx commits, then sees the conflict and gets 0 — true
-- serialization (a check-then-act EXISTS guard would let both pass and double-count).
INSERT INTO processed_batches (batch_id, user_id)
VALUES (@batch_id, @user_id)
ON CONFLICT (batch_id) DO NOTHING;
