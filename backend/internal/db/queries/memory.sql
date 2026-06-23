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
-- (NULL → whole-diary body fallback), entry_date (for the temporal_bonus baseline),
-- and the fragment's affect (valence·intensity) for the link emotion-similarity term
-- (change 21). Each fragment embeds separately (spec 21).
SELECT m.user_id, COALESCE(m.fragment_text, r.body) AS text, r.entry_date, m.valence, m.intensity
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

-- name: ListArousalInputs :many
-- User-level "요즘" arousal inputs for the allocation gain (spec 25): the same raw
-- star fields the client uses for Bjork R. The domain computes arousal; SQL only
-- isolates the user's mutable star layer.
SELECT m.intensity, m.recall_count, m.last_recalled_at
FROM memories m
WHERE m.user_id = @user_id;

-- name: GetRecordByMemory :one
-- Read the immutable original for the recall panel (records JOIN). body/entry_date/
-- mood live on records; never mutated, never RETURNING * from memories (no body there).
-- spec 28: m.fragment_text rides along (별 → 조각) so the recall panel can show the
-- star's own fragment text; records.body stays the WHOLE original (원본 일기 전체 보기).
-- fragment_text is NULL for single-fragment / pre-21 stars → the handler emits "".
-- spec 54: derived_text = 최신 AI 내용 변형 텍스트(evolution_history content, version DESC). 변형이 없으면
-- NULL → 핸들러가 "" 방출(클라가 fragment_text/body 폴백). 원본 record.body는 불변(헌법1) — 병치용.
SELECT r.body, r.entry_date, r.mood, r.intensity, r.created_at, m.fragment_text,
       COALESCE(
         (SELECT eh.content FROM evolution_history eh
          WHERE eh.memory_id = m.id AND eh.content IS NOT NULL
          ORDER BY eh.version DESC LIMIT 1),
         '')::text AS derived_text
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
       m.record_id, m.fragment_index, m.recall_count, m.abstraction_stage,
       EXISTS (
           SELECT 1 FROM resonances res
           WHERE res.sender_memory_id = m.id OR res.recipient_memory_id = m.id
       ) AS resonant
FROM memories m
WHERE m.user_id = $1
ORDER BY m.created_at, m.fragment_index;

-- (spec 07) ListRecentForAmbient는 은퇴 — 서버 요즘-감정 종합(AggregateAmbient)을 제거하고
-- 클라가 로드된 별(+recall_count)의 Bjork 인출 강도 Σ R에서 감정 순위·arousal을 직접 파생한다.
-- (spec 38 change 19) ListStarVectorsByUser도 은퇴 — relevance(요즘 토픽 정합도)를 폐기했다(밝기=자기-거리).

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
       m.brightness_offset, m.hue_shift, m.form_seed_delta, m.version, m.recall_count, m.abstraction_stage
FROM memories m
WHERE m.user_id = $1
  AND m.last_recalled_at < sqlc.arg(cutoff)::timestamptz
ORDER BY m.last_recalled_at ASC;

-- name: GetReshapeContext :one
-- PE/strength inputs for one recalled star (spec 23): cumulative reshaping state,
-- a server-derived recall-context centroid from co-recalled neighbors, the star's
-- own embedding as the consolidated baseline, co-recall total, and created_at. If
-- no co-recall context exists, recall_embedding falls back to the star embedding
-- so isolated/no-context recalls stay a plain re-ignition.
SELECT m.version, m.brightness_offset, m.hue_shift, m.form_seed_delta,
       COALESCE((
           SELECT AVG(ne.embedding)
           FROM memory_links ml
           JOIN embeddings ne ON ne.memory_id = CASE WHEN ml.a_id = m.id THEN ml.b_id ELSE ml.a_id END
           WHERE ml.user_id = m.user_id
             AND (ml.a_id = m.id OR ml.b_id = m.id)
             AND ml.co_activation_count > 0
       ), e.embedding) AS recall_embedding,
       e.embedding AS consolidated_embedding,
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
-- spec 54: content rides along — 'ai_rewrite' 행은 변형 텍스트, 시각 reshape/gist 행은 NULL.
SELECT version, brightness, hue_shift, form_seed_delta, trigger, pe, dir, created_at, content
FROM evolution_history WHERE memory_id = @memory_id AND user_id = @user_id ORDER BY version ASC;

-- ── 재공고화 AI 내용 변형(spec 54) ──

-- name: GetMemoryForRewrite :one
-- 비동기 rewrite 워커 입력: 현재 표시 내용(최신 content → fragment_text → 원본 body 폴백), 추상화 단계
-- (변형 폭 구동), 현재 version, 소유자. 직전 변형 위에 다시 변형되도록 최신 content를 입력으로 준다("흐려지고 또
-- 흐려진다"). 원본 record.body는 폴백일 뿐 절대 수정되지 않는다(헌법1).
SELECT m.user_id, m.abstraction_stage,
  COALESCE(
    (SELECT eh.content FROM evolution_history eh
     WHERE eh.memory_id = m.id AND eh.content IS NOT NULL
     ORDER BY eh.version DESC LIMIT 1),
    m.fragment_text, r.body
  ) AS text
FROM memories m JOIN records r ON r.id = m.record_id
WHERE m.id = @id;

-- name: BumpVersionForRewrite :one
-- 변형 적용 1/2(가변 별 layer만 — 원본 record 불변, 헌법1): version++ 하고 그 시점 시각 상태를 RETURNING해
-- AppendRewriteEvolution이 같은 version의 변천사 행을 INSERT한다(둘이 한 tx → version·로그 정합). 시각 상태
-- (brightness/hue/form)는 안 바뀌고 스냅샷으로만 실린다(이 변형은 *내용*만 바꾼다).
UPDATE memories SET version = version + 1
WHERE id = @id AND user_id = @user_id
RETURNING version, brightness_offset, hue_shift, form_seed_delta;

-- name: AppendRewriteEvolution :exec
-- 변형 적용 2/2: 변형 텍스트 1행 append(INSERT 전용 — 헌법1·2). trigger='ai_rewrite', pe=0(예측오차 무관),
-- dir=-1(기억이 한 단계 흐려짐). content=변형 텍스트. 시각 필드는 BumpVersionForRewrite RETURNING 스냅샷.
INSERT INTO evolution_history (id, memory_id, user_id, version, brightness, hue_shift, form_seed_delta, trigger, pe, dir, content)
VALUES (@id, @memory_id, @user_id, @version, @brightness, @hue_shift, @form_seed_delta, 'ai_rewrite', 0, -1, @content);

-- ── 야간 공고화(spec 27) ──

-- name: ListStarsForConsolidate :many
-- 야간 패스 입력: 별 목록 + 반지름 근사 원자료(intensity·recall_count·last_recalled_at — change 18
-- Bjork R 공식)와 안정 좌표 캐시(stable_*, 있으면 다음 밤 force-sim 재진입 시드). 반지름은 재안정화/
-- 재분배 스코프와 요지화 단계 트리거에 쓰고, last_recalled_at은 R의 시간 항이다. 좌표는 권위 아님
-- (헌법3) — proto로 클라에 나가지 않는다. user_id = isolation.
SELECT m.id AS memory_id, m.last_recalled_at, m.intensity, m.recall_count,
       m.stable_x, m.stable_y, m.stable_z
FROM memories m
WHERE m.user_id = $1
ORDER BY m.created_at, m.fragment_index;

-- name: CacheStableCoords :exec
-- 야간 재안정화(①②) 결과 좌표 캐시(권위 아님 — 헌법3). UNNEST 배치 upsert, user_id 격리.
UPDATE memories AS m SET stable_x = c.x, stable_y = c.y, stable_z = c.z
FROM (SELECT unnest(@ids::text[]) AS id,
             unnest(@xs::float4[]) AS x, unnest(@ys::float4[]) AS y, unnest(@zs::float4[]) AS z) AS c
WHERE m.id = c.id AND m.user_id = @user_id;

-- name: AbstractStarsByRadius :many
-- 요지: 별의 추상화 단계를 그 별 반지름이 넘긴 임계 수(target_stage, 서버가 change 18 공식으로 산출)로
-- 올린다. abstraction_stage = GREATEST(현재, target)으로 단조(후퇴 금지·≤4), target_stage > 현재인 별만
-- 갱신(=실제 승급한 별만 RETURNING) → version++ 해 변천사 길이와 정합. 트리거가 나이/회상 → 반지름이라
-- 별도 dedupe 윈도가 필요 없다: GREATEST가 멱등이라 같은 밤 재실행이 target≤현재면 무변(승급 0행). 연속
-- form_seed_delta는 더는 안 건드린다(23 소유로 보존 — 형태는 plan 53이 abstraction_stage로 빚는다).
-- RETURNING으로 승급 행을 그대로 AppendGistHistory에 넘겨 memories ↔ evolution_history 정합 보장. 원본
-- record 불변(헌법1).
UPDATE memories AS m
SET abstraction_stage = GREATEST(m.abstraction_stage, t.stage),
    version = m.version + 1
FROM (SELECT unnest(@ids::text[]) AS id, unnest(@stages::int[]) AS stage) AS t
WHERE m.id = t.id AND m.user_id = @user_id
  AND t.stage > m.abstraction_stage
RETURNING m.id AS memory_id, m.version, m.brightness_offset, m.hue_shift, m.form_seed_delta;

-- name: AppendGistHistory :exec
-- 요지 변천사 append(INSERT 전용 — UPDATE/DELETE 금지, 헌법1·2). trigger='nightly_gist',
-- pe=0(시간 기반·예측오차 무관), dir=-1(형태가 한 단계 가라앉음). AbstractStarsByRadius의 RETURNING
-- 값(version·brightness_offset 스냅샷·hue_shift·form_seed_delta)을 그대로 싣는다 — form_seed_delta는
-- 안 바뀌지만 그 버전 시점 스냅샷으로 24 타임랩스 정합을 유지한다.
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

-- name: ListReknnCandidates :many
-- 재-KNN 패스 입력: 오래됐고(created_at < age_cutoff) 건강한 링크가 하나도 없는(고립이거나 가지치기로
-- 끊긴) 별 + 임베딩. "건강한 링크"는 severed=false 이고 weight ≥ active_threshold 인 행. 워커가 각 별의
-- 임베딩으로 KnnNearest를 다시 돌려 그새 생긴 닮은 기억과 뒤늦게 잇는다(가지치기·끊김의 짝 — 재연결 안전망).
-- 임베딩 없는 별은 JOIN으로 자연 제외. user_id = isolation.
SELECT m.id AS memory_id, e.embedding
FROM memories m
JOIN embeddings e ON e.memory_id = m.id
WHERE m.user_id = @user_id
  AND m.created_at < sqlc.arg(age_cutoff)::timestamptz
  AND NOT EXISTS (
    SELECT 1 FROM memory_links ml
    WHERE ml.user_id = m.user_id AND (ml.a_id = m.id OR ml.b_id = m.id)
      AND ml.severed = false AND ml.weight >= sqlc.arg(active_threshold)::float4
  );
