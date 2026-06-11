# 기억·엔그램 (policy/domain/memory)

> 현재 구현된 기억(엔그램) 데이터 모델의 사실 정의.

## 정의

**기억(엔그램)** 은 사용자가 쓴 일기 한 편이 우주에 남기는 흔적이다. 한 편의 일기 = **불변 원본(record) 1행** + **가변 별(memory) 1행** + 임베딩 생성 job 1건으로 영속된다. 별은 원본을 `record_id`로 가리키는 가변 노드이고, 원본 일기 텍스트는 별도 테이블에 영구 불변으로 보관된다. 별의 감정·강도는 **사용자가 직접 고른 값**이며, 그 값은 원본(records)에만 저장되고 별은 JOIN으로 읽는다.

기억은 현재 **2겹**(불변 record + 가변 memories)으로 구현된다. **AI 추출 계층(사건-경계 분할 + 조각별 감정·강도·정서가)은 구현되어 있으나**(아래 "AI 추출" 절), 그 결과를 별로 펼치는 fan-out(1일기→N별·`extract` job 적재)과 변천사(evolution_history)·재성형은 plan 21·23·24에서 다룬다(아직 정책 아님 — 현재 일기 1편 = 별 1개 그대로).

## 규칙 · 파라미터

### 2겹 데이터 모델

| 겹 | 테이블 | 가변성 | 보유 컬럼 |
|---|---|---|---|
| 원본 record | `records` | 불변·영구(UPDATE/DELETE 쿼리 없음) | `body`·`entry_date`·`mood`·`intensity`·`idempotency_key` |
| 별 memory | `memories` | 가변 | `record_id`(NOT NULL FK)·`last_recalled_at` |

- 참조 방향은 **`memories.record_id → records.id` 단방향**이다(별이 원본을 가리키며, records에 memory_id 컬럼은 없다).
- `mood`·`intensity`·`entry_date`·`body`는 **`records`에만** 존재한다. 별 투영(GetUniverse·ListDormant·RecallMemory)이 이 값을 쓸 때는 `memories m JOIN records r ON r.id = m.record_id` 경로로 읽는다(memories에 중복 컬럼을 두지 않는다 — 헌법1).
- 임베딩은 별 1개당 1행(`embeddings.memory_id` PRIMARY KEY → `memories.id`), `vector(1536)`. 임베딩 생성은 비동기 `jobs`(`kind='embed'`)로 적재만 한다.
- `memories.visual_spec`(JSONB)은 nullable·미사용이다 — 별 형태는 클라가 `memory_id` 시드로 결정론적 파생한다.

### 감정 입력 (사용자 직접 선택)

| 값 | 출처 | 저장 |
|---|---|---|
| `mood` | MemoryForm의 `<select>`(7종: JOY/CALM/SAD/ANGER/FEAR/LOVE/NEUTRAL) | `records.mood`(nullable, 빈 값→NULL) |
| `intensity` | MemoryForm의 슬라이더(0~1, step 0.01) | `records.intensity`(nullable REAL) |

- 감정·강도는 **사용자가 폼에서 직접 고른다**(AI 감정 감지가 아니다).
- 도메인 `Mood`는 7종(joy/calm/sad/anger/fear/love/neutral) + 빈 값(MoodUnspecified). 핸들러가 proto `Mood` enum ↔ 도메인 문자열을 매핑하고, 빈 Mood는 NULL로 저장한다.

### AI 추출 (사건-경계 분할 — 추출 계층)

일기 텍스트를 **사건 경계(Event Segmentation Theory)** 기준 1~N개 조각으로 분절하고 조각마다 감정·강도·정서가·개체를 뽑는 추출 계층. ⚠️ **추출 결과는 아직 별로 펼쳐지지 않는다** — `RecordMemory`는 `extract` job을 적재하지 않으며(`job.KindExtract`는 정의만, 워커 스텁 no-op), fan-out은 plan 21이 연결한다.

| 규칙 | 값 / 조건 |
|---|---|
| 포트 | `ai.Extractor.Extract(ctx, text) → ai.Extraction{Segments ≥ 1}` — 순수 도메인(태그·`internal/memory` import 없음) |
| 분절 루브릭 | 장소·사람·활동(목표)·주제·감정 톤 중 ≥1 전환 시 새 조각; 전환 0 또는 <60단어 → 1조각; 대략 80~120단어당 1조각 |
| 조각 수 | `[1,5]` 클램프(상한 8 이내) — 초과분은 **마지막 조각에 병합**(텍스트 무손실), 코드가 항상 재적용 |
| 조각 감정 모델 | `Mood` 13종(29 — 색/UX 레이어, 사분면-우선 선택·tie-break·한국어 정동 레시피는 29 가이드라인을 프롬프트로 사용) · `Intensity ∈ [0,1]` = arousal(기억 무게) · `Valence ∈ [-1,1]` = 부호 있는 정서가(0=중립; 영속·물리 소비는 21·26) |
| 견고성 | 응답은 파싱→화이트리스트→클램프(intensity `[0,1]`·valence `[-1,1]`·NaN→0)→Index 0-based 재부여; **어떤 깨짐이든 단일 조각 폴백**(전체 원문·neutral·valence 0) — 에러가 아닌 정상 경로. 전송 실패만 에러(워커 백오프) |
| 어댑터 선택 | `AI_EXTRACTOR=mock`(기본 — 키리스·결정론적 문단/문장 분절·neutral) \| `llm`(실 LLM) |
| LLM 공급자 추상화 | `internal/llm`의 단일 `llm.Client` 포트 뒤에서 `LLM_PROVIDER=openai\|gemini\|claude\|deepseek\|grok` env로 교체(헌법7). 기본 모델 gpt-5.4-mini / gemini-3.5-flash / claude-opus-4-8 / deepseek-v4-flash / grok-4.3, `LLM_MODEL`로 오버라이드. 키 없으면 fail-fast |
| 조각 시드 | `ai.SegmentSeed(diaryID, fragmentIndex, text) = FNV64a(diary_id:idx:sha1(normalize(text)))` — 결정론적(21이 별 형태/좌표 시드로 소비) |
| 비용 가드 | 입력 4000 runes 절단(임베더 캡 미러)·텍스트 해시 캐시·`ExtractMetrics`(임베딩 `Metrics`와 분리 계측) |

### 기록·조회 RPC

| RPC | 동작 | 멱등 |
|---|---|---|
| `RecordMemory` | 단일 트랜잭션 record→memory→job: `records` 1행(불변) + `memories` 1행(`record_id` 연결) + `jobs` 1행(`kind='embed'`, `status='pending'`) → 새 `memory_id` 반환 | `(user_id, idempotency_key)` 부분 UNIQUE |
| `GetUniverse` | 사용자의 모든 별 + 모든 시냅스 반환(잠든 것 포함), `last_recalled_at`/`last_activated_at`은 raw 값 | — |
| `RecallMemory` | 별 재점화(`memories.last_recalled_at = now()`만 갱신) + 불변 원본 Record 반환 | — |
| `ListDormant` | 오래 회상 안 한 별만 반환(검색 보조용, 전체 그래프는 GetUniverse가 그대로 반환) | — |

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
| 날짜 형식 | `entry_date`는 `YYYY-MM-DD` 또는 빈 값(핸들러 검증, 기존) |

### 멱등성 · 격리

| 규칙 | 값 |
|---|---|
| RecordMemory 멱등 | `records (user_id, idempotency_key)` 부분 UNIQUE(`idempotency_key IS NULL`이면 제약 없음) → 재호출 시 기존 `memory_id` 반환, 새 행 미생성 |
| 회상 강화 멱등 | `processed_batches.batch_id` PRIMARY KEY — 이미 본 `batch_id`면 재가산 skip(공동 회상 강화는 synapse 정책 소관) |
| user_id 격리 | 모든 도메인 테이블에 `user_id`; 모든 record/memory/universe/recall/dormant 쿼리가 `WHERE user_id = $ctx`로 스코프(인터셉터가 컨텍스트 user_id 주입). RLS 아님 — WHERE + 인터셉터 |

## 불변식 (invariants)

- **헌법1 — 원본 불변·영구.** `records`에 대한 UPDATE/DELETE 쿼리·핸들러·service 메서드를 일절 두지 않는다(`db/queries/*.sql`에 `UPDATE records`/`DELETE FROM records` 없음). 회상 시에도 `memories.last_recalled_at`만 갱신하고 원본은 한 글자도 바뀌지 않는다.
- **헌법2 — 별·시냅스 행 삭제 금지.** `ListDormant`는 검색 보조일 뿐 삭제/필터가 아니며, `GetUniverse`는 잠든 별·시냅스를 포함한 전체 그래프를 그대로 반환한다.
- **헌법3 — 좌표는 서버에 없다.** 서버는 가중치 그래프만 권위로 저장하고, 별/시냅스의 좌표·밝기는 저장·반환하지 않는다.
- **헌법5 — proto DTO·도메인 순수·sqlc.** 도메인 타입(`RecordInput`/`Memory`/`Synapse`/`Universe`/`Record`/`LinkDelta`)에 `json:`/`db:`/proto 태그 금지 — proto는 전송 DTO, sqlc row는 영속, 핸들러/repository가 매핑한다.
- **헌법6 — unary.** 모든 memory RPC는 unary다.
- **단방향 참조.** `memories.record_id → records.id` 단방향이며 records에는 memory_id가 없다. 임베딩은 별 1개당 정확히 1행.

## 구현 근거

- 구현: plan 03 · `backend/internal/db/migrations/00001_engram_schema.sql` — records/memories/embeddings/memory_links/jobs/processed_batches 6테이블 단일 권위 DDL, 멱등 부분 UNIQUE, user_id 격리.
- 구현: plan 04 · `backend/internal/db/queries/memory.sql`, `backend/internal/memory/{memory.go,handler.go,service.go,repository_pg.go}` — RecordMemory(record→memory→job 트랜잭션, 서버 권위 ID, 멱등 반환)·GetUniverse·RecallMemory·ListDormant, 도메인 무태그.
- 구현: plan 10 · `frontend/src/features/record-memory/ui/MemoryForm.tsx`, `frontend/src/features/record-memory/model/draft-store.ts` — 본문 + mood select + intensity 슬라이더 + 날짜 → 단일 별 기록 폼.
- 구현: plan 17 · `backend/internal/memory/{memory.go,service.go,handler.go,service_test.go}`(검증 sentinel·InvalidArgument 매핑·문구 핀), `backend/internal/ai/limits_test.go`(캡 정렬 가드), `frontend/src/features/record-memory/{api/record-memory.ts,model/use-record-memory.ts}`(사전 차단 + 한국어 카피 매핑).
- 구현: plan 20 · `backend/internal/ai/{embedder.go(Extraction/Segment/Mood),extractor.go(검증·폴백),mock_extractor.go,llm_extractor.go(프롬프트·스키마),seed.go,factory.go(NewExtractor),metrics.go(ExtractMetrics)}`, `backend/internal/llm/{llm.go,openai_compat.go,anthropic.go,gemini.go,factory.go}`(5 공급자 env 교체), `backend/internal/job/{job.go(KindExtract),worker.go(스텁)}` — AI 추출 계층(분절·감정·시드·공급자 추상화).
