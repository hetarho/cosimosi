-- records is immutable (constitution §1): there are deliberately NO UPDATE or
-- DELETE queries here. Order matters — record → memory → job — because
-- memories.record_id is a NOT NULL FK to records.id.
-- Since spec 21 the relation is 1 record → N fragment memories (record_id is a
-- non-unique FK); per-fragment mood/intensity/valence live on memories.

-- name: FindRecordByIdempotencyKey :one
-- Idempotency: return the existing record id for a (user_id, idempotency_key)
-- pair. Fragment memory ids (possibly none yet — extract is async) are listed
-- separately via ListMemoryIDsByRecord.
SELECT r.id
FROM records r
WHERE r.user_id = $1 AND r.idempotency_key = $2;

-- name: ListMemoryIDsByRecord :many
-- All fragment stars born from one record, in fragment order. Used by the
-- idempotent RecordMemory replay and the extract worker's already-fanned-out check.
SELECT id
FROM memories
WHERE record_id = $1
ORDER BY fragment_index;

-- name: InsertRecord :exec
-- The immutable original. No memory_id column (the star points to the record, not
-- the reverse). mood/intensity/valence are optional whole-diary user hints
-- (spec 21 — the AI detects per-fragment emotion); idempotency_key is nullable.
INSERT INTO records (id, user_id, body, entry_date, mood, intensity, valence, idempotency_key)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8);

-- name: InsertMemory :one
-- One fragment star (spec 21): record_id (non-unique FK) links back to the
-- original; the fragment's own emotion and text live HERE on the mutable star
-- layer (never on the immutable record).
INSERT INTO memories (id, user_id, record_id, mood, intensity, fragment_index, fragment_text, valence)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id;

-- name: GetRecordForExtract :one
-- Loads what the extract worker needs: the immutable body to segment, the owner,
-- entry_date, and the optional manual-emotion hints (fallback when extraction
-- degrades to a single neutral segment).
SELECT r.user_id, r.body, r.entry_date, r.mood, r.intensity, r.valence
FROM records r
WHERE r.id = $1;

-- name: GetMemoryForEmbed :one
-- Loads what the embedding worker needs: the star's owner, the FRAGMENT text
-- (NULL → whole-diary body fallback), and entry_date (for the temporal_bonus
-- baseline). Each fragment embeds separately (spec 21).
SELECT m.user_id, COALESCE(m.fragment_text, r.body) AS text, r.entry_date
FROM memories m
JOIN records r ON r.id = m.record_id
WHERE m.id = $1;

-- name: RecallMemoryTouch :exec
-- Re-ignite a star on recall: last_recalled_at = now() AND recall_count += 1 (spec 07 —
-- the cumulative Bjork storage-strength signal). The star is mutable; the original record
-- is NOT (constitution §1). No RETURNING.
UPDATE memories SET last_recalled_at = now(), recall_count = recall_count + 1
WHERE id = @id AND user_id = @user_id;

-- name: ListLastRecalled :many
-- The candidate stars' last_recalled_at (spec 22): the per-star excitability event
-- feeding e(c,t). Derived from the existing timestamp — no excitability column
-- (acceptance 1.5, single source). user_id = isolation.
SELECT m.id, m.last_recalled_at FROM memories m
WHERE m.user_id = @user_id AND m.id = ANY(@ids::text[]);

-- name: GetRecordByMemory :one
-- Read the immutable original for the recall panel (records JOIN). body/entry_date/
-- mood live on records; never mutated, never RETURNING * from memories (no body there).
-- spec 28: m.fragment_text rides along (별 → 조각) so the recall panel can show the
-- star's own fragment text; records.body stays the WHOLE original (원본 일기 전체 보기).
-- fragment_text is NULL for single-fragment / pre-21 stars → the handler emits "".
SELECT r.body, r.entry_date, r.mood, r.intensity, r.created_at, m.fragment_text
FROM memories m
JOIN records r ON r.id = m.record_id
WHERE m.id = @id AND m.user_id = @user_id;

-- name: ListRecords :many
-- 원본 일기로 별 찾기(spec 28) 진입 목록: 호출 user의 원본 일기 + 일기별 조각 별 개수.
-- records는 읽기만(헌법1 — UPDATE/DELETE 없음). body는 전체가 아니라 excerpt(left 80)만
-- 보낸다(원본 전체는 RecallMemory/GetRecord). entry_date 내림차순(최근 일기 먼저). user_id = 격리.
-- change 09: moods — 그 일기 조각 별들의 감정 facet(중복 제거, NULL 제거). array_agg(DISTINCT)로
-- 한 일기의 여러 조각이 같은 감정을 가져도 한 번만 나오게 한다(일기 목록 감정 필터 입력).
SELECT r.id AS record_id, r.entry_date, left(r.body, 80) AS body_excerpt, count(m.id)::int AS star_count,
       array_remove(array_agg(DISTINCT m.mood), NULL)::text[] AS moods
FROM records r JOIN memories m ON m.record_id = r.id
WHERE r.user_id = $1
GROUP BY r.id, r.entry_date, r.body
ORDER BY r.entry_date DESC;

-- name: GetRecordByRecord :one
-- 원본 일기 읽기(spec 28, change 09): record_id로 원본 전문을 읽는다 — 부작용 없음(별 layer를
-- 절대 건드리지 않음: RecallMemoryTouch 없음). user_id 가드라 남의 record면 ErrNoRows → NotFound.
-- records는 읽기만(헌법1). fragment_text 같은 별 컬럼은 없다 — 독립 일기 페이지는 원본 전체만 본다.
SELECT r.body, r.entry_date, r.mood, r.intensity, r.created_at
FROM records r
WHERE r.id = @id AND r.user_id = @user_id;

-- name: ListMemoriesByUser :many
-- Every star for the user, dormant included (no brightness filter — constitution
-- §2). mood/intensity/valence are the FRAGMENT's own (memories, spec 21) — no
-- records JOIN anymore. The reshaping state (spec 23) rides the same row.
-- spec 28: record_id/fragment_index ride along so the client can GROUP stars by
-- their original diary (일기 단위 조망/하이라이팅) without a separate query.
-- spec 36: resonant — 이 별이 공명(다른 우주의 별)으로 이어져 있는지(보낸 별·수락으로 태어난
-- 별 양쪽). resonances의 어느 끝점이든 이 별이면 true → 클라가 은은한 공명 마커를 그린다.
SELECT m.id AS memory_id, m.mood, m.intensity, m.valence, m.last_recalled_at,
       m.brightness_offset, m.hue_shift, m.form_seed_delta, m.version,
       m.record_id, m.fragment_index, m.recall_count,
       EXISTS (
           SELECT 1 FROM resonances res
           WHERE res.sender_memory_id = m.id OR res.recipient_memory_id = m.id
       ) AS resonant
FROM memories m
WHERE m.user_id = $1
ORDER BY m.created_at, m.fragment_index;

-- (spec 07) ListRecentForAmbient는 은퇴 — 서버 요즘-감정 종합(AggregateAmbient)을 제거하고
-- 클라가 로드된 별(+recall_count)의 Bjork 인출 강도 Σ R에서 감정 순위·arousal을 직접 파생한다.

-- name: ListStarVectorsByUser :many
-- 관련성 가중 망각(spec 26) 입력: 모든 별의 의미 임베딩 + 최근성·강도 가중치. 서버가
-- "요즘 토픽 중심 벡터"(최근 별 임베딩 시간가중 평균)를 만들고 별마다 cos 정합도를 계산해
-- GetUniverse에 relevance로 싣는다. LEFT JOIN이라 임베딩이 아직 없는 별(embed 잡 대기 중)도
-- NULL 임베딩으로 함께 나온다 → relevance 0(중립). 감쇠/cos 수식은 도메인(RelevanceByStar)에서
-- 하고 SQL엔 넣지 않는다(12·25와 같은 패턴). user_id = isolation.
SELECT m.id AS memory_id, m.intensity, m.last_recalled_at, e.embedding
FROM memories m
LEFT JOIN embeddings e ON e.memory_id = m.id
WHERE m.user_id = $1;

-- name: ListDormant :many
-- Long-unrecalled (dormant) stars for search/explorer surfaces. A search aid,
-- NOT a delete/filter — GetUniverse still returns the full graph (constitution §2). The WHERE
-- compares only the last_recalled_at time cutoff (sargable; NO exp()/decay math in SQL —
-- brightness is computed client-side from this same value). The service converts the
-- dormancy threshold into `cutoff`. mood/intensity/valence are the fragment's own
-- (memories, spec 21; no body sent — the dormant list renders Star; the original is
-- fetched on recall, spec 11). Same column shape as ListMemoriesByUser so it maps to
-- the same domain Memory (reshaping state included, spec 23).
SELECT m.id AS memory_id, m.mood, m.intensity, m.valence, m.last_recalled_at,
       m.brightness_offset, m.hue_shift, m.form_seed_delta, m.version, m.recall_count
FROM memories m
WHERE m.user_id = $1
  AND m.last_recalled_at < sqlc.arg(cutoff)::timestamptz
ORDER BY m.last_recalled_at ASC;

-- name: GetReshapeContext :one
-- PE/strength inputs for one recalled star (spec 23): the cumulative reshaping
-- state + version, the star's embedding (PE = 1-cos(recall_ctx, last_consolidated);
-- embeddings filled by 03/05), the co-recall total (strength = how consolidated),
-- and created_at (age term). Star-only read — never touches the immutable record.
SELECT m.version, m.brightness_offset, m.hue_shift, m.form_seed_delta,
       e.embedding,
       COALESCE((SELECT SUM(ml.co_activation_count) FROM memory_links ml
                 WHERE (ml.a_id = m.id OR ml.b_id = m.id) AND ml.user_id = m.user_id), 0)::int AS co_recall_total,
       m.created_at
FROM memories m JOIN embeddings e ON e.memory_id = m.id
WHERE m.id = @id AND m.user_id = @user_id;

-- name: ListDirectNeighbors :many
-- 1-hop direct neighbors over memory_links (spec 23, content-limited scope): only
-- the recalled star + these are reshaped; indirect neighbors stay untouched.
SELECT (CASE WHEN ml.a_id = @id THEN ml.b_id ELSE ml.a_id END)::text AS neighbor_id
FROM memory_links ml
WHERE ml.user_id = @user_id AND (ml.a_id = @id OR ml.b_id = @id);

-- name: ApplyReshape :exec
-- Reshape one mutable star (spec 23): only memories changes, version++ — the
-- original record is NEVER touched (constitution §1, grep: no UPDATE records).
UPDATE memories
SET brightness_offset = @brightness_offset, hue_shift = @hue_shift,
    form_seed_delta = @form_seed_delta, version = version + 1
WHERE id = @id AND user_id = @user_id;

-- name: AppendEvolution :exec
-- One append-only variant row (spec 23): INSERT only — never UPDATE/DELETE an
-- existing evolution_history row (constitution §1·§2).
INSERT INTO evolution_history (id, memory_id, user_id, version, brightness, hue_shift, form_seed_delta, trigger, pe, dir)
VALUES (@id, @memory_id, @user_id, @version, @brightness, @hue_shift, @form_seed_delta, @trigger, @pe, @dir);

-- name: GetEvolutionHistory :many
-- A star's variant log, version ascending (spec 23; UI is spec 24). user_id = isolation.
SELECT version, brightness, hue_shift, form_seed_delta, trigger, pe, dir, created_at
FROM evolution_history WHERE memory_id = @memory_id AND user_id = @user_id ORDER BY version ASC;

-- ── 야간 공고화(spec 27) ──

-- name: ListStarsForConsolidate :many
-- ①② 입력: 야간 재안정화/재분배가 쓰는 별 목록 + 안정 좌표 캐시(있으면 다음 밤 force-sim
-- 시드). last_recalled_at은 흥분성·재분배 가중(22 파생)에, stable_*는 재진입 시드에 쓴다.
-- 좌표는 권위 아님(헌법3) — proto로 클라에 나가지 않는다. user_id = isolation.
SELECT m.id AS memory_id, m.last_recalled_at, m.stable_x, m.stable_y, m.stable_z
FROM memories m
WHERE m.user_id = $1
ORDER BY m.created_at, m.fragment_index;

-- name: CacheStableCoords :exec
-- 야간 재안정화(①②) 결과 좌표 캐시(권위 아님 — 헌법3). UNNEST 배치 upsert, user_id 격리.
UPDATE memories AS m SET stable_x = c.x, stable_y = c.y, stable_z = c.z
FROM (SELECT unnest(@ids::text[]) AS id,
             unnest(@xs::float4[]) AS x, unnest(@ys::float4[]) AS y, unnest(@zs::float4[]) AS z) AS c
WHERE m.id = c.id AND m.user_id = @user_id;

-- name: GistSimplifyStars :many
-- ③ 요지: 오래되고(created_at < age_cutoff) 저회상인(last_recalled_at < recall_cutoff) 별의
-- form_seed_delta를 단조 증가(GREATEST — 후퇴 금지, LEAST로 1.0 상한). 이미 1.0이면 제외
-- (여유 있는 별만 — 무변 스냅샷 방지). version++ 해 변천사 길이와 정합. WHERE는 시각·값 비교만
-- (exp()/감쇠식 금지 — sargable). RETURNING으로 갱신된 행을 그대로 AppendGistHistory에 넘겨
-- memories ↔ evolution_history 정합을 보장(스냅샷 의존·레이스 없음). 원본 record 불변(헌법1).
-- 최근(idle_cutoff~지금) nightly_gist 변천사가 이미 있는 별은 제외 — 이번 잡이 RunConsolidation
-- 트랜잭션으로 한 시도 안에선 원자적이지만, 잡 lease 만료로 재claim돼 *다시* 돌면(거대 그래프·
-- 다중 워커) 같은 밤 form_seed_delta가 두 번 진행될 수 있다. 직전 nightly_gist append를 보고
-- 건너뛰어 야간 1회 멱등을 보장한다(첫 시도의 history가 커밋돼 있으므로 재실행은 무변).
UPDATE memories
SET form_seed_delta = GREATEST(memories.form_seed_delta, LEAST(1.0::real, memories.form_seed_delta + sqlc.arg(simplify)::float4)),
    version = memories.version + 1
WHERE memories.user_id = @user_id
  AND memories.created_at < sqlc.arg(age_cutoff)::timestamptz
  AND memories.last_recalled_at < sqlc.arg(recall_cutoff)::timestamptz
  AND memories.form_seed_delta < 1.0
  AND NOT EXISTS (
    SELECT 1 FROM evolution_history eh
    WHERE eh.memory_id = memories.id AND eh.user_id = memories.user_id
      AND eh.trigger = 'nightly_gist'
      AND eh.created_at > sqlc.arg(gist_dedupe_cutoff)::timestamptz
  )
RETURNING memories.id AS memory_id, memories.version, memories.brightness_offset, memories.hue_shift, memories.form_seed_delta;

-- name: AppendGistHistory :exec
-- ③ 요지 변천사 append(INSERT 전용 — UPDATE/DELETE 금지, 헌법1·2). trigger='nightly_gist',
-- pe=0(시간 기반·예측오차 무관), dir=-1(형태가 한 단계 가라앉음). GistSimplifyStars의 RETURNING
-- 값(version·brightness_offset 스냅샷·hue_shift·새 form_seed_delta)을 그대로 싣는다.
INSERT INTO evolution_history (id, memory_id, user_id, version, brightness, hue_shift, form_seed_delta, trigger, pe, dir)
SELECT g.id, g.memory_id, @user_id, g.version, g.brightness, g.hue_shift, g.form_seed_delta, 'nightly_gist', 0, -1
FROM (
    SELECT unnest(@ids::text[]) AS id,
           unnest(@memory_ids::text[]) AS memory_id,
           unnest(@versions::int[]) AS version,
           unnest(@brightnesses::float4[]) AS brightness,
           unnest(@hue_shifts::float4[]) AS hue_shift,
           unnest(@form_seed_deltas::float4[]) AS form_seed_delta
) AS g;
