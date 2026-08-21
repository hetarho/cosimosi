-- Dev-only BULK seed: ~32 additional fresh memories on top of scripts/seed-dev-universe.sql,
-- so the dev universe holds 40+ episodic stars — z depth is emergent from neuron repulsion, so
-- the origin-centered lens only visibly spreads with enough bodies. The curated seed stays the
-- product-STATE fixture (decay, gist ladders, deletion, pending rises); this one is pure VOLUME,
-- simulating a person who journaled daily for a week and a half.
--
-- Additive + re-runnable: it owns the 'devz-' id namespace and tears down only that, so it
-- never touches the curated 'dev-' fixture rows or anything written by hand in the dev app.
-- It REQUIRES the curated seed (reuses its neurons for cross-constellation synapses) and
-- reads the LIVE universe clock, dating everything relative to it — every memory is 0..9
-- universe-days old with its gist timer at its creation date, so nothing is owed at read
-- time (age < one gist unit) and no decay stage applies yet.
--
-- Apply with:  psql "$DATABASE_URL" -f scripts/seed-dev-universe-bulk.sql
--   or: docker exec -i cosimosi-postgres psql -U cosimosi -d cosimosi < scripts/seed-dev-universe-bulk.sql
--
-- Mood strings are uppercase; valence/arousal follow spec/values.yaml emotion.mood_* tables;
-- base_strength = arousal_strength_min + (max-min) * arousal = 0.35 + 0.4 * arousal.
-- Sealed neurons (dev-neuron-09, dev-neuron-15) are never re-activated — sealing blocks
-- recruitment. Synapses keep neuron_a_id < neuron_b_id in the DATABASE's own collation
-- (computed via LEAST/GREATEST — id spelling order is collation-dependent); pairs that might
-- already exist in the curated fixture are guarded with ON CONFLICT.

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM universe_state WHERE user_id = 'dev-user') THEN
    RAISE EXCEPTION 'dev-user universe missing — run scripts/seed-dev-universe.sql first';
  END IF;
END $$;

-- FK-safe teardown, scoped to this fixture's own namespace.
DELETE FROM memory_provenance  WHERE user_id = 'dev-user' AND episodic_memory_id LIKE 'devz-%';
DELETE FROM neuron_activations WHERE user_id = 'dev-user'
  AND (episodic_memory_id LIKE 'devz-%' OR neuron_id LIKE 'devz-%');
DELETE FROM synapses           WHERE user_id = 'dev-user' AND id LIKE 'devz-%';
DELETE FROM episodic_memories  WHERE user_id = 'dev-user' AND id LIKE 'devz-%';
DELETE FROM neurons            WHERE user_id = 'dev-user' AND id LIKE 'devz-%';
DELETE FROM diaries            WHERE user_id = 'dev-user' AND id LIKE 'devz-%';

-- New neurons (zero-padded ids keep synapse a<b ordering trivial).
INSERT INTO neurons (id, user_id, name, neuron_type) VALUES
  ('devz-neuron-01', 'dev-user', '한강',     'spatial'),
  ('devz-neuron-02', 'dev-user', '자전거',   'semantic'),
  ('devz-neuron-03', 'dev-user', '강아지',   'entity'),
  ('devz-neuron-04', 'dev-user', '산책',     'semantic'),
  ('devz-neuron-05', 'dev-user', '카페',     'spatial'),
  ('devz-neuron-06', 'dev-user', '커피',     'semantic'),
  ('devz-neuron-07', 'dev-user', '엄마',     'entity'),
  ('devz-neuron-08', 'dev-user', '동생',     'entity'),
  ('devz-neuron-09', 'dev-user', '부엌',     'spatial'),
  ('devz-neuron-10', 'dev-user', '요리',     'semantic'),
  ('devz-neuron-11', 'dev-user', '비',       'semantic'),
  ('devz-neuron-12', 'dev-user', '책',       'semantic'),
  ('devz-neuron-13', 'dev-user', '도서관',   'spatial'),
  ('devz-neuron-14', 'dev-user', '달리기',   'semantic'),
  ('devz-neuron-15', 'dev-user', '새벽',     'semantic'),
  ('devz-neuron-16', 'dev-user', '지하철',   'spatial'),
  ('devz-neuron-17', 'dev-user', '동료',     'entity'),
  ('devz-neuron-18', 'dev-user', '회의',     'semantic'),
  ('devz-neuron-19', 'dev-user', '시장',     'spatial'),
  ('devz-neuron-20', 'dev-user', '은행나무', 'semantic'),
  ('devz-neuron-21', 'dev-user', '영화',     'semantic'),
  ('devz-neuron-22', 'dev-user', '옥상',     'spatial');

-- Twelve diaries across the last ten universe-days (relative to the LIVE clock).
WITH clock AS (SELECT current_universe_time AS t0 FROM universe_state WHERE user_id = 'dev-user')
INSERT INTO diaries (id, user_id, body, diary_date)
SELECT v.id, 'dev-user', v.body, clock.t0 - v.age
FROM clock, (VALUES
  ('devz-diary-01', 9, '오랜만에 자전거를 꺼내 한강까지 달렸다. 바람이 좋아서 멀리까지 갔다. 돌아오는 길에 카페에 들러 커피를 마셨고, 출근길 지하철의 피로가 그제야 풀리는 것 같았다.'),
  ('devz-diary-02', 9, '동생네에서 강아지를 데려왔다. 이름은 콩이. 엄마가 제일 좋아하신다. 저녁에 산책을 나갔다가 신나서 한강까지 걸었다. 집에 와서 처음 만든 사료 간식은 실패했다.'),
  ('devz-diary-03', 8, '비가 하루 종일 왔다. 도서관에 앉아 빌린 책을 거의 다 읽었다. 지하철 창에 맺힌 빗방울을 오래 봤다.'),
  ('devz-diary-04', 7, '엄마와 시장에 갔다. 잔뜩 사 와서 같이 저녁을 만들었다. 마당에 앉아 먹은 저녁이 오래 기억날 것 같다.'),
  ('devz-diary-05', 6, '새벽에 일어나 한강을 달렸다. 몸이 가벼웠다. 회사에서는 회의가 길어졌고, 동료의 말에 화가 났지만 참았다.'),
  ('devz-diary-06', 5, '점심에 옥상에서 커피를 마시며 동료와 이야기했다. 마감이 코앞이라 사무실 공기가 무겁다.'),
  ('devz-diary-07', 4, '동생에게 오랜만에 전화가 왔다. 통화 끝에 할머니 감나무 얘기가 나와서 한참 조용해졌다. 자기 전에 책을 조금 읽었다.'),
  ('devz-diary-08', 3, '충동적으로 바다에 다녀왔다. 해운대는 여전했다. 모래사장을 오래 걸었다. 돌아오는 지하철에서는 이상하게 마음이 텅 비었다.'),
  ('devz-diary-09', 2, '친구와 심야 영화를 봤다. 끝나고 카페에서 커피를 마시며 오래 떠들었다. 새벽 지하철 플랫폼에 혼자 서 있는데 문득 무서웠다.'),
  ('devz-diary-10', 1, '요리를 또 실패했다. 부엌이 엉망이 됐다. 콩이랑 마당에서 놀다 보니 괜찮아졌다. 은행나무 길을 걸으며 하루를 정리했다.'),
  ('devz-diary-11', 0, '은행나무가 물들기 시작한 길을 따라 한강까지 산책했다. 집에 와서 엄마가 가르쳐준 대로 요리를 했는데 이번엔 성공했다.'),
  ('devz-diary-12', 0, '새 프로젝트가 시작됐다. 회의에서 동료들과 방향을 정했다. 설레는데, 새벽까지 잠이 안 와서 조금 피곤하다.')
) AS v(id, age, body);

-- 32 fresh memories. All: recall_count 0, gist stage 0 with the timer at creation (nothing
-- owed: age <= 9 < one 10-day gist unit), no decay yet (age <= 30), intensity the default 0.7,
-- and a pregenerated 4-stage gist ladder ([C7] — the encode flow writes it up front).
WITH clock AS (SELECT current_universe_time AS t0 FROM universe_state WHERE user_id = 'dev-user')
INSERT INTO episodic_memories
  (id, user_id, diary_id, name, current_text, source_text, seed, mood, valence, arousal, intensity,
   base_strength, recall_count, created_universe_time, last_recalled_universe_time,
   semantic_stage, semanticize_timer_reset_at, semantic_stages, decay_stages, deleted_at)
SELECT v.id, 'dev-user', v.diary, v.name, v.body, v.body, v.seed, v.mood,
       v.valence::real, v.arousal::real, 0.7, v.strength::real, 0,
       clock.t0 - v.age, NULL, 0, clock.t0 - v.age, v.stages::jsonb, NULL, NULL
FROM clock, (VALUES
  -- devz-diary-01 (age 9)
  ('devz-memory-01', 'devz-diary-01', 9, '한강 자전거 질주', '오랜만에 자전거로 한강을 달렸다. 바람이 좋아 멀리까지 갔다.',
   9000001, 'JOY', 0.82, 0.72, 0.64, '["자전거로 한강을 달린 날", "바람을 가르던 기분", "몸으로 느낀 자유", "달리면 가벼워진다"]'),
  ('devz-memory-02', 'devz-diary-01', 9, '돌아오는 길의 커피', '돌아오는 길에 카페에 들러 커피를 마시며 숨을 골랐다.',
   9000002, 'CALM', 0.62, 0.22, 0.44, '["운동 뒤의 커피 한 잔", "카페에서 고른 숨", "쉼표 같은 시간", "잠깐 멈추면 편해진다"]'),
  ('devz-memory-03', 'devz-diary-01', 9, '지하철의 피로', '출근길 지하철의 피로가 그제야 풀리는 것 같았다.',
   9000003, 'TIRED', -0.55, 0.18, 0.42, '["쌓여 있던 출근길 피로", "몸이 무거웠던 나날", "지친 일상", "쉼이 필요했다"]'),
  -- devz-diary-02 (age 9)
  ('devz-memory-04', 'devz-diary-02', 9, '콩이가 온 날', '동생네에서 강아지 콩이를 데려왔다. 엄마가 제일 좋아하신다.',
   9000004, 'LOVE', 0.9, 0.66, 0.61, '["콩이를 처음 안은 날", "식구가 하나 늘던 순간", "새 가족", "함께라는 온기"]'),
  ('devz-memory-05', 'devz-diary-02', 9, '콩이의 첫 산책', '신이 난 콩이를 따라 한강까지 걸었다.',
   9000005, 'EXCITEMENT', 0.78, 0.9, 0.71, '["콩이와의 첫 산책", "한강까지 이끌린 저녁", "들뜬 발걸음", "새로움이 주는 설렘"]'),
  ('devz-memory-06', 'devz-diary-02', 9, '간식 만들기 실패', '처음 만든 사료 간식은 실패했다. 부엌이 엉망이 됐다.',
   9000006, 'STRESS', -0.7, 0.78, 0.66, '["엉망이 된 부엌", "서툴렀던 첫 시도", "실패의 소란", "처음은 원래 어렵다"]'),
  -- devz-diary-03 (age 8)
  ('devz-memory-07', 'devz-diary-03', 8, '비 오는 도서관', '비가 오는 날 도서관에 앉아 빌린 책을 거의 다 읽었다.',
   9000007, 'CALM', 0.62, 0.22, 0.44, '["빗소리 속의 독서", "도서관의 고요", "책에 잠긴 오후", "고요가 주는 회복"]'),
  ('devz-memory-08', 'devz-diary-03', 8, '빗방울 맺힌 창', '지하철 창에 맺힌 빗방울을 오래 봤다.',
   9000008, 'NEUTRAL', 0.0, 0.5, 0.55, '["창에 맺힌 빗방울", "멍하니 흘러간 이동", "비 오는 날의 창가", "스쳐 간 하루"]'),
  -- devz-diary-04 (age 7)
  ('devz-memory-09', 'devz-diary-04', 7, '엄마와 장보기', '엄마와 시장에 가서 잔뜩 사 왔다.',
   9000009, 'GRATITUDE', 0.76, 0.38, 0.50, '["엄마와 걸은 시장", "함께 고른 저녁거리", "곁에 있는 고마움", "일상 속의 감사"]'),
  ('devz-memory-10', 'devz-diary-04', 7, '같이 만든 저녁', '사 온 재료로 엄마와 같이 저녁을 만들었다.',
   9000010, 'JOY', 0.82, 0.72, 0.64, '["엄마와 함께한 부엌", "같이 만든 저녁상", "나눠 먹은 기쁨", "함께 만들면 더 맛있다"]'),
  ('devz-memory-11', 'devz-diary-04', 7, '마당의 저녁상', '마당에 앉아 먹은 저녁이 오래 기억날 것 같았다.',
   9000011, 'RELIEF', 0.68, 0.3, 0.47, '["마당에서의 저녁", "바람 좋은 식탁", "느긋했던 끝맺음", "하루가 풀리는 시간"]'),
  -- devz-diary-05 (age 6)
  ('devz-memory-12', 'devz-diary-05', 6, '새벽의 한강 달리기', '새벽에 일어나 한강을 달렸다. 몸이 가벼웠다.',
   9000012, 'EXCITEMENT', 0.78, 0.9, 0.71, '["새벽 강가의 달리기", "가벼워진 몸", "이른 아침의 활력", "새벽이 주는 힘"]'),
  ('devz-memory-13', 'devz-diary-05', 6, '길어진 회의', '회사 회의가 끝없이 길어져 진이 빠졌다.',
   9000013, 'TIRED', -0.55, 0.18, 0.42, '["끝나지 않던 회의", "말이 길어진 오후", "소모된 하루", "회의가 남긴 피로"]'),
  ('devz-memory-14', 'devz-diary-05', 6, '참아 넘긴 화', '동료의 말에 화가 났지만 참았다.',
   9000014, 'ANGER', -0.76, 0.86, 0.69, '["삼켜버린 한마디", "화를 눌렀던 순간", "참는 게 맞았을까", "감정을 다루는 법"]'),
  -- devz-diary-06 (age 5)
  ('devz-memory-15', 'devz-diary-06', 5, '옥상의 점심 커피', '점심에 옥상에서 커피를 마시며 동료와 이야기했다.',
   9000015, 'RELIEF', 0.68, 0.3, 0.47, '["옥상에서의 숨 고르기", "커피와 잡담", "잠깐의 바람", "일 사이의 틈"]'),
  ('devz-memory-16', 'devz-diary-06', 5, '마감 전의 공기', '마감이 코앞이라 사무실 공기가 무거웠다.',
   9000016, 'STRESS', -0.7, 0.78, 0.66, '["마감 앞의 무거움", "조여 오는 시간", "긴장된 사무실", "마감은 늘 무겁다"]'),
  -- devz-diary-07 (age 4)
  ('devz-memory-17', 'devz-diary-07', 4, '동생의 전화', '동생에게 오랜만에 전화가 와서 한참을 통화했다.',
   9000017, 'LOVE', 0.9, 0.66, 0.61, '["오랜만의 목소리", "길어진 통화", "멀리 있어도 가까운", "가족이라는 안부"]'),
  ('devz-memory-18', 'devz-diary-07', 4, '감나무 이야기', '통화 끝에 할머니 감나무 얘기가 나와 한참 조용해졌다.',
   9000018, 'SAD', -0.78, 0.28, 0.46, '["감나무가 부른 침묵", "함께 그리워한 순간", "말없이 나눈 마음", "그리움은 나눠진다"]'),
  ('devz-memory-19', 'devz-diary-07', 4, '자기 전의 독서', '자기 전에 책을 조금 읽다 잠들었다.',
   9000019, 'CALM', 0.62, 0.22, 0.44, '["잠들기 전의 몇 쪽", "고요한 마무리", "책과 닫은 하루", "느린 밤의 습관"]'),
  -- devz-diary-08 (age 3)
  ('devz-memory-20', 'devz-diary-08', 3, '충동적인 바다행', '충동적으로 바다에 다녀왔다. 해운대는 여전했다.',
   9000020, 'JOY', 0.82, 0.72, 0.64, '["즉흥으로 떠난 바다", "여전했던 해운대", "떠나길 잘했다", "바다는 늘 답을 준다"]'),
  ('devz-memory-21', 'devz-diary-08', 3, '모래사장 산책', '모래사장을 오래 걸었다. 파도 소리만 들었다.',
   9000021, 'CALM', 0.62, 0.22, 0.44, '["파도 소리와 걸음", "모래 위의 긴 산책", "생각을 비운 걸음", "걷다 보면 비워진다"]'),
  ('devz-memory-22', 'devz-diary-08', 3, '돌아오는 빈 마음', '돌아오는 지하철에서 이상하게 마음이 텅 비었다.',
   9000022, 'EMPTINESS', -0.68, 0.16, 0.41, '["돌아오는 길의 공허", "즐거움 뒤의 빈자리", "여운과 허전함", "채움 뒤에 오는 비움"]'),
  -- devz-diary-09 (age 2)
  ('devz-memory-23', 'devz-diary-09', 2, '심야 영화', '친구와 심야 영화를 봤다. 오랜만에 크게 웃었다.',
   9000023, 'JOY', 0.82, 0.72, 0.64, '["친구와 본 심야 영화", "어둠 속의 웃음", "같이 웃던 밤", "웃음은 나눌수록 크다"]'),
  ('devz-memory-24', 'devz-diary-09', 2, '카페의 긴 수다', '끝나고 카페에서 커피를 마시며 오래 떠들었다.',
   9000024, 'GRATITUDE', 0.76, 0.38, 0.50, '["밤늦게 이어진 수다", "고마운 친구", "곁에 있는 사람", "우정이라는 자리"]'),
  ('devz-memory-25', 'devz-diary-09', 2, '새벽 플랫폼의 무서움', '새벽 지하철 플랫폼에 혼자 서 있는데 문득 무서웠다.',
   9000025, 'FEAR', -0.82, 0.88, 0.70, '["텅 빈 새벽 플랫폼", "혼자라는 서늘함", "밤이 주는 불안", "무서움도 지나간다"]'),
  -- devz-diary-10 (age 1)
  ('devz-memory-26', 'devz-diary-10', 1, '또 실패한 요리', '요리를 또 실패했다. 부엌이 엉망이 됐다.',
   9000026, 'STRESS', -0.7, 0.78, 0.66, '["또 엉망이 된 부엌", "반복된 실패", "요리와의 씨름", "실패도 연습이다"]'),
  ('devz-memory-27', 'devz-diary-10', 1, '콩이와 마당 놀이', '콩이랑 마당에서 놀다 보니 기분이 풀렸다.',
   9000027, 'JOY', 0.82, 0.72, 0.64, '["콩이와 뒹군 마당", "단순한 즐거움", "놀이가 준 회복", "기분은 몸으로 푼다"]'),
  ('devz-memory-28', 'devz-diary-10', 1, '은행나무 길 정리', '은행나무 길을 걸으며 하루를 정리했다.',
   9000028, 'RELIEF', 0.68, 0.3, 0.47, '["은행나무 아래의 정리", "걸으며 푼 하루", "저무는 길의 안도", "걷기가 곧 정리다"]'),
  -- devz-diary-11 (age 0)
  ('devz-memory-29', 'devz-diary-11', 0, '물들기 시작한 길', '은행나무가 물들기 시작한 길을 따라 한강까지 산책했다.',
   9000029, 'CALM', 0.62, 0.22, 0.44, '["물들기 시작한 가로수", "계절이 바뀌는 길", "천천히 온 가을", "계절을 걷다"]'),
  ('devz-memory-30', 'devz-diary-11', 0, '처음 성공한 요리', '엄마가 가르쳐준 대로 요리했더니 이번엔 성공했다.',
   9000030, 'GRATITUDE', 0.76, 0.38, 0.50, '["드디어 성공한 한 끼", "엄마의 레시피", "배운 대로 되는 기쁨", "가르침이 남긴 맛"]'),
  -- devz-diary-12 (age 0)
  ('devz-memory-31', 'devz-diary-12', 0, '새 프로젝트의 시작', '새 프로젝트가 시작됐다. 회의에서 동료들과 방향을 정했다.',
   9000031, 'EXCITEMENT', 0.78, 0.9, 0.71, '["새로 시작된 일", "함께 정한 방향", "시작의 설렘", "출발선의 에너지"]'),
  ('devz-memory-32', 'devz-diary-12', 0, '잠 안 오는 새벽', '설레서 새벽까지 잠이 안 와 조금 피곤하다.',
   9000032, 'TIRED', -0.55, 0.18, 0.42, '["설렘이 밀어낸 잠", "뒤척인 새벽", "피곤한 들뜸", "마음이 바쁘면 밤이 짧다"]')
) AS v(id, diary, age, name, body, seed, mood, valence, arousal, strength, stages);

-- Activations: 2-4 neurons per memory, weights varied so centroids differ. Hub neurons
-- (한강, 산책, 커피, 부엌/요리, 회사) recur across memories — connectivity variance is what
-- spreads radius, and shared neurons are what draw constellations.
INSERT INTO neuron_activations (episodic_memory_id, neuron_id, user_id, weight) VALUES
  ('devz-memory-01', 'devz-neuron-01', 'dev-user', 1.0),
  ('devz-memory-01', 'devz-neuron-02', 'dev-user', 0.9),
  ('devz-memory-01', 'devz-neuron-04', 'dev-user', 0.5),
  ('devz-memory-02', 'devz-neuron-05', 'dev-user', 1.0),
  ('devz-memory-02', 'devz-neuron-06', 'dev-user', 0.8),
  ('devz-memory-03', 'devz-neuron-16', 'dev-user', 1.0),
  ('devz-memory-03', 'dev-neuron-10',  'dev-user', 0.6),
  ('devz-memory-04', 'devz-neuron-03', 'dev-user', 1.0),
  ('devz-memory-04', 'devz-neuron-07', 'dev-user', 0.7),
  ('devz-memory-04', 'devz-neuron-08', 'dev-user', 0.6),
  ('devz-memory-05', 'devz-neuron-03', 'dev-user', 1.0),
  ('devz-memory-05', 'devz-neuron-04', 'dev-user', 0.8),
  ('devz-memory-05', 'devz-neuron-01', 'dev-user', 0.6),
  ('devz-memory-06', 'devz-neuron-09', 'dev-user', 1.0),
  ('devz-memory-06', 'devz-neuron-10', 'dev-user', 0.9),
  ('devz-memory-07', 'devz-neuron-11', 'dev-user', 0.8),
  ('devz-memory-07', 'devz-neuron-13', 'dev-user', 1.0),
  ('devz-memory-07', 'devz-neuron-12', 'dev-user', 0.9),
  ('devz-memory-08', 'devz-neuron-16', 'dev-user', 1.0),
  ('devz-memory-08', 'devz-neuron-11', 'dev-user', 0.7),
  ('devz-memory-09', 'devz-neuron-07', 'dev-user', 1.0),
  ('devz-memory-09', 'devz-neuron-19', 'dev-user', 0.9),
  ('devz-memory-10', 'devz-neuron-19', 'dev-user', 0.5),
  ('devz-memory-10', 'devz-neuron-10', 'dev-user', 1.0),
  ('devz-memory-10', 'devz-neuron-09', 'dev-user', 0.8),
  ('devz-memory-10', 'devz-neuron-07', 'dev-user', 0.7),
  ('devz-memory-11', 'dev-neuron-14',  'dev-user', 0.9),
  ('devz-memory-11', 'dev-neuron-06',  'dev-user', 1.0),
  ('devz-memory-12', 'devz-neuron-15', 'dev-user', 0.9),
  ('devz-memory-12', 'devz-neuron-14', 'dev-user', 1.0),
  ('devz-memory-12', 'devz-neuron-01', 'dev-user', 0.7),
  ('devz-memory-13', 'dev-neuron-10',  'dev-user', 0.8),
  ('devz-memory-13', 'devz-neuron-18', 'dev-user', 1.0),
  ('devz-memory-14', 'devz-neuron-18', 'dev-user', 0.6),
  ('devz-memory-14', 'devz-neuron-17', 'dev-user', 1.0),
  ('devz-memory-15', 'devz-neuron-22', 'dev-user', 1.0),
  ('devz-memory-15', 'devz-neuron-06', 'dev-user', 0.8),
  ('devz-memory-15', 'devz-neuron-17', 'dev-user', 0.6),
  ('devz-memory-16', 'dev-neuron-07',  'dev-user', 1.0),
  ('devz-memory-16', 'dev-neuron-08',  'dev-user', 0.8),
  ('devz-memory-17', 'devz-neuron-08', 'dev-user', 1.0),
  ('devz-memory-17', 'devz-neuron-07', 'dev-user', 0.5),
  ('devz-memory-18', 'dev-neuron-03',  'dev-user', 0.8),
  ('devz-memory-18', 'dev-neuron-04',  'dev-user', 1.0),
  ('devz-memory-18', 'devz-neuron-08', 'dev-user', 0.6),
  ('devz-memory-19', 'devz-neuron-12', 'dev-user', 1.0),
  ('devz-memory-19', 'dev-neuron-14',  'dev-user', 0.6),
  ('devz-memory-20', 'dev-neuron-01',  'dev-user', 1.0),
  ('devz-memory-20', 'dev-neuron-05',  'dev-user', 0.9),
  ('devz-memory-20', 'dev-neuron-02',  'dev-user', 0.5),
  ('devz-memory-21', 'dev-neuron-01',  'dev-user', 0.9),
  ('devz-memory-21', 'devz-neuron-04', 'dev-user', 1.0),
  ('devz-memory-22', 'devz-neuron-16', 'dev-user', 0.8),
  ('devz-memory-22', 'dev-neuron-14',  'dev-user', 0.7),
  ('devz-memory-23', 'devz-neuron-21', 'dev-user', 1.0),
  ('devz-memory-23', 'dev-neuron-11',  'dev-user', 0.9),
  ('devz-memory-24', 'dev-neuron-11',  'dev-user', 1.0),
  ('devz-memory-24', 'devz-neuron-05', 'dev-user', 0.7),
  ('devz-memory-24', 'devz-neuron-06', 'dev-user', 0.6),
  ('devz-memory-25', 'devz-neuron-15', 'dev-user', 0.8),
  ('devz-memory-25', 'devz-neuron-16', 'dev-user', 1.0),
  ('devz-memory-26', 'devz-neuron-10', 'dev-user', 1.0),
  ('devz-memory-26', 'devz-neuron-09', 'dev-user', 0.9),
  ('devz-memory-27', 'devz-neuron-03', 'dev-user', 1.0),
  ('devz-memory-27', 'dev-neuron-06',  'dev-user', 0.7),
  ('devz-memory-28', 'devz-neuron-04', 'dev-user', 0.9),
  ('devz-memory-28', 'devz-neuron-20', 'dev-user', 1.0),
  ('devz-memory-29', 'devz-neuron-20', 'dev-user', 0.9),
  ('devz-memory-29', 'devz-neuron-04', 'dev-user', 0.8),
  ('devz-memory-29', 'devz-neuron-01', 'dev-user', 1.0),
  ('devz-memory-30', 'devz-neuron-07', 'dev-user', 0.8),
  ('devz-memory-30', 'devz-neuron-09', 'dev-user', 0.7),
  ('devz-memory-30', 'devz-neuron-10', 'dev-user', 1.0),
  ('devz-memory-31', 'dev-neuron-10',  'dev-user', 0.8),
  ('devz-memory-31', 'devz-neuron-18', 'dev-user', 1.0),
  ('devz-memory-31', 'devz-neuron-17', 'dev-user', 0.7),
  ('devz-memory-32', 'devz-neuron-15', 'dev-user', 1.0),
  ('devz-memory-32', 'dev-neuron-10',  'dev-user', 0.5);

-- Synapses among co-activated neurons. The a<b check compares in the DATABASE's collation
-- (where 'devz-*' can sort before 'dev-*'), so the canonical order is computed with
-- LEAST/GREATEST rather than assumed from the id spelling. Strengths and co-activation counts
-- follow how often the pair recurred above. Pairs that could collide with the curated fixture
-- are ON CONFLICT-guarded.
WITH clock AS (SELECT current_universe_time AS t0 FROM universe_state WHERE user_id = 'dev-user')
INSERT INTO synapses (id, user_id, neuron_a_id, neuron_b_id, strength, co_activation_count, last_activated_universe_time)
SELECT v.id, 'dev-user', LEAST(v.a, v.b), GREATEST(v.a, v.b), v.strength::real, v.count, clock.t0 - v.age
FROM clock, (VALUES
  ('devz-synapse-01', 'devz-neuron-01', 'devz-neuron-02', 0.34, 1, 9),
  ('devz-synapse-02', 'devz-neuron-01', 'devz-neuron-04', 0.52, 3, 0),
  ('devz-synapse-03', 'devz-neuron-02', 'devz-neuron-04', 0.22, 1, 9),
  ('devz-synapse-04', 'devz-neuron-05', 'devz-neuron-06', 0.46, 2, 2),
  ('devz-synapse-05', 'dev-neuron-10',  'devz-neuron-16', 0.30, 1, 9),
  ('devz-synapse-06', 'devz-neuron-03', 'devz-neuron-07', 0.28, 1, 9),
  ('devz-synapse-07', 'devz-neuron-03', 'devz-neuron-08', 0.24, 1, 9),
  ('devz-synapse-08', 'devz-neuron-07', 'devz-neuron-08', 0.36, 2, 4),
  ('devz-synapse-09', 'devz-neuron-01', 'devz-neuron-03', 0.26, 1, 9),
  ('devz-synapse-10', 'devz-neuron-03', 'devz-neuron-04', 0.38, 2, 1),
  ('devz-synapse-11', 'devz-neuron-09', 'devz-neuron-10', 0.58, 4, 0),
  ('devz-synapse-12', 'devz-neuron-11', 'devz-neuron-13', 0.30, 1, 8),
  ('devz-synapse-13', 'devz-neuron-12', 'devz-neuron-13', 0.34, 1, 8),
  ('devz-synapse-14', 'devz-neuron-11', 'devz-neuron-12', 0.24, 1, 8),
  ('devz-synapse-15', 'devz-neuron-11', 'devz-neuron-16', 0.28, 2, 3),
  ('devz-synapse-16', 'devz-neuron-07', 'devz-neuron-19', 0.32, 1, 7),
  ('devz-synapse-17', 'devz-neuron-10', 'devz-neuron-19', 0.22, 1, 7),
  ('devz-synapse-18', 'devz-neuron-07', 'devz-neuron-10', 0.42, 2, 0),
  ('devz-synapse-19', 'devz-neuron-07', 'devz-neuron-09', 0.30, 2, 0),
  ('devz-synapse-20', 'dev-neuron-06',  'dev-neuron-14',  0.28, 1, 7),
  ('devz-synapse-21', 'devz-neuron-14', 'devz-neuron-15', 0.40, 2, 6),
  ('devz-synapse-22', 'devz-neuron-01', 'devz-neuron-14', 0.30, 1, 6),
  ('devz-synapse-23', 'devz-neuron-01', 'devz-neuron-15', 0.24, 1, 6),
  ('devz-synapse-24', 'dev-neuron-10',  'devz-neuron-18', 0.44, 2, 0),
  ('devz-synapse-25', 'devz-neuron-17', 'devz-neuron-18', 0.46, 3, 0),
  ('devz-synapse-26', 'devz-neuron-06', 'devz-neuron-22', 0.30, 1, 5),
  ('devz-synapse-27', 'devz-neuron-17', 'devz-neuron-22', 0.26, 1, 5),
  ('devz-synapse-28', 'devz-neuron-06', 'devz-neuron-17', 0.22, 1, 5),
  ('devz-synapse-29', 'dev-neuron-07',  'dev-neuron-08',  0.40, 2, 5),
  ('devz-synapse-30', 'dev-neuron-03',  'devz-neuron-08', 0.20, 1, 4),
  ('devz-synapse-31', 'dev-neuron-04',  'devz-neuron-08', 0.22, 1, 4),
  ('devz-synapse-32', 'dev-neuron-14',  'devz-neuron-12', 0.26, 1, 4),
  ('devz-synapse-33', 'dev-neuron-01',  'dev-neuron-02',  0.30, 2, 3),
  ('devz-synapse-34', 'dev-neuron-01',  'dev-neuron-05',  0.36, 2, 3),
  ('devz-synapse-35', 'dev-neuron-01',  'devz-neuron-04', 0.28, 1, 3),
  ('devz-synapse-36', 'dev-neuron-14',  'devz-neuron-16', 0.24, 1, 3),
  ('devz-synapse-37', 'dev-neuron-11',  'devz-neuron-21', 0.34, 1, 2),
  ('devz-synapse-38', 'dev-neuron-11',  'devz-neuron-05', 0.26, 1, 2),
  ('devz-synapse-39', 'dev-neuron-11',  'devz-neuron-06', 0.22, 1, 2),
  ('devz-synapse-40', 'devz-neuron-15', 'devz-neuron-16', 0.30, 1, 2),
  ('devz-synapse-41', 'dev-neuron-06',  'devz-neuron-03', 0.24, 1, 1),
  ('devz-synapse-42', 'devz-neuron-04', 'devz-neuron-20', 0.38, 2, 0),
  ('devz-synapse-43', 'devz-neuron-01', 'devz-neuron-20', 0.26, 1, 0),
  ('devz-synapse-44', 'dev-neuron-10',  'devz-neuron-17', 0.28, 1, 0),
  ('devz-synapse-45', 'dev-neuron-10',  'devz-neuron-15', 0.20, 1, 0),
  ('devz-synapse-46', 'devz-neuron-04', 'devz-neuron-06', 0.20, 1, 9),
  ('devz-synapse-47', 'dev-neuron-02',  'dev-neuron-05',  0.28, 1, 3),
  ('devz-synapse-48', 'devz-neuron-09', 'devz-neuron-19', 0.20, 1, 7)
) AS v(id, a, b, strength, count, age)
ON CONFLICT (user_id, neuron_a_id, neuron_b_id) DO NOTHING;

COMMIT;

-- Sanity: visible episodic stars should now be 40+.
SELECT count(*) AS visible_memories FROM episodic_memories
WHERE user_id = 'dev-user' AND deleted_at IS NULL;
