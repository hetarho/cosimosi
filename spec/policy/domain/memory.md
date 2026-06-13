# 기억·엔그램 (policy/domain/memory)

> 현재 구현된 기억(엔그램) 데이터 모델의 사실 정의.

## 정의

**기억(엔그램)** 은 사용자가 쓴 일기 한 편이 우주에 남기는 흔적이다. 한 편의 일기 = **불변 원본(record) 1행** + **가변 조각 별(memories) N행** + extract job 1건(→ 조각당 embed job 1건)으로 영속된다(21). 별은 원본을 `record_id`(non-unique FK)로 가리키는 가변 노드이고, 원본 일기 텍스트는 별도 테이블에 영구 불변으로 보관된다. 조각의 감정·강도·정서가는 **AI가 조각마다 감지**해 가변 별 레이어(memories)에 저장하며, 사용자의 수동 감정은 **선택적 전체-일기 힌트(prior)** 로 records에만 남는다.

기억은 **원본 → 조각 → 별**의 사슬로 구현된다: AI 추출 계층(아래 "AI 추출" 절)이 일기를 사건 경계로 나누고, extract 워커가 조각마다 별 1개를 fan-out한다(1일기→N별, 같은 일기 조각끼리 일내 시냅스 — synapse 정책 소관). 회상이 별을 다시 빚을 때마다 **append-only 변천사(`evolution_history`)** 에 한 시점이 쌓인다(아래 "변천사" 절; PE 게이트·재성형 식은 [star](star.md) 정책 소관). 변천사 타임랩스 UI는 plan 24에서 다룬다(아직 정책 아님).

## 규칙 · 파라미터

### 조각 데이터 모델 (1 record → N memories, 21)

| 겹 | 테이블 | 가변성 | 보유 컬럼 |
|---|---|---|---|
| 원본 record | `records` | 불변·영구(UPDATE/DELETE 쿼리 없음) | `body`·`entry_date`·`idempotency_key` + 선택 힌트 `mood`·`intensity`·`valence` |
| 조각 별 memory | `memories` | 가변 | `record_id`(NOT NULL non-unique FK)·`fragment_index`(0-based)·`fragment_text`·`mood`·`intensity`·`valence`·`last_recalled_at` + 재성형 상태 `brightness_offset`·`hue_shift`·`form_seed_delta`·`version`(23) |
| 변천사 snapshot | `evolution_history` | **append-only**(INSERT 전용·UPDATE/DELETE 없음) | `memory_id`·`user_id`·`version`·`brightness`·`hue_shift`·`form_seed_delta`·`trigger`·`pe`·`dir`·`created_at`(23) |

- 참조 방향은 **`memories.record_id → records.id` 단방향**이다(별이 원본을 가리키며, records에 memory_id 컬럼은 없다). `UNIQUE (record_id, fragment_index)` — 같은 일기의 같은 조각은 정확히 1행(이중 fan-out 펜스).
- **조각별 감정(`mood`·`intensity`·`valence`)과 조각 텍스트(`fragment_text`)는 가변 `memories`에 산다**(불변 record에 조각 데이터를 두면 헌법1 위반). 별 투영(GetUniverse·ListDormant)은 memories만 읽고, 원본 열람(RecallMemory)만 records JOIN으로 body를 읽는다.
- `fragment_text`는 임베딩용 조각 텍스트이고 NULL이면 `r.body` fallback(21 이전 별·단일 조각 경로). 원본 body의 편집본이 아니다.
- 임베딩은 별 1개당 1행(`embeddings.memory_id` PRIMARY KEY → `memories.id`), `vector(1536)` — **조각마다 따로 임베딩**된다. 임베딩 생성은 비동기 `jobs`(`kind='embed'`)로 적재만 한다.
- `memories.visual_spec`(JSONB)은 nullable·미사용이다 — 별 형태는 클라가 `memory_id` 시드로 결정론적 파생한다(조각도 동일: `seed = seedFromId(memory_id)`).

### 조각 fan-out (extract 워커, 21)

| 규칙 | 값 / 조건 |
|---|---|
| 적재 | `RecordMemory` 트랜잭션은 record 1행 + `jobs(kind='extract', record_id, user_id, memory_id NULL)` 1건만 쓴다(별은 아직 없음) |
| job 키잉 | embed job = `memory_id`, extract job = `record_id`(+`user_id`는 27 consolidate 예비). `jobs.memory_id`는 nullable |
| fan-out | extract 워커가 `Extractor.Extract(body)` → 조각마다 `memories` 1행 + embed job 1건 + 일내 시냅스(모든 조각 쌍, synapse 정책)를 **한 트랜잭션**으로 — 부분 실패는 전체 롤백 |
| 멱등 | record에 조각이 이미 있으면 fan-out은 기존 id를 돌려주는 no-op(재시도·lease 재클레임 안전). `UNIQUE (record_id, fragment_index)`가 동시 이중 실행 펜스 |
| 클레임 순서 | 워커는 extract job을 embed보다 먼저 claim한다(조각이 있어야 embed가 생긴다) |
| 응답 계약 | `RecordMemoryResponse{record_id, repeated memory_ids}` — `memory_ids`는 보통 빈 배열(조각은 다음 `GetUniverse` refetch로 도착, 헌법6). 멱등 재호출이면 이미 fan-out된 조각 id들 |

### 감정 입력 (AI 감지 기본 + 수동 힌트 fallback, 21)

| 값 | 출처 | 저장 |
|---|---|---|
| 조각 `mood`·`intensity`·`valence` | **AI 추출(조각마다 감지)** — mock 추출기는 neutral | `memories`(조각 행) |
| 수동 힌트 `mood`·`intensity`·`valence` | MemoryForm의 접힌 "수동 감정" 토글(기본 off; 13종 select + 강도 슬라이더) | `records`(nullable — 전체-일기 prior) |

- 폼의 기본은 **감정 입력 없음**(본문+날짜만). 수동 토글이 켜졌을 때만 힌트가 전송된다.
- 힌트는 **추출이 단일-중립-조각 폴백 형태로 강등됐을 때만** 조각에 적용된다(`applyManualHint`: 1조각 ∧ mood neutral/빈 값 ∧ valence 0). 실제 다조각·정동 감지 결과를 힌트가 덮어쓰지 않는다.
- 도메인 `Mood`는 13종(29) + 빈 값(MoodUnspecified). 핸들러가 proto `Mood` enum ↔ 도메인 문자열을 매핑하고, 빈 Mood는 NULL로 저장한다.
- `Star` DTO는 `valence`(double, 필드 12)를 실어 나른다(26이 λ_eff에 소비; 필드 5–11은 23/28/36 예약).

### AI 추출 (사건-경계 분할 — 추출 계층)

일기 텍스트를 **사건 경계(Event Segmentation Theory)** 기준 1~N개 조각으로 분절하고 조각마다 감정·강도·정서가·개체를 뽑는 추출 계층. 추출 결과는 extract 워커가 조각 별로 fan-out한다(위 "조각 fan-out" 절, 21).

| 규칙 | 값 / 조건 |
|---|---|
| 포트 | `ai.Extractor.Extract(ctx, text) → ai.Extraction{Segments ≥ 1}` — 순수 도메인(태그·`internal/memory` import 없음) |
| 분절 루브릭 | 장소·사람·활동(목표)·주제·감정 톤 중 ≥1 전환 시 새 조각; 전환 0 또는 <60단어 → 1조각; 대략 80~120단어당 1조각 |
| 조각 수 | `[1,5]` 클램프(상한 8 이내) — 초과분은 **마지막 조각에 병합**(텍스트 무손실), 코드가 항상 재적용 |
| 조각 감정 모델 | `Mood` 13종(29 — 색/UX 레이어, 사분면-우선 선택·tie-break·한국어 정동 레시피는 29 가이드라인을 프롬프트로 사용) · `Intensity ∈ [0,1]` = arousal(기억 무게) · `Valence ∈ [-1,1]` = 부호 있는 정서가(0=중립; 영속·물리 소비는 21·26) |
| 견고성 | 응답은 파싱→화이트리스트→클램프(intensity `[0,1]`·valence `[-1,1]`·NaN→0)→Index 0-based 재부여; **어떤 깨짐이든 단일 조각 폴백**(전체 원문·neutral·valence 0) — 에러가 아닌 정상 경로. 전송 실패만 에러(워커 백오프) |
| 어댑터 선택 | env 노브 없음(34) — admin 콘솔의 활성 LLM 선택을 따른다: 활성이면 실 LLM, 없으면 키리스 mock(결정론적 문단/문장 분절·neutral). admin 배선 없는 단독 도구·테스트는 mock 고정 |
| LLM 공급자 추상화 | `internal/llm`의 단일 `llm.Client` 포트 뒤에서 공급자(openai\|gemini\|claude\|deepseek\|grok)·모델·키를 admin 콘솔에서 교체(헌법7·34). 기본 모델 gpt-5.4-mini / gemini-3.5-flash / claude-opus-4-8 / deepseek-v4-flash / grok-4.3, 모델 오버라이드는 콘솔 selection |
| 조각 시드 | `ai.SegmentSeed(diaryID, fragmentIndex, text) = FNV64a(diary_id:idx:sha1(normalize(text)))` — 결정론적(21이 별 형태/좌표 시드로 소비) |
| 비용 가드 | 입력 4000 runes 절단(임베더 캡 미러)·텍스트 해시 캐시·`ExtractMetrics`(임베딩 `Metrics`와 분리 계측) |

### 변천사 (evolution_history — append-only, 23)

회상이 PE 게이트를 통과해 별을 다시 빚을 때마다(재성형 식은 [star](star.md) 정책) 그 시점 한 줄이 `evolution_history`에 **추가만** 된다. 별의 누적 상태(`memories`의 `brightness_offset` 등)는 *현재 모습*을, 변천사는 *지나온 모든 모습*을 담는다.

| 규칙 | 값 / 조건 |
|---|---|
| append-only | INSERT 전용 — `evolution_history` 행을 UPDATE/DELETE하는 쿼리·메서드를 일절 두지 않는다(헌법1·2). `AppendEvolution`이 유일한 쓰기 |
| 한 회상 = 변형된 별마다 1행 | 회상 별 + 직접 이웃이 재성형될 때 각자 `{version, brightness, hue_shift, form_seed_delta, trigger='recall', pe, dir}` 1행. PE 미달(novelty 없음)이면 0행 |
| 정렬·격리 | `GetEvolutionHistory`는 `(memory_id, user_id)`로 `version` 오름차순 반환(`evolution_history_memory_idx`); user_id 격리 |
| trigger 종류 | `'recall'`(23) · `'new_neighbor'`/`'nightly_gist'`는 예약(야간 요지화는 27) |
| 서버 ID | `evolution_history.id`는 서버 생성(클라는 ID를 만들지 않는다) |

### 기록·조회 RPC

| RPC | 동작 | 멱등 |
|---|---|---|
| `RecordMemory` | 단일 트랜잭션 record→extract job: `records` 1행(불변) + `jobs` 1행(`kind='extract'`, `status='pending'`) → `{record_id, memory_ids}` 반환(`memory_ids`는 보통 빈 배열 — 조각은 비동기 도착) | `(user_id, idempotency_key)` 부분 UNIQUE — 재호출 시 기존 record id + 이미 fan-out된 조각 id들 |
| `GetUniverse` | 사용자의 모든 별 + 모든 시냅스 반환(잠든 것 포함), `last_recalled_at`/`last_activated_at`은 raw 값 | — |
| `RecallMemory` | 별 재점화(`memories.last_recalled_at = now()`) + PE 게이트 재성형(통과 시 회상 별+직접 이웃의 재성형 상태 갱신 + 변천사 append, [star](star.md) 정책) + 불변 원본 Record 반환. 원본 records는 불변(헌법1) | — |
| `ListDormant` | 오래 회상 안 한 별만 반환(검색 보조용, 전체 그래프는 GetUniverse가 그대로 반환) | — |
| `GetEvolutionHistory` | 한 별의 변천사를 `version` 오름차순 반환(읽기; UI는 24) | — |

- 서버 권위 ID: `record_id`/`memory_id`는 서버가 생성한다(클라는 ID를 만들지 않는다).
- `entry_date`가 비면 service가 `now()`(UTC)로 기본 채운다. 클라 폼 기본값은 로컬 오늘 날짜.
- 응답은 별의 `last_recalled_at`·시냅스의 `weight`/`last_activated_at`을 raw로만 싣는다 — 밝기·활성도·좌표는 서버가 계산하지 않는다(헌법2·3).

### RecordMemory 입력 검증 (17)

records는 append-only(헌법1)라 **쓰기 전 검증이 유일한 방어선**이다 — 통과 못 하면 record/memory/job 어느 것도 생성되지 않는다(임베딩 비용 0). service 레이어가 검증하고 핸들러가 `InvalidArgument`로 매핑하며, FE는 그 sentinel 문구로 한국어 카피를 고른다(서버 테스트가 문구를 핀으로 고정).

| 규칙 | 값 / 조건 |
|---|---|
| 빈 본문 거부 | `TrimSpace(body) == ""` → `ErrEmptyBody`. 클라 폼도 사전 차단 |
| 본문 길이 상한 | `4000 runes`(`memory.MaxBodyRunes`) — 임베더 절단 상한(`ai maxInputRunes`)과 정렬(테스트 가드: 임베더 캡 ≥ 검증 캡). 클라도 4,000자 사전 차단 + 초과 시 "일기가 너무 길어요" 카피 |
| 강도 범위 | `intensity ∈ [0,1]`, NaN 거부 → `ErrIntensityRange` (별 크기 셰이더 `f(intensity)` 계약 보호) |
| 정서가 범위 | `valence ∈ [-1,1]`, NaN 거부 → `ErrValenceRange` (21 — 수동 힌트도 같은 검증) |
| 날짜 형식 | `entry_date`는 `YYYY-MM-DD` 또는 빈 값(핸들러 검증, 기존) |

### 멱등성 · 격리

| 규칙 | 값 |
|---|---|
| RecordMemory 멱등 | `records (user_id, idempotency_key)` 부분 UNIQUE(`idempotency_key IS NULL`이면 제약 없음) → 재호출 시 기존 `record_id`(+이미 fan-out된 조각 id들) 반환, 새 행 미생성 |
| fan-out 멱등 | record에 조각이 존재하면 extract fan-out은 no-op(기존 id 반환); `memories UNIQUE (record_id, fragment_index)`가 동시 이중 실행 펜스 |
| 회상 강화 멱등 | `processed_batches.batch_id` PRIMARY KEY — 이미 본 `batch_id`면 재가산 skip(공동 회상 강화는 synapse 정책 소관) |
| user_id 격리 | 모든 도메인 테이블에 `user_id`; 모든 record/memory/universe/recall/dormant 쿼리가 `WHERE user_id = $ctx`로 스코프(인터셉터가 컨텍스트 user_id 주입). RLS 아님 — WHERE + 인터셉터 |

## 불변식 (invariants)

- **헌법1 — 원본 불변·영구.** `records`에 대한 UPDATE/DELETE 쿼리·핸들러·service 메서드를 일절 두지 않는다(`db/queries/*.sql`에 `UPDATE records`/`DELETE FROM records` 없음). 회상·재성형 시에도 가변 별(`memories`)의 `last_recalled_at`·재성형 상태만 갱신하고 원본은 한 글자도 바뀌지 않는다.
- **헌법1·2 — 변천사 append-only.** `evolution_history`는 INSERT만 한다 — 행 UPDATE/DELETE 쿼리가 없다(append-only 로그). 재성형 누적으로도 별·시냅스 행은 삭제되지 않고 유효 밝기는 `A_MIN` 바닥 위로 유지된다.
- **헌법2 — 별·시냅스 행 삭제 금지.** `ListDormant`는 검색 보조일 뿐 삭제/필터가 아니며, `GetUniverse`는 잠든 별·시냅스를 포함한 전체 그래프를 그대로 반환한다.
- **헌법3 — 좌표는 서버에 없다.** 서버는 가중치 그래프만 권위로 저장하고, 별/시냅스의 좌표·밝기는 저장·반환하지 않는다.
- **헌법5 — proto DTO·도메인 순수·sqlc.** 도메인 타입(`RecordInput`/`Memory`/`Synapse`/`Universe`/`Record`/`LinkDelta`)에 `json:`/`db:`/proto 태그 금지 — proto는 전송 DTO, sqlc row는 영속, 핸들러/repository가 매핑한다.
- **헌법6 — unary.** 모든 memory RPC는 unary다.
- **단방향 참조.** `memories.record_id → records.id` 단방향이며 records에는 memory_id가 없다. 임베딩은 별 1개당 정확히 1행.

## 구현 근거

- 구현: plan 03 · `backend/internal/db/migrations/00001_engram_schema.sql` — records/memories/embeddings/memory_links/jobs/processed_batches 6테이블 단일 권위 DDL, 멱등 부분 UNIQUE, user_id 격리.
- 구현: plan 04 · `backend/internal/db/queries/memory.sql`, `backend/internal/memory/{memory.go,handler.go,service.go,repository_pg.go}` — RecordMemory(record→memory→job 트랜잭션, 서버 권위 ID, 멱등 반환)·GetUniverse·RecallMemory·ListDormant, 도메인 무태그.
- 구현: plan 10 · `frontend/src/features/record-memory/ui/MemoryForm.tsx`, `frontend/src/features/record-memory/model/draft-store.ts` — 기록 폼·드래프트(21이 본문+날짜 기본 + 접힌 수동 감정 토글로 재구성).
- 구현: plan 17 · `backend/internal/memory/{memory.go,service.go,handler.go,service_test.go}`(검증 sentinel·InvalidArgument 매핑·문구 핀), `backend/internal/ai/limits_test.go`(캡 정렬 가드), `frontend/src/features/record-memory/{api/record-memory.ts,model/use-record-memory.ts}`(사전 차단 + 한국어 카피 매핑).
- 구현: plan 20 · `backend/internal/ai/{embedder.go(Extraction/Segment/Mood),extractor.go(검증·폴백),mock_extractor.go,llm_extractor.go(프롬프트·스키마),seed.go,factory.go(NewExtractor),metrics.go(ExtractMetrics)}`, `backend/internal/llm/{llm.go,openai_compat.go,anthropic.go,gemini.go,factory.go}`(5 공급자 env 교체) — AI 추출 계층(분절·감정·시드·공급자 추상화).
- 구현: plan 21 · `backend/internal/db/migrations/00004_memory_fragmentation.sql`(memories 조각 컬럼·jobs 키잉·UNIQUE 펜스·백필), `backend/internal/job/{job.go,worker.go(handleExtract·applyManualHint),repository_pg.go(FanOutFragments 한 tx)}`, `backend/internal/memory/{repository_pg.go(record+extract job),service.go(valence 검증),handler.go(record_id+memory_ids·Star.valence)}`, `frontend/src/features/record-memory/*`(segmenting 흐름·수동 토글), `frontend/src/shared/lib/demo/data.ts`(데모 분절 근사) — 조각 fan-out(1일기→N별)·조각별 감정 영속.
- 구현: plan 23 · `backend/internal/db/migrations/00005_reconsolidation.sql`(`evolution_history` append-only + memories 재성형 4컬럼), `backend/internal/db/queries/memory.sql`(`GetReshapeContext`·`ListDirectNeighbors`·`ApplyReshape`·`AppendEvolution`·`GetEvolutionHistory`), `backend/internal/memory/{memory.go,repository_pg.go,service.go(reconsolidate),handler.go(GetEvolutionHistory·Star 재성형 4필드)}` — PE 게이트 재성형 + append-only 변천사(재성형 식·렌더 합성은 [star](star.md)).
