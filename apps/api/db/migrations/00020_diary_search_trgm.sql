-- +goose Up
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Korean substring search needs codepoint trigrams because the base image has no morphological analyzer.
CREATE INDEX diaries_body_trgm_idx ON diaries USING GIN (body gin_trgm_ops);

-- +goose Down
DROP INDEX IF EXISTS diaries_body_trgm_idx;
DROP EXTENSION IF EXISTS pg_trgm;
