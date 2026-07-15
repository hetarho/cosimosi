-- Diary-reader archive reads (plan 47, Epic G). SELECTs only: the reader never mutates a Diary ([I2]).
-- Every statement is scoped to the authenticated user ([U1], §4, lint:persistence).

-- One reverse-chronological page of the user's immutable diaries ([D2]), keyset-paginated on
-- (diary_date, id) so a growing archive stays stable under new writes. A null cursor starts at the
-- newest entry; otherwise the page continues strictly before the cursor tuple. The use-case fetches
-- one extra row (page_limit = page_size + 1) to decide whether a next page exists. diaries has no
-- deleted_at — the Diary is never soft-deleted, so a memory-less past-dated diary still lists ([I1]).
-- name: ListDiariesPage :many
SELECT
    id,
    body,
    diary_date
FROM diaries
WHERE user_id = sqlc.arg(user_id)
  AND (
    sqlc.narg(cursor_date)::date IS NULL
    OR (diary_date, id) < (sqlc.narg(cursor_date)::date, sqlc.narg(cursor_id)::text)
  )
ORDER BY diary_date DESC, id DESC
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
