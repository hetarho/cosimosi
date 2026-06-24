-- +goose Up
-- 감정별 별 형태 오버라이드(change 30). 색 오버라이드(user_emotion_colors, 00002)의 형태 평행물:
-- 사용자가 바꾼 mood만 "look" 1행씩 담는 부분 오버라이드라, 별 렌더는 그 mood에 행이 있으면 그 룩을,
-- 없으면 전역 기본(user_settings.star_object)을 쓴다. 빈 테이블 = 전부 전역 기본(기존 단일 룩과 동치).
-- look은 별 룩 id("polyhedron"/"liquid"/"spiky", change 29)이고 소유 검증은 settings 서비스가 한다
-- (미소유/미지 look은 거부 — DB는 임의 문자열을 받는다). 00001~00014는 수정 금지(append-only DDL).
CREATE TABLE user_emotion_forms (
    user_id TEXT NOT NULL,
    mood    TEXT NOT NULL,
    look    TEXT NOT NULL,
    PRIMARY KEY (user_id, mood)
);

-- +goose Down
DROP TABLE user_emotion_forms;
