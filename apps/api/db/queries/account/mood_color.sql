-- Per-user color rows and their aggregate-only recommendation projection.

-- name: ListMoodColors :many
SELECT mood, color
FROM mood_colors
WHERE user_id = sqlc.arg(user_id)
ORDER BY mood;

-- Serializes the first write as well as updates for one user/mood pair. A row lock alone
-- cannot protect an absent mood_colors row from concurrent aggregate increments.
-- name: LockMoodColorWrite :exec
SELECT pg_advisory_xact_lock(
    hashtextextended(sqlc.arg(user_id)::text || ':' || sqlc.arg(mood)::text, 0)
);

-- name: GetMoodColorForUpdate :one
SELECT mood, color
FROM mood_colors
WHERE user_id = sqlc.arg(user_id)
  AND mood = sqlc.arg(mood)
FOR UPDATE;

-- name: UpsertMoodColor :one
INSERT INTO mood_colors (user_id, mood, color, updated_at)
VALUES (sqlc.arg(user_id), sqlc.arg(mood), sqlc.arg(color), now())
ON CONFLICT (user_id, mood)
DO UPDATE SET color = EXCLUDED.color, updated_at = now()
RETURNING mood, color;

-- name: IncrementMoodColorCount :exec
INSERT INTO mood_color_counts (mood, hue_bucket, color, count)
VALUES (sqlc.arg(mood), sqlc.arg(hue_bucket), sqlc.arg(color), 1)
ON CONFLICT (mood, hue_bucket, color)
DO UPDATE SET count = mood_color_counts.count + 1;

-- name: DecrementMoodColorCount :exec
WITH decremented AS (
    UPDATE mood_color_counts AS decrement_counts
    SET count = count - 1
    WHERE decrement_counts.mood = sqlc.arg(mood)
      AND decrement_counts.hue_bucket = sqlc.arg(hue_bucket)
      AND decrement_counts.color = sqlc.arg(color)
      AND decrement_counts.count > 1
    RETURNING 1
)
DELETE FROM mood_color_counts AS zero_counts
WHERE zero_counts.mood = sqlc.arg(mood)
  AND zero_counts.hue_bucket = sqlc.arg(hue_bucket)
  AND zero_counts.color = sqlc.arg(color)
  AND zero_counts.count = 1
  AND NOT EXISTS (SELECT 1 FROM decremented);

-- name: ListMoodColorStats :many
WITH bucket_counts AS (
    SELECT hue_bucket, SUM(count)::BIGINT AS bucket_count
    FROM mood_color_counts AS bucket_source
    WHERE bucket_source.mood = sqlc.arg(mood)
    GROUP BY hue_bucket
),
swatches AS (
    SELECT DISTINCT ON (hue_bucket)
           hue_bucket,
           color AS swatch_color
    FROM mood_color_counts AS swatch_source
    WHERE swatch_source.mood = sqlc.arg(mood)
    ORDER BY hue_bucket, count DESC, color
)
SELECT bucket_counts.hue_bucket,
       bucket_counts.bucket_count,
       SUM(bucket_counts.bucket_count) OVER ()::BIGINT AS total_count,
       swatches.swatch_color
FROM bucket_counts
JOIN swatches USING (hue_bucket)
ORDER BY bucket_counts.bucket_count DESC, bucket_counts.hue_bucket
LIMIT sqlc.arg(recommendation_count);
