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
| 조각 별 memory | `memories` | 가변 | `record_id`(NOT NULL non-unique FK)·`fragment_index`(0-based)·`fragment_text`·`mood`·`intensity`·`valence`·`last_recalled_at`·`recall_count`(07, 회상마다 +1) + 재성형 상태 `brightness_offset`·`hue_shift`·`form_seed_delta`·`version`(23) |
| 변천사 snapshot | `evolution_history` | **append-only**(INSERT 전용·UPDATE/DELETE 없음) | `memory_id`·`user_id`·`version`·`brightness`·`hue_shift`·`form_seed_delta`·`trigger`·`pe`·`dir`·`created_at`(23) + `content`(54, AI 내용 변형 텍스트 — `'ai_rewrite'` 행만 채움) |

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

### 공명 별 생성 경로 (gift 수락 = 재작성, 36)

일반 일기(21)는 **원본→AI 추출→N 조각 별**의 경로지만, 친구의 별을 수락(재작성)할 때 태어나는 별은 **다른 경로**다 — 한 사건의 한 기억이므로 추출(분절) 없이 **단일 조각 별**로 저장한다.

| 항목 | 일반 일기(21) | 공명 별(36, gift 수락) |
|---|---|---|
| 진입 | `RecordMemory`(extract job→비동기 fan-out) | `AcceptStarGift`(동기, 한 트랜잭션) |
| 조각 분절 | AI 추출 1~N조각 | **추출 생략** — 항상 단일 조각(`fragment_index=0`) |
| 트랜잭션 | record + extract job | record(불변) + **단일 조각 별** + `resonances` 쌍 + embed job — 부분 실패 전체 롤백 |
| 코어 재사용 | `db/fragment.FanOutTx` | **같은 `FanOutTx`**(조각 1개 — InsertMemory + embed job, 일내 시냅스 없음) → 일반 경로와 그래프 토폴로지가 절대 어긋나지 않음 |
| 감정 | AI 감지 | **수신자가 직접 입력**(13감정·강도·정서가) — record 힌트 + 조각 양쪽에 둔다 |

- 수신자의 재작성 텍스트는 그의 **불변 record body**(헌법1)이자 그 단일 조각의 `fragment_text`다.
- 두 별(보낸 별·태어난 별)은 `resonances`(memory↔memory, gift당 1쌍·UNIQUE)로 이어지되 **상태는 비전파** — 각자의 우주에서 따로 회상·재성형되고 따로 변천사를 쌓는다(공명 규칙 상세는 [sharing](sharing.md)).

### 감정 입력 (AI 감지 기본 + 수동 힌트 fallback, 21)

| 값 | 출처 | 저장 |
|---|---|---|
| 조각 `mood`·`intensity`·`valence` | **AI 추출(조각마다 감지)** — mock 추출기는 neutral | `memories`(조각 행) |
| 수동 힌트 `mood`·`intensity`·`valence` | MemoryForm의 접힌 "수동 감정" 토글(기본 off; 13종 select + 강도 슬라이더) | `records`(nullable — 전체-일기 prior) |

- 폼의 기본은 **감정 입력 없음**(본문+날짜만). 수동 토글이 켜졌을 때만 힌트가 전송된다.
- 힌트는 **추출이 단일-중립-조각 폴백 형태로 강등됐을 때만** 조각에 적용된다(`applyManualHint`: 1조각 ∧ mood neutral/빈 값 ∧ valence 0). 실제 다조각·정동 감지 결과를 힌트가 덮어쓰지 않는다.
- 도메인 `Mood`는 13종(29) + 빈 값(MoodUnspecified). 핸들러가 proto `Mood` enum ↔ 도메인 문자열을 매핑하고, 빈 Mood는 NULL로 저장한다.
- `Star` DTO는 `valence`(double, 필드 12)를 실어 나른다(26이 λ_eff에 소비). 필드 5–8=재성형(23)·**9·10=`record_id`/`fragment_index`(28)**·**11=`resonant`(bool, 36 — `GetUniverse`가 `resonances` 조인으로 채움; 공개 우주엔 부재)**·14=`recall_count`(07)·**15=`abstraction_stage`(53, 야간 요지가 승급·클라가 형태로 소비)**. 필드 13은 reserved(옛 relevance, spec 38 change 19로 폐기).

### 3겹 주소: 원본 ↔ 조각 ↔ 별 (28)

원본·조각·별은 양방향으로 오갈 수 있다 — 클라가 길찾기로 잇는다([ux/interaction](../ux/interaction.md) wayfinding):

| 방향 | 키 | 노출 경로 |
|---|---|---|
| 원본 → N별 | `record_id` | `Star.record_id`(GetUniverse) + `ListRecords`(원본 일기 목록·일기별 별 개수·감정 패싯) — 클라가 `record_id`로 별을 일기 단위 그룹 |
| 별 → 1조각 | `fragment_text` | `RecallMemoryResponse.fragment_text`(그 별의 조각 텍스트; NULL→"" → body 폴백) |
| 별/조각 → 원본 | `record_id` JOIN | `RecallMemory`의 불변 `Record.body`(별 회상 곁따름, 11이 이미 반환; `memory_id` 채움) |
| `record_id` → 원본 1편 | `record_id` | `GetRecord`(부작용 없는 직접 읽기 — 회상 갱신 없이 원본 한 편; `Record.record_id`(7) 채움) |

- `ListRecords`는 `records JOIN memories` GROUP BY로 **읽기만**(헌법1) — `record_id`·`entry_date`·body 발췌(`left(body,80)`)·조각 별 개수·`moods`(감정 패싯), `entry_date` 내림차순, `user_id` 격리. inner JOIN이라 일기는 조각 별 ≥1개를 가진 뒤에야 목록에 뜬다(기본 동기 segment-review 경로가 같은 트랜잭션에서 별을 fan-out). 별-그룹핑엔 신규 쿼리가 없다(`Star.record_id`로 클라가 묶는다).
- `RecordSummary.moods`(proto 필드 5, `repeated Mood`)는 그 일기 조각 별들의 **de-dup된 감정 패싯**이다 — sqlc `ListRecords`의 `array_remove(array_agg(DISTINCT m.mood), NULL)`로 계산해, 일기 목록의 클라 감정 필터를 추가 라운드트립 없이 구동한다.
- `GetRecord`(`GetRecordRequest{record_id}` → `GetRecordResponse{Record record}`)는 `record_id`(별 그룹 키)로 **불변 원본 한 편**을 읽는 **부작용 없는**(`NO_SIDE_EFFECTS`) RPC다 — `RecallMemory`와 달리 `last_recalled_at`/`recall_count`를 **건드리지 않는다**(RecallMemoryTouch 없음). 소유자 가드: 남의/없는 record면 `NotFound`(`CodeNotFound`). sqlc `GetRecordByRecord`(`SELECT body/entry_date/mood/intensity/created_at FROM records WHERE id=@id AND user_id=@user_id`, SELECT 전용 헌법1), 도메인 `Service.GetRecordByID`/`Repository.GetRecordByID`. 독립 읽기 전용 일기 페이지의 본문 전체 공급용.

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
| 조각 시드 | 실서버 조각 형태/방향 시드는 저장된 별 id와 조각 index에서 파생한다. 은퇴한 AI 시드 헬퍼는 호출 경로가 없어 제거됐다. |
| 비용 가드 | 입력 4000 runes 절단(임베더 캡 미러)·텍스트 해시 캐시·`ExtractMetrics`(임베딩 `Metrics`와 분리 계측) |

### 변천사 (evolution_history — append-only, 23)

회상이 PE 게이트를 통과해 별을 다시 빚을 때마다(재성형 식은 [star](star.md) 정책) 그 시점 한 줄이 `evolution_history`에 **추가만** 된다. 별의 누적 상태(`memories`의 `brightness_offset` 등)는 *현재 모습*을, 변천사는 *지나온 모든 모습*을 담는다.

| 규칙 | 값 / 조건 |
|---|---|
| append-only | INSERT 전용 — `evolution_history` 행을 UPDATE/DELETE하는 쿼리·메서드를 일절 두지 않는다(헌법1·2). `AppendEvolution`(23)·`AppendGistHistory`(27)·`AppendRewriteEvolution`(54)이 유일한 쓰기 |
| 한 회상 = 변형된 별마다 1행 | 회상 별 + 직접 이웃이 재성형될 때 각자 `{version, brightness, hue_shift, form_seed_delta, trigger='recall', pe, dir}` 1행. PE 미달(novelty 없음)이면 0행 |
| 정렬·격리 | `GetEvolutionHistory`는 `(memory_id, user_id)`로 `version` 오름차순 반환(`evolution_history_memory_idx`); user_id 격리 |
| trigger 종류 | `'recall'`(23) · `'nightly_gist'`(27 야간 요지) · `'ai_rewrite'`(54 AI 내용 변형) · `'new_neighbor'`는 예약 |
| AI 내용 변형 (54) | `abstraction_stage ≥ rewrite.stage_threshold`(2)인 별을 다시 열람하면 비동기 rewrite 잡(`KindRewrite`, memory_id 키)을 best-effort 큐잉 — AI(`ai.Rewriter`: admin 활성 시 LLM, 아니면 no-op)가 표시 내용을 단계만큼 흐리게 다시 쓴다. 단계 높을수록 변형 폭↑(프롬프트). 결과가 *실제로 바뀌었을 때만* `content` 담은 `'ai_rewrite'` 행 append + `version++`(워커가 한 tx에서 잡 완료까지 — 정확히 1회). **원본 record 불변(헌법1)** — 변형 텍스트는 별 파생 레이어(변천사)에만. **빈도 제한(A6)**: 별당 최근 rewrite 잡(`jobs.updated_at ≥ debounce_cutoff`, no-op 포함)이 있으면 재적재 안 함 + 별당 활성 rewrite 잡 1개(부분 유니크 인덱스). AI 꺼짐/실패/echo → no-op(기존 내용 정상 렌더, graceful). 별 현재 표시 내용 = 최신 `content`(없으면 fragment/body 폴백) |
| 서버 ID | `evolution_history.id`는 서버 생성(클라는 ID를 만들지 않는다) |
| 읽기·타임랩스 표현(24) | `GetEvolutionHistory(memory_id)` read-only(`version` ASC)로 한 별의 변천사를 읽어 스크럽 타임랩스로 그린다. 각 버전은 같은 별의 **변주**로 재현된다 — `form_seed_delta`(형태)·`hue_shift`(색조)·`brightness`(밝기)만 변하고 base seed·감정색은 고정. 저장된 `brightness`는 누적 오프셋이라(시점별 절대 밝기는 로그에 없음) 뷰어가 표시 밝기로 환산한다. 슬라이더와 무관하게 불변 원본(`RecallMemory` `Record`)을 병치한다([ux/interaction](../ux/interaction.md) 변천사 보기) |

### 기록·조회 RPC

| RPC | 동작 | 멱등 |
|---|---|---|
| `RecordMemory` | 단일 트랜잭션 record→extract job: `records` 1행(불변) + `jobs` 1행(`kind='extract'`, `status='pending'`) → `{record_id, memory_ids}` 반환(`memory_ids`는 보통 빈 배열 — 조각은 비동기 도착) | `(user_id, idempotency_key)` 부분 UNIQUE — 재호출 시 기존 record id + 이미 fan-out된 조각 id들 |
| `GetUniverse` | 사용자의 모든 별 + 모든 시냅스 반환(잠든 것 포함), `last_recalled_at`/`last_activated_at`은 raw 값 | — |
| `RecallMemory` | **의도적 회상**(회상하기 버튼만 발화, change 35). **재회상 쿨다운 게이트**: 마지막 회상 후 `recall_cooldown_ms` 미경과면(이미 회상된 적 있는 별 — `recall_count > 1`) **부작용을 전부 스킵**하고 `recalled=false`+`cooldown_remaining_ms` 반환(BE 권위). 경과/첫 회상이면 별 재점화(`last_recalled_at = now()` **+ `recall_count += 1`**, 07) + PE 게이트 재성형(통과 시 회상 별+직접 이웃의 재성형 상태 갱신 + 변천사 append, [star](star.md) 정책) + AI 내용 변형 잡 best-effort 큐잉(단계≥2, 54) + `recalled=true`. 두 경우 모두 불변 원본 Record·그 별의 `fragment_text`(28, 별→조각)·`derived_text`(54, 최신 AI 변형 — 없으면 "") 반환. 원본 records는 불변(헌법1) | — |
| `PeekMemory` | 별 클릭 = **읽기 전용 열람**(change 35): 불변 원본 Record·`fragment_text`(28)·`derived_text`(54)를 **부작용 없이** 반환 — `last_recalled_at`/`recall_count` 미갱신·재성형·공동회상·재작성 잡 **모두 없음**(`GetRecord` SELECT 재사용). 둘러보기가 별을 안 바꾼다. 소유자 가드: 남의/없는 별 → `NotFound` | `NO_SIDE_EFFECTS` |
| `ListDormant` | 오래 회상 안 한 별만 반환(검색 보조용, 전체 그래프는 GetUniverse가 그대로 반환) | — |
| `GetEvolutionHistory` | 한 별의 변천사를 `version` 오름차순 반환(읽기; UI는 24) | — |
| `ListRecords` | 원본 일기 목록 — `records JOIN memories` GROUP BY(읽기 전용, 헌법1): `record_id`·`entry_date`·body 발췌·조각 별 개수·`moods`(de-dup 감정 패싯), `entry_date` DESC, user_id 격리(28; 원본 일기로 별 찾기 진입) | `NO_SIDE_EFFECTS` |
| `GetRecord` | `record_id`로 불변 원본 일기 한 편(body 전체) 읽기 — **부작용 없음**(`RecallMemory`와 달리 `last_recalled_at`/`recall_count` 미갱신·RecallMemoryTouch 없음). 소유자 가드: 남의/없는 record → `NotFound`. `GetRecordByRecord` SELECT 전용(28; 독립 읽기 전용 일기 페이지) | `NO_SIDE_EFFECTS` |

- 서버 권위 ID: `record_id`/`memory_id`는 서버가 생성한다(클라는 ID를 만들지 않는다).
- `entry_date`가 비면 service가 `now()`(UTC)로 기본 채운다. 클라 폼 기본값은 로컬 오늘 날짜.
- 응답은 별의 `last_recalled_at`·`recall_count`·시냅스의 `weight`/`last_activated_at`을 raw로만 싣는다 — 밝기·활성도·좌표는 서버가 계산하지 않는다(헌법2·3).
- **단일 기억 가중치 = Bjork 인출 강도 R(07).** 서버는 `recall_count`를 원자료로 영속·전달할 뿐, "요즘 감정" 종합(옛 ambient)을 더는 하지 않는다. 클라가 `recall_count`+`intensity`+`last_recalled_at`에서 저장강도 S와 인출강도 R을 파생해(`entities/memory/model/weight.ts`) **자기근접 반지름(38)과 배경 감정 순위(25)를 함께** 구동한다. R은 별 밝기(26 λ_eff)와는 **별개 채널**이다(R은 반지름·배경 순위만). `relevance`처럼 R 입력(`recall_count`)은 서버 파생 원자료라 헌법3과 충돌하지 않는다(밝기·좌표는 여전히 클라 계산).

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
| 재회상 쿨다운 원자성 (change 35) | `RecallMemoryTouchGated`(`:execrows`)가 게이트+재점화를 한 조건부 `UPDATE`(`… AND (recall_count ≤ 1 OR last_recalled_at ≤ cutoff)`)로 묶는다 — 동시 회상 둘이 읽기-게이트를 다 통과해도 1행만 갱신돼 재성형/재작성이 이중 적용되지 않는다(read-then-write TOCTOU 차단). cutoff = now − `recall_cooldown_ms`(values, 서비스 계산) |
| user_id 격리 | 모든 도메인 테이블에 `user_id`; 모든 record/memory/universe/recall/dormant 쿼리가 `WHERE user_id = $ctx`로 스코프(인터셉터가 컨텍스트 user_id 주입). RLS 아님 — WHERE + 인터셉터 |

## 불변식 (invariants)

- **헌법1 — 원본 불변·영구.** `records`에 대한 UPDATE/DELETE 쿼리·핸들러·service 메서드를 일절 두지 않는다(`db/queries/*.sql`에 `UPDATE records`/`DELETE FROM records` 없음). 회상·재성형 시에도 가변 별(`memories`)의 `last_recalled_at`·재성형 상태만 갱신하고 원본은 한 글자도 바뀌지 않는다. `GetRecord`(읽기 전용 일기 페이지)·`ListRecords`도 원본을 **읽기만** 한다 — 어떤 일기 열람 경로도 원본을 수정/삭제하지 않는다.
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
- 구현: plan 24 · `frontend/src/features/evolution/{api/evolution.ts,model/{history.ts,store.ts},ui/EvolutionPanel.tsx}` — `GetEvolutionHistory` read-only 소비 + 스크럽 타임랩스(버전 재현·계기 라벨)·불변 원본 병치(변천사 **읽기·표현**; 쓰기·적재는 plan 23).
- 구현: plan 28 · `proto/cosimosi/v1/memory.proto`(`Star.record_id`/`fragment_index`·`Record.record_id`(7)·`RecallMemoryResponse.fragment_text`·`ListRecords`/`RecordSummary`(+`moods`(5))·`GetRecord`/`GetRecordRequest`/`GetRecordResponse`), `backend/internal/db/queries/memory.sql`(`ListRecords`(+`array_remove(array_agg(DISTINCT m.mood),NULL)`)·`GetRecordByRecord` + GetUniverse 별 SELECT·RecallMemory 응답에 컬럼 추가, records SELECT 전용), `backend/internal/memory/{memory.go,repository_pg.go,service.go,handler.go}`(`ListRecords`·`GetRecordByID` 진입·`Star`/`Record` 매핑·소유자 NotFound) — 원본↔조각↔별 3겹 주소 노출 + 부작용 없는 원본 한 편 읽기(소비·UI는 [ux/interaction](../ux/interaction.md) wayfinding).
