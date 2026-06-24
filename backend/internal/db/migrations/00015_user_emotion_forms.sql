-- +goose Up
-- 감정별 별 형태 오버라이드(change 30). 색 오버라이드(user_emotion_colors, 00002)의 형태 평행물:
-- 사용자가 바꾼 mood만 "look" 1행씩 담는 부분 오버라이드라, 별 렌더는 그 mood에 행이 있으면 그 룩을,
-- 없으면 전역 기본(user_settings.star_object)을 쓴다. 빈 테이블 = 전부 전역 기본(기존 단일 룩과 동치).
-- look은 별 룩 id("polyhedron"/"liquid"/"spiky", change 29)이고 소유 검증은 settings 서비스가 한다
-- (미소유/미지 look은 거부 — DB는 임의 문자열을 받는다). 00001~00014는 수정 금지(append-only DDL).
-- 배포 재시도 중 테이블 생성 전 row type만 남은 DB를 복구한다. 테이블이 이미 있으면 건드리지 않는다.
-- +goose StatementBegin
DO $$
DECLARE
    target_schema TEXT := current_schema();
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = target_schema
          AND c.relname = 'user_emotion_forms'
          AND c.relkind IN ('r', 'p')
    )
    AND EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        LEFT JOIN pg_class c ON c.oid = t.typrelid
        WHERE n.nspname = target_schema
          AND t.typname = 'user_emotion_forms'
          AND t.typtype = 'c'
          AND COALESCE(c.relkind, '') NOT IN ('r', 'p')
    ) THEN
        EXECUTE format('DROP TYPE %I.user_emotion_forms', target_schema);
    END IF;
END $$;
-- +goose StatementEnd

CREATE TABLE IF NOT EXISTS user_emotion_forms (
    user_id TEXT NOT NULL,
    mood    TEXT NOT NULL,
    look    TEXT NOT NULL,
    PRIMARY KEY (user_id, mood)
);

-- +goose Down
DROP TABLE IF EXISTS user_emotion_forms;
