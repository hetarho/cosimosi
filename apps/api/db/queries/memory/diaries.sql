-- Diary-reader archive reads are SELECT-only: the reader never mutates a Diary ([I2]).
-- Every statement is scoped to the authenticated user ([U1], §4, lint:persistence).

-- Separate static queries keep chronological direction inside persistence-isolation lint's SQL surface.
-- name: ListDiariesPageDesc :many
SELECT
    d.id,
    d.body,
    d.diary_date
FROM diaries AS d
WHERE d.user_id = sqlc.arg(user_id)
  AND (
    sqlc.narg(cursor_date)::date IS NULL
    OR (d.diary_date, d.id) < (sqlc.narg(cursor_date)::date, sqlc.narg(cursor_id)::text)
  )
  AND (sqlc.narg(from_date)::date IS NULL OR d.diary_date >= sqlc.narg(from_date)::date)
  AND (sqlc.narg(to_date)::date IS NULL OR d.diary_date <= sqlc.narg(to_date)::date)
  AND (sqlc.narg(keyword)::text IS NULL OR d.body ILIKE '%' || sqlc.narg(keyword)::text || '%')
  AND (
    cardinality(sqlc.arg(moods)::text[]) = 0
    OR EXISTS (
      SELECT 1
      FROM episodic_memories AS em
      WHERE em.user_id = sqlc.arg(user_id)
        AND em.diary_id = d.id
        AND em.deleted_at IS NULL
        AND em.mood = ANY(sqlc.arg(moods)::text[])
    )
  )
  AND (
    sqlc.narg(min_memories)::int IS NULL
    OR (
      SELECT count(*)
      FROM episodic_memories AS em_min
      WHERE em_min.user_id = sqlc.arg(user_id)
        AND em_min.diary_id = d.id
        AND em_min.deleted_at IS NULL
    ) >= sqlc.narg(min_memories)::int
  )
  AND (
    sqlc.narg(max_memories)::int IS NULL
    OR (
      SELECT count(*)
      FROM episodic_memories AS em_max
      WHERE em_max.user_id = sqlc.arg(user_id)
        AND em_max.diary_id = d.id
        AND em_max.deleted_at IS NULL
    ) <= sqlc.narg(max_memories)::int
  )
  AND NOT EXISTS (
    SELECT 1
    FROM release_groups AS rg
    WHERE rg.user_id = sqlc.arg(user_id)
      AND rg.diary_id = d.id
  )
ORDER BY d.diary_date DESC, d.id DESC
LIMIT sqlc.arg(page_limit);

-- name: ListDiariesPageAsc :many
SELECT
    d.id,
    d.body,
    d.diary_date
FROM diaries AS d
WHERE d.user_id = sqlc.arg(user_id)
  AND (
    sqlc.narg(cursor_date)::date IS NULL
    OR (d.diary_date, d.id) > (sqlc.narg(cursor_date)::date, sqlc.narg(cursor_id)::text)
  )
  AND (sqlc.narg(from_date)::date IS NULL OR d.diary_date >= sqlc.narg(from_date)::date)
  AND (sqlc.narg(to_date)::date IS NULL OR d.diary_date <= sqlc.narg(to_date)::date)
  AND (sqlc.narg(keyword)::text IS NULL OR d.body ILIKE '%' || sqlc.narg(keyword)::text || '%')
  AND (
    cardinality(sqlc.arg(moods)::text[]) = 0
    OR EXISTS (
      SELECT 1
      FROM episodic_memories AS em
      WHERE em.user_id = sqlc.arg(user_id)
        AND em.diary_id = d.id
        AND em.deleted_at IS NULL
        AND em.mood = ANY(sqlc.arg(moods)::text[])
    )
  )
  AND (
    sqlc.narg(min_memories)::int IS NULL
    OR (
      SELECT count(*)
      FROM episodic_memories AS em_min
      WHERE em_min.user_id = sqlc.arg(user_id)
        AND em_min.diary_id = d.id
        AND em_min.deleted_at IS NULL
    ) >= sqlc.narg(min_memories)::int
  )
  AND (
    sqlc.narg(max_memories)::int IS NULL
    OR (
      SELECT count(*)
      FROM episodic_memories AS em_max
      WHERE em_max.user_id = sqlc.arg(user_id)
        AND em_max.diary_id = d.id
        AND em_max.deleted_at IS NULL
    ) <= sqlc.narg(max_memories)::int
  )
  AND NOT EXISTS (
    SELECT 1
    FROM release_groups AS rg
    WHERE rg.user_id = sqlc.arg(user_id)
      AND rg.diary_id = d.id
  )
ORDER BY d.diary_date ASC, d.id ASC
LIMIT sqlc.arg(page_limit);

-- The split membership ([D3]) for a page's diaries in one read: each diary's still-live episodic
-- memories (deleted_at IS NULL — soft-deleted excluded, so an all-let-go diary yields zero refs).
-- created_universe_time is carried so the use-case can surface the diary's launch universe-time (all a
-- diary's memories share it); name + mood drive the chips (mood → color client-side [I3]). No
-- current_text or derived value crosses ([I5]).
-- name: ListDiarySplitRefs :many
SELECT
    diary_id,
    id,
    name,
    mood,
    created_universe_time
FROM episodic_memories
WHERE user_id = sqlc.arg(user_id)
  AND diary_id = ANY(sqlc.arg(diary_ids)::text[])
  AND deleted_at IS NULL
ORDER BY diary_id, created_universe_time, id;

-- Calendar pagination is day-grained, so multiple diaries written on one day never split across pages.
-- name: ListDiaryDaysInWindow :many
SELECT DISTINCT d.diary_date
FROM diaries AS d
WHERE d.user_id = sqlc.arg(user_id)
  AND d.diary_date >= sqlc.arg(from_date)::date
  AND d.diary_date <= sqlc.arg(to_date)::date
  AND (
    sqlc.narg(cursor_date)::date IS NULL
    OR d.diary_date > sqlc.narg(cursor_date)::date
  )
  AND NOT EXISTS (
    SELECT 1
    FROM release_groups AS rg
    WHERE rg.user_id = sqlc.arg(user_id)
      AND rg.diary_id = d.id
  )
ORDER BY d.diary_date ASC
LIMIT sqlc.arg(page_limit)::int + 1;

-- The EffectiveStrength formula stays in the domain; SQL returns only its stored inputs.
-- name: ListDiaryDayMoodInputs :many
SELECT
    d.diary_date,
    em.mood,
    em.base_strength,
    em.recall_count
FROM diaries AS d
JOIN episodic_memories AS em
  ON em.user_id = sqlc.arg(user_id)
 AND em.diary_id = d.id
 AND em.deleted_at IS NULL
WHERE d.user_id = sqlc.arg(user_id)
  AND d.diary_date = ANY(sqlc.arg(diary_dates)::date[])
  AND NOT EXISTS (
    SELECT 1
    FROM release_groups AS rg
    WHERE rg.user_id = sqlc.arg(user_id)
      AND rg.diary_id = d.id
  );
