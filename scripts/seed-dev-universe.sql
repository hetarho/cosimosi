-- Dev-only seed: a full-coverage memory universe for the VITE_DEV_USER_ID / dev bypass
-- user ('dev-user'), so `pnpm dev` renders every product state without months of waiting.
-- Re-runnable: it clears only this dev user's rows, then re-inserts. Never run against a
-- real user's data. Apply with:  psql "$DATABASE_URL" -f scripts/seed-dev-universe.sql
--   or: docker exec -i cosimosi-postgres psql -U cosimosi -d cosimosi < scripts/seed-dev-universe.sql
--
-- All universe dates are RELATIVE (CURRENT_DATE - n) so the fixture never rots.
-- The universe clock is planted at CURRENT_DATE - 30: writing one diary dated today
-- advances the clock 30 universe-days in one sweep — gist stages rise, newly crossed
-- decay stages get their word-loss texts filled, and the acceleration animation plays.
--
-- Every row is self-consistent with the read-time math at clock T0: each memory's
-- decay_stages array length equals DecayStage(elapsed, arousal, strength) at T0, and each
-- gist timer anchor sits just under the 1-unit boundary, so nothing is "owed" at seed time.
--
-- What the universe shows at seed time (clock T0 = today - 30), age in universe-days:
--   mem  mood        age  decay  gist  notes
--   01   SAD         260    4     3    deepest xxxx + 3 gist stars + a LetGo-sealed neuron
--   02   ANGER       260    3     4    fully gisted AND deeply forgotten (both axes maxed)
--   03   TIRED       230    0     4    recalled 12 days ago -> vivid again; 변천사 6 entries
--   04   FEAR        200    2     3    isolated constellation island (여행-제주)
--   05   GRATITUDE   110    1     2    both axes mid-way
--   06   LOVE        110    1     1
--   07   CALM         80    1     1
--   08   STRESS       80    1     0    NO gist ladder -> next advance defers (PENDING) and
--                                      the semanticize worker regenerates the ladder
--   09   NEUTRAL      30    0     1    dimmed only, not yet redacted
--   10   RELIEF       30    0     1    dimmed only
--   11   JOY           0    0     0    vivid, fresh
--   12   EXCITEMENT    0    0     0    vivid, highest arousal (biggest/brightest, slowest fade)
--   13   EMPTINESS     0    0     0    vivid, lowest arousal (fades and gists fastest)
--   14   SAD          --   soft-deleted 5 real days ago (25 days left to restore)
--
-- Writing ONE diary dated today advances the clock +30 universe-days, which produces:
--   * 10 memories rise EXACTLY ONE gist stage (01,04,05,06,07,09,10,11,12,13) -> 10 new
--     gist stars appear in the neocortex band; 02 and 03 are already at stage 4 (inert)
--   * mem 08 has no ladder, so its rise DEFERS (pending) and the semanticize worker
--     regenerates the ladder — the convergence path, visible in dev with the mock AI
--   * mem 05, 06, 07 erode one decay stage deeper (more words become xxxx)
--   * mem 10 gets its FIRST redacted words
--   * every star dims (e.g. a fresh star 1.00 -> ~0.81); synapses take their homeostatic
--     downscale (우주의 잠), and the time-acceleration sweep animates the whole jump
--
-- Mood strings are uppercase (the emotion MOODS the FE mapper accepts); neuron_type is
-- semantic|spatial|entity; synapses keep the canonical neuron_a_id < neuron_b_id order.
-- valence/arousal follow spec/values.yaml mood coordinates; base_strength follows
-- emotion.arousal_strength_min/max (0.35 + 0.4 * arousal).

BEGIN;

-- FK-safe teardown. Scoped to the dev user AND to this fixture's own 'dev-' ids, so
-- re-running the seed never destroys diaries/stars you wrote by hand in the dev app.
-- (The clock and the Twinkle rows are singletons per user, so those are replaced wholesale.)
DELETE FROM job_targets WHERE user_id = 'dev-user'
  AND target_id LIKE 'dev-%';
DELETE FROM jobs WHERE user_id = 'dev-user'
  AND id LIKE 'dev-%';
DELETE FROM memory_paid_action_receipts WHERE user_id = 'dev-user'
  AND episodic_memory_id LIKE 'dev-%';
DELETE FROM release_groups WHERE user_id = 'dev-user'
  AND id LIKE 'dev-%'; -- effect rows cascade
DELETE FROM memory_provenance WHERE user_id = 'dev-user'
  AND episodic_memory_id LIKE 'dev-%';
DELETE FROM synapses WHERE user_id = 'dev-user'
  AND id LIKE 'dev-%';
DELETE FROM neuron_activations WHERE user_id = 'dev-user'
  AND (episodic_memory_id LIKE 'dev-%' OR neuron_id LIKE 'dev-%');
DELETE FROM embeddings WHERE user_id = 'dev-user'
  AND neuron_id LIKE 'dev-%';
DELETE FROM episodic_memories WHERE user_id = 'dev-user'
  AND id LIKE 'dev-%';
DELETE FROM neurons WHERE user_id = 'dev-user'
  AND id LIKE 'dev-%';
DELETE FROM diaries WHERE user_id = 'dev-user'
  AND id LIKE 'dev-%';
DELETE FROM universe_state         WHERE user_id = 'dev-user';
DELETE FROM twinkle_ledger_entries WHERE user_id = 'dev-user';
DELETE FROM twinkle_balances       WHERE user_id = 'dev-user';

-- Account profile (upsert — the dev bypass user has no signup flow).
INSERT INTO users (user_id, nickname, timezone, locale) VALUES
  ('dev-user', '개발자', 'Asia/Seoul', 'ko')
ON CONFLICT (user_id) DO UPDATE
  SET nickname = EXCLUDED.nickname, timezone = EXCLUDED.timezone, locale = EXCLUDED.locale,
      deleted_at = NULL;

-- The universe clock, one month behind today. consolidated_through matches so the next
-- advance consolidates exactly the (today-30, today] interval.
INSERT INTO universe_state (user_id, current_universe_time, consolidated_through) VALUES
  ('dev-user', CURRENT_DATE - 30, CURRENT_DATE - 30);

INSERT INTO diaries (id, user_id, body, diary_date) VALUES
  ('dev-diary-01', 'dev-user', '첫 발표를 완전히 망쳤다. 목소리가 떨렸고 준비한 문장들이 순서를 잃었다. 회의실을 나와 옥상에서 오래 서 있었다. 돌아오는 회의에서는 부당한 말을 듣고도 아무 말도 하지 못했다.', CURRENT_DATE - 290),
  ('dev-diary-02', 'dev-user', '석 달을 끌던 프로젝트가 드디어 끝났다. 몸이 텅 빈 것처럼 무거웠다. 곧장 제주로 떠났는데, 밤길에 뒤따라오는 발소리에 심장이 내려앉기도 했다.', CURRENT_DATE - 230),
  ('dev-diary-03', 'dev-user', '할머니 댁에 다녀왔다. 감나무 아래에서 홍시를 받았고, 저녁에는 오랜 친구의 손편지를 몇 번이고 다시 읽었다.', CURRENT_DATE - 140),
  ('dev-diary-04', 'dev-user', '저녁 바람이 선선해진 마당을 걸었다. 한 주 내내 마감에 쫓겨 잠을 설친 끝이라 더 달게 느껴졌다.', CURRENT_DATE - 110),
  ('dev-diary-05', 'dev-user', '특별한 일 없이 지나간 하루. 바닷가를 오래 걷고 나니 걱정하던 일이 생각보다 작아 보였다.', CURRENT_DATE - 60),
  ('dev-diary-06', 'dev-user', '장마가 갠 아침에 해운대까지 달렸다. 밤에는 불꽃놀이를 봤고, 이사 온 집의 첫 저녁은 아직 낯설다.', CURRENT_DATE - 30),
  ('dev-diary-07', 'dev-user', '옛집에서의 마지막 밤. 빈 방마다 불을 켜 보고, 이사 상자들 사이에서 오래 서 있었다.', CURRENT_DATE - 45);

-- neurons: ids are zero-padded so lexical order matches, keeping synapse a<b trivial.
-- dev-neuron-09 is LetGo-sealed (permanent, no release row); dev-neuron-15 is
-- release-sealed (reversible, owned by dev-release-01 below).
INSERT INTO neurons (id, user_id, name, neuron_type, sealed_at) VALUES
  ('dev-neuron-01', 'dev-user', '바다',   'semantic', NULL),
  ('dev-neuron-02', 'dev-user', '여름',   'semantic', NULL),
  ('dev-neuron-03', 'dev-user', '할머니', 'entity',   NULL),
  ('dev-neuron-04', 'dev-user', '감나무', 'semantic', NULL),
  ('dev-neuron-05', 'dev-user', '해운대', 'spatial',  NULL),
  ('dev-neuron-06', 'dev-user', '마당',   'spatial',  NULL),
  ('dev-neuron-07', 'dev-user', '마감',   'semantic', NULL),
  ('dev-neuron-08', 'dev-user', '사무실', 'spatial',  NULL),
  ('dev-neuron-09', 'dev-user', '발표',   'semantic', now() - interval '20 days'),
  ('dev-neuron-10', 'dev-user', '회사',   'spatial',  NULL),
  ('dev-neuron-11', 'dev-user', '친구',   'entity',   NULL),
  ('dev-neuron-12', 'dev-user', '여행',   'semantic', NULL),
  ('dev-neuron-13', 'dev-user', '제주',   'spatial',  NULL),
  ('dev-neuron-14', 'dev-user', '저녁',   'semantic', NULL),
  ('dev-neuron-15', 'dev-user', '옛집',   'spatial',  now() - interval '5 days'),
  ('dev-neuron-16', 'dev-user', '이사',   'semantic', NULL);

INSERT INTO episodic_memories
  (id, user_id, diary_id, name, current_text, source_text, seed, mood, valence, arousal, intensity,
   base_strength, recall_count, created_universe_time, last_recalled_universe_time,
   semantic_stage, semanticize_timer_reset_at, semantic_stages, decay_stages, deleted_at) VALUES

  -- decay stage 4 (deepest) + gist 3 + LetGo case: the '발표' neuron was let go 20 days ago.
  -- slow = 1 + 0.28 + 0.46 = 1.74, so a gist unit is 17.4 days: anchor T0-3 owes nothing now
  -- and crosses one unit on the +30 advance (33/17.4 = 1.9).
  ('dev-memory-01', 'dev-user', 'dev-diary-01', '첫 발표를 망친 날',
   '첫 발표에서 목소리가 떨렸고 준비한 문장들이 순서를 잃었다. 회의실을 나와 옥상에서 오래 서 있었다.',
   '첫 발표에서 목소리가 떨렸고 준비한 문장들이 순서를 잃었다. 회의실을 나와 옥상에서 오래 서 있었다.',
   101, 'SAD', -0.78, 0.28, 0.7, 0.46, 0, CURRENT_DATE - 290, NULL,
   3, CURRENT_DATE - 33,
   '["발표를 망치고 옥상에서 오래 서 있던 날", "실패의 부끄러움이 오래 남은 기억", "서툴렀던 시작", "지나고 나서야 보이는 성장의 한 걸음"]'::jsonb,
   '["첫 발표에서 목소리가 xxxx 준비한 문장들이 순서를 잃었다. 회의실을 나와 xxxx 오래 서 있었다.",
     "첫 발표에서 xxxx xxxx 준비한 xxxx 순서를 잃었다. 회의실을 xxxx xxxx 오래 서 있었다.",
     "첫 xxxx xxxx xxxx xxxx xxxx 순서를 잃었다. 회의실을 xxxx xxxx xxxx 서 있었다.",
     "첫 xxxx xxxx xxxx xxxx xxxx xxxx 잃었다. 회의실을 xxxx xxxx xxxx xxxx 있었다."]'::jsonb,
   NULL),

  -- decay stage 3 + gist 4: both axes at their end. A maxed gist timer never rises again,
  -- so its anchor is inert.
  ('dev-memory-02', 'dev-user', 'dev-diary-01', '아무 말도 못한 회의',
   '부당하다고 느낀 회의에서 아무 말도 하지 못했다. 돌아오는 길 내내 화가 가라앉지 않았다.',
   '부당하다고 느낀 회의에서 아무 말도 하지 못했다. 돌아오는 길 내내 화가 가라앉지 않았다.',
   102, 'ANGER', -0.76, 0.86, 0.7, 0.69, 0, CURRENT_DATE - 290, NULL,
   4, CURRENT_DATE - 60,
   '["말하지 못한 채 화만 안고 돌아온 날", "삼킨 말이 남긴 응어리", "부당함 앞의 침묵", "말해야 할 때를 배운 기억"]'::jsonb,
   '["부당하다고 느낀 회의에서 xxxx 말도 하지 못했다. 돌아오는 길 xxxx 화가 가라앉지 않았다.",
     "부당하다고 xxxx 회의에서 xxxx xxxx 하지 못했다. 돌아오는 xxxx xxxx 화가 xxxx 않았다.",
     "부당하다고 xxxx xxxx xxxx xxxx xxxx 못했다. 돌아오는 xxxx xxxx xxxx xxxx 않았다."]'::jsonb,
   NULL),

  -- gist stage 4 + recall history: recalled 12 universe-days ago (decay reset, timer reset),
  -- reconsolidated once — current_text differs from source_text, 변천사 has 6 entries.
  ('dev-memory-03', 'dev-user', 'dev-diary-02', '긴 프로젝트의 끝',
   '석 달을 끌던 프로젝트가 끝난 날, 피곤함보다 홀가분함이 먼저 왔던 것 같다.',
   '석 달을 끌던 프로젝트가 드디어 끝났다. 몸이 텅 빈 것처럼 무거웠다.',
   103, 'TIRED', -0.55, 0.18, 0.7, 0.42, 5, CURRENT_DATE - 230, CURRENT_DATE - 42,
   4, CURRENT_DATE - 42,
   '["프로젝트가 끝나고 홀가분했던 날", "끝맺음이 준 안도감", "오래 끌던 일의 마무리", "끝은 늘 가벼움을 남긴다"]'::jsonb,
   NULL, NULL),

  -- decay stage 2 + gist 3, isolated island (여행/제주 neurons connect only to each other).
  -- slow = 2.58 -> a gist unit is 25.8 days; anchor T0-5 crosses one on the +30 advance.
  ('dev-memory-04', 'dev-user', 'dev-diary-02', '제주 밤길의 발소리',
   '제주 밤길에서 뒤따라오는 발소리에 심장이 내려앉았다. 골목 끝 편의점 불빛을 보고서야 숨을 골랐다.',
   '제주 밤길에서 뒤따라오는 발소리에 심장이 내려앉았다. 골목 끝 편의점 불빛을 보고서야 숨을 골랐다.',
   104, 'FEAR', -0.82, 0.88, 0.7, 0.70, 0, CURRENT_DATE - 230, NULL,
   3, CURRENT_DATE - 35,
   '["밤길의 발소리에 얼어붙었던 순간", "어둠 속에서 커지던 불안", "낯선 곳의 무서움", "무사히 지나간 밤"]'::jsonb,
   '["제주 밤길에서 뒤따라오는 발소리에 심장이 xxxx 골목 끝 편의점 불빛을 보고서야 숨을 골랐다.",
     "제주 밤길에서 xxxx 발소리에 xxxx xxxx 골목 끝 xxxx 불빛을 xxxx 숨을 골랐다."]'::jsonb,
   NULL),

  -- decay stage 1 + gist stage 2 — both axes at once.
  ('dev-memory-05', 'dev-user', 'dev-diary-03', '감나무 아래의 홍시',
   '할머니가 감나무 아래에서 홍시를 건네주셨다. 손이 따뜻했고 마당에는 늦가을 볕이 내려앉아 있었다.',
   '할머니가 감나무 아래에서 홍시를 건네주셨다. 손이 따뜻했고 마당에는 늦가을 볕이 내려앉아 있었다.',
   105, 'GRATITUDE', 0.76, 0.38, 0.7, 0.50, 0, CURRENT_DATE - 140, NULL,
   2, CURRENT_DATE - 35,
   '["감나무 아래에서 홍시를 받던 오후", "할머니의 따뜻한 손", "마당과 늦가을 볕의 기억", "돌봄받던 시절의 온기"]'::jsonb,
   '["할머니가 감나무 아래에서 홍시를 건네주셨다. 손이 xxxx 마당에는 늦가을 볕이 xxxx 있었다."]'::jsonb,
   NULL),

  -- decay stage 1 + gist stage 1.
  ('dev-memory-06', 'dev-user', 'dev-diary-03', '오랜 친구의 손편지',
   '오랜 친구에게서 손편지가 왔다. 저녁 내내 몇 번이고 다시 읽었다.',
   '오랜 친구에게서 손편지가 왔다. 저녁 내내 몇 번이고 다시 읽었다.',
   106, 'LOVE', 0.9, 0.66, 0.7, 0.61, 0, CURRENT_DATE - 140, NULL,
   1, CURRENT_DATE - 40,
   '["손편지를 몇 번이고 읽던 저녁", "멀리서도 이어져 있다는 감각", "오랜 우정의 증거", "곁에 남는 사람들"]'::jsonb,
   '["오랜 친구에게서 손편지가 왔다. 저녁 xxxx 몇 번이고 다시 읽었다."]'::jsonb,
   NULL),

  -- decay stage 1 + gist 1. slow = 1.66 -> a gist unit is 16.6 days.
  ('dev-memory-07', 'dev-user', 'dev-diary-04', '선선해진 저녁 마당',
   '저녁 바람이 선선해진 마당을 천천히 걸었다. 여름이 끝나가는 냄새가 났다.',
   '저녁 바람이 선선해진 마당을 천천히 걸었다. 여름이 끝나가는 냄새가 났다.',
   107, 'CALM', 0.62, 0.22, 0.7, 0.44, 0, CURRENT_DATE - 110, NULL,
   1, CURRENT_DATE - 33,
   '["선선한 저녁 마당을 걷던 시간", "계절이 바뀌는 냄새", "여름의 끝", "천천히 걷는 일의 평온"]'::jsonb,
   '["저녁 바람이 선선해진 마당을 천천히 걸었다. 여름이 xxxx 냄새가 났다."]'::jsonb,
   NULL),

  -- decay stage 1; NO gist ladder — the next advance records a PENDING rise and
  -- enqueues the semanticize worker (mock in dev) to regenerate the ladder.
  ('dev-memory-08', 'dev-user', 'dev-diary-04', '마감에 쫓긴 일주일',
   '일주일 내내 마감에 쫓겨 잠을 설쳤다. 해도 해도 일이 줄지 않았다.',
   '일주일 내내 마감에 쫓겨 잠을 설쳤다. 해도 해도 일이 줄지 않았다.',
   108, 'STRESS', -0.7, 0.78, 0.7, 0.66, 0, CURRENT_DATE - 110, NULL,
   0, CURRENT_DATE - 34,
   NULL,
   '["일주일 내내 마감에 쫓겨 잠을 설쳤다. 해도 xxxx 일이 줄지 않았다."]'::jsonb,
   NULL),

  -- dimmed but unredacted (stage 0, brightness ~0.78) + gist stage 1.
  ('dev-memory-09', 'dev-user', 'dev-diary-05', '아무 일도 없던 하루',
   '특별한 일 없이 지나간 하루였다. 저녁을 먹고 마당을 잠깐 바라봤다.',
   '특별한 일 없이 지나간 하루였다. 저녁을 먹고 마당을 잠깐 바라봤다.',
   109, 'NEUTRAL', 0, 0.5, 0.7, 0.55, 0, CURRENT_DATE - 60, NULL,
   1, CURRENT_DATE - 39,
   '["아무 일 없이 지나간 하루", "평범함의 조용한 결", "일상의 무게 없는 저녁", "그런 날들이 쌓여 삶이 된다"]'::jsonb,
   NULL, NULL),

  -- dimmed but unredacted + gist stage 1.
  ('dev-memory-10', 'dev-user', 'dev-diary-05', '바닷가 산책의 안도',
   '바닷가를 오래 걷고 나니 마음이 풀렸다. 걱정하던 일은 생각보다 작아 보였다.',
   '바닷가를 오래 걷고 나니 마음이 풀렸다. 걱정하던 일은 생각보다 작아 보였다.',
   110, 'RELIEF', 0.68, 0.3, 0.7, 0.47, 0, CURRENT_DATE - 60, NULL,
   1, CURRENT_DATE - 33,
   '["오래 걷고 나서 풀린 마음", "걱정이 작아 보이던 순간", "걷기가 주는 정리", "몸을 움직이면 마음도 움직인다"]'::jsonb,
   NULL, NULL),

  -- fresh & vivid; rises to gist 1 when the next diary advances the clock.
  ('dev-memory-11', 'dev-user', 'dev-diary-06', '장마 갠 아침의 달리기',
   '장마가 갠 아침, 해운대까지 달렸다. 공기가 씻은 듯 맑았다.',
   '장마가 갠 아침, 해운대까지 달렸다. 공기가 씻은 듯 맑았다.',
   111, 'JOY', 0.82, 0.72, 0.7, 0.64, 0, CURRENT_DATE - 30, NULL,
   0, NULL,
   '["비 갠 아침의 달리기", "맑은 공기를 가르던 몸", "장마 끝의 상쾌함", "달리며 얻는 아침의 기분"]'::jsonb,
   NULL, NULL),

  -- fresh & vivid, highest arousal — the biggest, brightest, slowest-fading star.
  ('dev-memory-12', 'dev-user', 'dev-diary-06', '밤바다의 불꽃',
   '밤바다 위로 불꽃이 터질 때마다 소리를 질렀다. 여름의 한가운데였다.',
   '밤바다 위로 불꽃이 터질 때마다 소리를 질렀다. 여름의 한가운데였다.',
   112, 'EXCITEMENT', 0.78, 0.9, 0.7, 0.71, 0, CURRENT_DATE - 30, NULL,
   0, NULL,
   '["밤바다의 불꽃을 보며 지르던 환호", "터지는 순간들의 짜릿함", "여름 한가운데의 열기", "함께 소리치던 밤"]'::jsonb,
   NULL, NULL),

  -- fresh & vivid, lowest arousal — the fastest to forget and to gist.
  ('dev-memory-13', 'dev-user', 'dev-diary-06', '이사 온 집의 첫 저녁',
   '이사 온 집의 첫 저녁, 짐 상자 사이에 앉아 있었다. 낯선 천장이 아직 내 것 같지 않았다.',
   '이사 온 집의 첫 저녁, 짐 상자 사이에 앉아 있었다. 낯선 천장이 아직 내 것 같지 않았다.',
   113, 'EMPTINESS', -0.68, 0.16, 0.7, 0.41, 0, CURRENT_DATE - 30, NULL,
   0, NULL,
   '["짐 상자 사이에 앉아 있던 첫 저녁", "낯선 집의 어색한 고요", "옮겨 온 삶의 시작", "새 공간이 내 것이 되기까지"]'::jsonb,
   NULL, NULL),

  -- released 5 real-clock days ago with its diary (dev-release-01): soft-deleted,
  -- 25 days left in the restore window.
  ('dev-memory-14', 'dev-user', 'dev-diary-07', '옛집의 마지막 밤',
   '옛집에서의 마지막 밤, 빈 방마다 불을 켜 보았다. 이사 상자들 사이에서 오래 서 있었다.',
   '옛집에서의 마지막 밤, 빈 방마다 불을 켜 보았다. 이사 상자들 사이에서 오래 서 있었다.',
   114, 'SAD', -0.78, 0.28, 0.7, 0.46, 0, CURRENT_DATE - 45, NULL,
   0, NULL, NULL, NULL, now() - interval '5 days');

-- membership edges (memory <-> neuron); weight 1.0 matches encode.activation_weight.
-- Sealed neurons keep their activations — the alive-predicate filters them at read time.
INSERT INTO neuron_activations (episodic_memory_id, neuron_id, user_id, weight) VALUES
  ('dev-memory-01', 'dev-neuron-09', 'dev-user', 1.0),
  ('dev-memory-01', 'dev-neuron-10', 'dev-user', 1.0),
  ('dev-memory-02', 'dev-neuron-07', 'dev-user', 1.0),
  ('dev-memory-02', 'dev-neuron-10', 'dev-user', 1.0),
  ('dev-memory-03', 'dev-neuron-07', 'dev-user', 1.0),
  ('dev-memory-03', 'dev-neuron-08', 'dev-user', 1.0),
  ('dev-memory-03', 'dev-neuron-10', 'dev-user', 1.0),
  ('dev-memory-04', 'dev-neuron-12', 'dev-user', 1.0),
  ('dev-memory-04', 'dev-neuron-13', 'dev-user', 1.0),
  ('dev-memory-05', 'dev-neuron-03', 'dev-user', 1.0),
  ('dev-memory-05', 'dev-neuron-04', 'dev-user', 1.0),
  ('dev-memory-05', 'dev-neuron-06', 'dev-user', 1.0),
  ('dev-memory-06', 'dev-neuron-11', 'dev-user', 1.0),
  ('dev-memory-06', 'dev-neuron-14', 'dev-user', 1.0),
  ('dev-memory-07', 'dev-neuron-02', 'dev-user', 1.0),
  ('dev-memory-07', 'dev-neuron-06', 'dev-user', 1.0),
  ('dev-memory-07', 'dev-neuron-14', 'dev-user', 1.0),
  ('dev-memory-08', 'dev-neuron-07', 'dev-user', 1.0),
  ('dev-memory-08', 'dev-neuron-10', 'dev-user', 1.0),
  ('dev-memory-09', 'dev-neuron-06', 'dev-user', 1.0),
  ('dev-memory-09', 'dev-neuron-14', 'dev-user', 1.0),
  ('dev-memory-10', 'dev-neuron-01', 'dev-user', 1.0),
  ('dev-memory-10', 'dev-neuron-14', 'dev-user', 1.0),
  ('dev-memory-11', 'dev-neuron-02', 'dev-user', 1.0),
  ('dev-memory-11', 'dev-neuron-05', 'dev-user', 1.0),
  ('dev-memory-12', 'dev-neuron-01', 'dev-user', 1.0),
  ('dev-memory-12', 'dev-neuron-05', 'dev-user', 1.0),
  ('dev-memory-13', 'dev-neuron-14', 'dev-user', 1.0),
  ('dev-memory-13', 'dev-neuron-16', 'dev-user', 1.0),
  ('dev-memory-14', 'dev-neuron-15', 'dev-user', 1.0),
  ('dev-memory-14', 'dev-neuron-16', 'dev-user', 1.0);

-- synapses: neuron<->neuron only, canonical a<b. dev-synapse-11 is the strong edge
-- (co-fired 3 times); dev-synapse-15 carries the release's -0.15 LTD (see delta below);
-- edges touching sealed neurons (12, 16) stay stored but are filtered at read time.
INSERT INTO synapses (id, user_id, neuron_a_id, neuron_b_id, strength, co_activation_count, last_activated_universe_time) VALUES
  ('dev-synapse-01', 'dev-user', 'dev-neuron-01', 'dev-neuron-02', 0.22, 1, CURRENT_DATE - 30),
  ('dev-synapse-02', 'dev-user', 'dev-neuron-01', 'dev-neuron-05', 0.44, 2, CURRENT_DATE - 30),
  ('dev-synapse-03', 'dev-user', 'dev-neuron-01', 'dev-neuron-14', 0.30, 1, CURRENT_DATE - 60),
  ('dev-synapse-04', 'dev-user', 'dev-neuron-02', 'dev-neuron-05', 0.32, 1, CURRENT_DATE - 30),
  ('dev-synapse-05', 'dev-user', 'dev-neuron-02', 'dev-neuron-06', 0.18, 1, CURRENT_DATE - 110),
  ('dev-synapse-06', 'dev-user', 'dev-neuron-02', 'dev-neuron-14', 0.24, 1, CURRENT_DATE - 110),
  ('dev-synapse-07', 'dev-user', 'dev-neuron-03', 'dev-neuron-04', 0.32, 1, CURRENT_DATE - 140),
  ('dev-synapse-08', 'dev-user', 'dev-neuron-03', 'dev-neuron-06', 0.28, 1, CURRENT_DATE - 140),
  ('dev-synapse-09', 'dev-user', 'dev-neuron-04', 'dev-neuron-06', 0.30, 1, CURRENT_DATE - 140),
  ('dev-synapse-10', 'dev-user', 'dev-neuron-06', 'dev-neuron-14', 0.26, 1, CURRENT_DATE - 60),
  ('dev-synapse-11', 'dev-user', 'dev-neuron-07', 'dev-neuron-10', 0.55, 3, CURRENT_DATE - 42),
  ('dev-synapse-12', 'dev-user', 'dev-neuron-09', 'dev-neuron-10', 0.20, 1, CURRENT_DATE - 290),
  ('dev-synapse-13', 'dev-user', 'dev-neuron-11', 'dev-neuron-14', 0.32, 1, CURRENT_DATE - 140),
  ('dev-synapse-14', 'dev-user', 'dev-neuron-12', 'dev-neuron-13', 0.32, 1, CURRENT_DATE - 230),
  ('dev-synapse-15', 'dev-user', 'dev-neuron-14', 'dev-neuron-16', 0.17, 1, CURRENT_DATE - 30),
  ('dev-synapse-16', 'dev-user', 'dev-neuron-15', 'dev-neuron-16', 0.32, 1, CURRENT_DATE - 45);

-- 변천사 (append-only). No 'created' rows — the created baseline is synthesized at read.
-- Semanticized rows carry their stage identity (one per stage, DB-guarded).
-- One row per already-risen stage, so 변천사 matches each memory's semantic_stage.
INSERT INTO memory_provenance (id, user_id, episodic_memory_id, kind, source, text, universe_time, semantic_stage) VALUES
  ('dev-prov-11', 'dev-user', 'dev-memory-01', 'semanticized',   'system', '발표를 망치고 옥상에서 오래 서 있던 날', CURRENT_DATE - 260, 1),
  ('dev-prov-12', 'dev-user', 'dev-memory-01', 'semanticized',   'system', '실패의 부끄러움이 오래 남은 기억',       CURRENT_DATE - 190, 2),
  ('dev-prov-13', 'dev-user', 'dev-memory-01', 'semanticized',   'system', '서툴렀던 시작',                        CURRENT_DATE - 120, 3),
  ('dev-prov-14', 'dev-user', 'dev-memory-02', 'semanticized',   'system', '말하지 못한 채 화만 안고 돌아온 날',     CURRENT_DATE - 250, 1),
  ('dev-prov-15', 'dev-user', 'dev-memory-02', 'semanticized',   'system', '삼킨 말이 남긴 응어리',                 CURRENT_DATE - 195, 2),
  ('dev-prov-16', 'dev-user', 'dev-memory-02', 'semanticized',   'system', '부당함 앞의 침묵',                      CURRENT_DATE - 140, 3),
  ('dev-prov-17', 'dev-user', 'dev-memory-02', 'semanticized',   'system', '말해야 할 때를 배운 기억',              CURRENT_DATE - 85,  4),
  ('dev-prov-18', 'dev-user', 'dev-memory-04', 'semanticized',   'system', '밤길의 발소리에 얼어붙었던 순간',        CURRENT_DATE - 190, 1),
  ('dev-prov-19', 'dev-user', 'dev-memory-04', 'semanticized',   'system', '어둠 속에서 커지던 불안',                CURRENT_DATE - 130, 2),
  ('dev-prov-20', 'dev-user', 'dev-memory-04', 'semanticized',   'system', '낯선 곳의 무서움',                      CURRENT_DATE - 70,  3),
  ('dev-prov-21', 'dev-user', 'dev-memory-07', 'semanticized',   'system', '선선한 저녁 마당을 걷던 시간',           CURRENT_DATE - 60,  1),
  ('dev-prov-01', 'dev-user', 'dev-memory-03', 'semanticized',   'system', '프로젝트가 끝나고 홀가분했던 날', CURRENT_DATE - 210, 1),
  ('dev-prov-02', 'dev-user', 'dev-memory-03', 'semanticized',   'system', '끝맺음이 준 안도감',             CURRENT_DATE - 190, 2),
  ('dev-prov-03', 'dev-user', 'dev-memory-03', 'semanticized',   'system', '오래 끌던 일의 마무리',           CURRENT_DATE - 170, 3),
  ('dev-prov-04', 'dev-user', 'dev-memory-03', 'semanticized',   'system', '끝은 늘 가벼움을 남긴다',         CURRENT_DATE - 150, 4),
  ('dev-prov-05', 'dev-user', 'dev-memory-03', 'reconsolidated', 'user',   '석 달을 끌던 프로젝트가 끝난 날, 피곤함보다 홀가분함이 먼저 왔던 것 같다.', CURRENT_DATE - 42, NULL),
  ('dev-prov-06', 'dev-user', 'dev-memory-05', 'semanticized',   'system', '감나무 아래에서 홍시를 받던 오후', CURRENT_DATE - 100, 1),
  ('dev-prov-07', 'dev-user', 'dev-memory-05', 'semanticized',   'system', '할머니의 따뜻한 손',              CURRENT_DATE - 65,  2),
  ('dev-prov-08', 'dev-user', 'dev-memory-06', 'semanticized',   'system', '손편지를 몇 번이고 읽던 저녁',     CURRENT_DATE - 80,  1),
  ('dev-prov-09', 'dev-user', 'dev-memory-09', 'semanticized',   'system', '아무 일 없이 지나간 하루',         CURRENT_DATE - 39,  1),
  ('dev-prov-10', 'dev-user', 'dev-memory-10', 'semanticized',   'system', '오래 걷고 나서 풀린 마음',         CURRENT_DATE - 42,  1);

-- The full-delete release ledger for dev-diary-07: restorable for another ~25 days.
-- The orphan '옛집' neuron seal is release-owned (sealed_at matches the group);
-- the shared '이사' neuron stays alive with a -0.15 LTD recorded on dev-synapse-15.
INSERT INTO release_groups (id, user_id, diary_id, deleted_at) VALUES
  ('dev-release-01', 'dev-user', 'dev-diary-07', now() - interval '5 days');
INSERT INTO release_memories (release_id, user_id, episodic_memory_id) VALUES
  ('dev-release-01', 'dev-user', 'dev-memory-14');
INSERT INTO release_sealed_neurons (release_id, user_id, neuron_id, sealed_at) VALUES
  ('dev-release-01', 'dev-user', 'dev-neuron-15', now() - interval '5 days');
INSERT INTO release_synapse_deltas (release_id, user_id, synapse_id, applied_delta) VALUES
  ('dev-release-01', 'dev-user', 'dev-synapse-15', 0.15);

-- Twinkle: a real GENERAL balance (additional) so purchases/gist views are testable;
-- SMALL (basic) derives from the daily grant. Ledger gives the history UI real rows.
INSERT INTO twinkle_balances (user_id, additional, basic_spent_this_window, basic_reset_window) VALUES
  ('dev-user', 1900, 0, CURRENT_DATE); -- folds from the ledger: 500+100+100+1500 earned - 300 spent
INSERT INTO twinkle_ledger_entries (id, user_id, kind, reason, amount, from_basic, from_additional, dedup_key, created_at) VALUES
  ('dev-ledger-01', 'dev-user', 'earn',  'signup_bonus',      500, 0,  0,   'dev-seed-signup',    now() - interval '60 days'),
  ('dev-ledger-02', 'dev-user', 'earn',  'write_diary',       100, 0,  0,   'dev-seed-write-1',   now() - interval '45 days'),
  ('dev-ledger-03', 'dev-user', 'earn',  'write_diary',       100, 0,  0,   'dev-seed-write-2',   now() - interval '30 days'),
  ('dev-ledger-04', 'dev-user', 'spend', 'recall',             15, 15, 0,   'dev-seed-recall-1',  now() - interval '12 days'),
  ('dev-ledger-05', 'dev-user', 'spend', 'gist_view',           7, 7,  0,   'dev-seed-gist-1',    now() - interval '12 days'),
  ('dev-ledger-06', 'dev-user', 'earn',  'admin_grant',      1500, 0,  0,   'dev-seed-grant',     now() - interval '10 days'),
  ('dev-ledger-07', 'dev-user', 'spend', 'ornament_purchase', 300, 0,  300, 'dev-seed-ornament',  now() - interval '8 days');

COMMIT;
