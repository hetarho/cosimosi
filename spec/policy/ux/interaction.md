# 상호작용 (policy/ux/interaction)

> 현재 구현된 사용자-우주 상호작용(회상·공동 회상·기록·체험)의 사실 정의.

## 정의

cosimosi의 상호작용은 **능동 인출(active retrieval)**을 중심으로 동작한다. 사용자가 별을 일정 시간 이상 *바라보는* 행위만이 회상·공동 회상으로 카운트되고, 그보다 짧은 스침은 아무 것도 바꾸지 않는다. 현재 구현된 갈래는 네 가지다: (1) **회상** — 별 클릭 → ≥2초 능동 열람 → 읽기 전용 원본 패널, (2) **공동 회상** — 직전 능동 열람 별과의 페어 연결 강화, (3) **기록** — 본문+감정+강도+날짜 폼 제출 → 단일 별 낙관적 등장, (4) **체험(demo)** — 비로그인 더미 우주 + **기억 시뮬레이션 패널**(가상 시계·시간 머신·이론별 체험 액션). AI 감정 감지·기억 조각화는 plan 20·21에서 다룬다(아직 정책 아님).

## 규칙 · 파라미터

### 1. 회상 (recall)

| 규칙 | 값 |
| --- | --- |
| 능동 열람 임계 — 별 선택 후 패널이 이 시간 이상 유지돼야 "능동 회상" 확정 | `DWELL_MS = 2000` (≥2초) |
| <2초 열람(패널 닫기·다른 별 전환)은 타이머가 취소되어 회상·공동 회상 모두 미발생 | 카운트 0 |
| ≥2초 확정 시 `RecallMemory` 호출 → `memories.last_recalled_at = now`만 갱신 | 별만 가변 |
| 회상 패널은 **읽기 전용 원본 `Record`** — 본문·`entry_date`·`mood`·`intensity` 표시, 편집·삭제 컨트롤 없음 | read-only |
| **재열람** — 원본이 캐시에 있으면(불변, [data-sync](../domain/data-sync.md)) 본문을 **즉시 표시**(스피너 없음); touch(`RecallMemory`)는 ≥2초 dwell 후 백그라운드로 매번 발사 | 캐시 우선 |
| 이웃 항해 — 선택 별 시냅스 이웃을 `neighborsOf(edges, selectedId)`로 weight 내림차순 렌더, 최대 표시 수 | `MAX_NEIGHBORS = 8` |
| 이웃 클릭 = 선택 전환만(`select(id)`) — 패널이 재-dwell. **카메라 fly-to 아님**(NeighborNav는 카메라 타깃을 만들지 않는다) | 선택 전환 |

### 2. 공동 회상 (co-recall)

| 규칙 | 값 |
| --- | --- |
| 직전 능동 열람 별과 다른 별을 능동 열람하면 그 페어에 증분 | `CO_RECALL_DELTA = +0.05`/이벤트 |
| 같은 id 재열람은 페어 미생성(`lastViewedId`만 갱신) | no-op |
| weight 상한(서버 업서트) | `LEAST(1.0, weight + delta)` |
| 강화 시 부가 효과(서버) | `co_activation_count++`, `last_activated_at = now` |
| 페어 정규화 — 무방향 키 `a < b`, 같은 윈도 내 같은 페어는 합산 | `pairKey` |
| 디바운스 flush — 마지막 능동 열람 후 유휴 시간 경과 시 1회 배치 전송 | `DEBOUNCE_IDLE_MS = 5000` (~5s) |
| 추가 flush 시점 — 탭 숨김/종료(`beforeunload`·`visibilitychange=hidden`), keepalive 전송 | flush 호출 |
| 멱등 — 같은 `batch_id` 재전송은 서버 `processed_batches`로 skip(이중 가산 금지) | `batch_id` |
| 실패 시 — drain한 증분을 같은 `batch_id`로 재병합해 재시도(유실 방지), 동시 1배치만 in-flight | 재시도 |
| 생성 경로 `link_type` | `co_recall` |

### 3. 기록 (record)

| 규칙 | 값 |
| --- | --- |
| 입력 항목 — 본문 textarea + **감정 `<select>`(7종)** + 강도 슬라이더 + 날짜(`YYYY-MM-DD`, 기본 오늘 로컬) | 4개 입력 |
| 제출 → 임시 별(`temp-` id, `seed = seedFromId(tempId)`) 낙관적 `addStar` → `RecordMemory` 호출 | 단일 별 즉시 등장 |
| 성공 → `memory_id`+폼 값으로 확정 별 `replaceStar(tempId, …)`(`seed = seedFromId(memory_id)`) | 서버 id 교체 |
| 실패 → `removeStar(tempId)`(임시 별만), 한국어 에러 카피 노출 | 임시 별만 롤백 |
| 공백 본문 제출 차단 | RPC 미호출 |
| 감정·강도 값 출처 | 사용자가 폼에서 직접 선택(AI 감지 아님) |

### 4. 체험 (demo)

| 규칙 | 값 |
| --- | --- |
| 진입 — 랜딩의 데모 버튼/카드 "이 카드 체험하기" → `enterDemoMode()` → `sessionStorage('cosimosi:demo'='1')` → `/universe`(카드는 `?sim=<id>`로 해당 시뮬 항목 포커스, 잘못된 id 무시) | 세션 플래그 |
| 데이터 출처 — `isDemoMode()`이면 API 래퍼가 백엔드 대신 더미데이터로 분기(`demoStars`/`demoSynapses`/`demoRecall`/`demoAddRecord`) | 더미 우주 |
| **가상 시계** — 데모의 밝기·잠듦 파생 "현재 시각"은 `virtualNowMs() = Date.now() + offset`(offset은 데모에서만 ≠0). 시뮬 패널 "하루/한 달 지나기"가 offset을 전진시키고 별·엣지 밝기를 재파생 — 실제 감쇠 수식([star](../domain/star.md) 반감기 30일·바닥 5%)이 그대로 돈다(연출 없음). 비데모는 항상 `Date.now()`와 동일값 | `skipDemoDays` |
| **데모 재점화** — 데모 회상(≥2초)도 그 별의 `lastRecalledAt`을 가상 now로 전진(`demoMarkRecalled`) + universe 쿼리 무효화 → 잠든 별이 다시 밝아지는 루프가 데모에서 완결 | 서버 대칭 |
| **데모 별 띄우기** — 데모의 기록은 작성 폼이 아니라 패널의 "별 띄우기" 컨트롤러: 감정(7종)·날짜만 고르면 그 감정으로 미리 써 둔 일기 중 무작위 본문으로 별이 태어난다(`demoAddStar`). 같은 (가상)날 별과 temporal, 같은 mood 최신 별과 semantic 연결을 로컬 생성(실서버 임베딩 τ=0.75·top-8·같은날+0.3의 **근사** — 패널이 명시) | 근사 시연 |
| **헵 로컬 미리보기** — 데모에서 공동 회상 페어가 확정되는 즉시 그 엣지 weight를 로컬 +0.05(상한 1.0, 없던 페어는 `co_recall` 로컬 생성) → 굵어짐이 바로 보인다. `reinforceLinks`는 여전히 no-op, 서버/proto 미기록 | no server write |
| **시뮬레이션 HUD** — 데모에서만, 좌하단 진입 칩 2개로 **서로 다른 모달**을 연다: ① "🧪 기억 실험실" 컨트롤러 패널(시간 머신·별 띄우기), ② "❕ 엔그램 이론" 안내 모달 — 이론을 나열하지 않고 **한 번에 하나씩** 점 탭·‹›·방향키·스와이프 페이지네이션으로 넘기며, 이론↔컨트롤 1:1 버튼 없이 howTo(어떤 컨트롤러로 어떤 행위)만 적는다(`SIM_ENTRIES` — 항목 추가만으로 확장, plan 20–27 소비). `?sim=<id>` 진입은 이론 모달이 그 페이지로 열린 채 시작. 시간 스킵은 ~0.9s ease 트윈으로 흐른다(밝기 뚝 끊김 방지). "처음으로" = exit→reset→enter 경로로 초기 우주 복귀 | `widgets/demo-sim` |
| 새로고침 시 모듈 리로드 → base 더미만 재생성, 체험 중 추가한 별·연결·가상 시계 offset 소멸 | 세션 한정 |
| 화면 코드 동일 — 회상·이웃·잠든 별 동선은 일반 모드와 같은 컴포넌트(데이터 출처는 쿼리 queryFn 안에서 분기). 예외: **기록 폼은 데모에서 숨김**(위 "별 띄우기" 컨트롤러가 대체) | 기록만 대체 |
| 모드 전환(enter/exit) = 데이터 출처 전환 → 쿼리 캐시·렌더 스토어 전체 리셋([data-sync](../domain/data-sync.md) 출처 경계) — 체험 별이 실계정 우주에 섞이지 않는다 | 경계 리셋 |

### 5. 변천사 보기 (evolution timelapse, 24)

회상 패널(`phase==='shown'`)의 **"변천사 보기"** 진입점으로 그 별이 변해 온 길을 연다 — 우주 캔버스 위 오버레이(별도 라우트 없음, 우주는 뒤에 영속; 31 셸 도입 전까지 페이지가 합성). 23이 쌓은 `evolution_history`를 **읽기 전용**으로 스크럽하는 타임랩스다.

| 규칙 | 값 / 조건 |
|---|---|
| 진입점 | 회상 패널 read-only 원본 아래 "변천사 보기" 버튼 → `useEvolutionStore.open(memory_id)`(페이지가 recall→evolution을 콜백으로 배선; 두 feature는 서로 import하지 않음) |
| 데이터 | `GetEvolutionHistory(memory_id)` unary read(헌법6) → `version` 오름차순 스냅샷. 빈 목록=정상("아직 변천사가 없어요 — 최초 모습 그대로") |
| 버전 재현 | 같은 `VizStar`(시그니처 불변): `seed = baseSeed + form_seed_delta·k`(형태 변주)·`brightness`·래퍼 `hue-rotate(hue_shift°)`. `concept`(StarObject)·감정색은 별 전 생애 고정(회상은 색을 통째로 바꾸지 않음) |
| 계기 라벨 | `recall`→"회상" · `new_neighbor`→"새 이웃" · `nightly_gist`→"야간 요지", `dir`로 강화↑/약화↓ 보조 |
| 불변 원본 병치 | 화면 한편에 11의 `RecallMemory` `Record`(body·entry_date·mood)를 읽기 전용 고정 — 슬라이더를 어디로 옮겨도 원본 텍스트는 그대로(헌법1). 캐시(`recordQueryKey`)에서 재사용(새 RPC 없음) |
| 체험(demo) | `demoEvolution(memory_id)`가 ≥3 버전을 결정론적으로 합성(trigger 섞음) → 백엔드 호출 없이 스크럽·재현·원본 병치 |

## 불변식 (invariants)

- **원본 편집·삭제 UI 없음 (헌법1).** 회상 패널·변천사 화면 모두 read-only `Record`만 보여준다. 변천사 슬라이더를 어디로 옮겨도 원본은 불변이며, 어떤 상호작용도 `records`를 UPDATE/DELETE하지 않는다. 변천사 조회(`GetEvolutionHistory`)는 read-only(INSERT/UPDATE/DELETE·`RETURNING *` 없음).
- **별·시냅스 삭제 금지 (헌법2).** 낙관적 롤백은 `temp-` 접두 임시 별만 제거하며, 서버에서 온 별·엣지는 절대 제거하지 않는다.
- **능동 인출이 강화의 유일한 트리거.** `<DWELL_MS` 스침·단순 전환은 회상·공동 회상으로 카운트되지 않는다.
- **공동 회상은 멱등하게 영속.** 같은 `batch_id` 재전송은 두 번 가산되지 않는다.
- **unary 전용 (헌법6).** 회상·강화·기록·잠든 별 조회는 모두 unary 호출이며 스트리밍·폴링이 없다. 신규 별의 시냅스는 다음 `GetUniverse` refetch에서 받는다.
- **좌표는 서버에 쓰지 않음 (헌법3).** 어떤 상호작용도 좌표를 영속하지 않는다(서버는 가중치 그래프만).
- **HUD는 캔버스 밖 2D DOM (헌법8).** 폼·회상 패널·이웃 항해는 R3F 씬 안 `<Html>`로 넣지 않는다.

## 구현 근거

- **회상:** 구현: plan 11 · `frontend/src/features/recall/ui/MemoryPanel.tsx`(dwell 타이머·read-only 패널)·`ui/NeighborNav.tsx`(이웃 항해, 선택 전환만)·`api/recall.ts`(`RecallMemory`).
- **공동 회상:** 구현: plan 11 · `frontend/src/features/recall/model/co-recall.ts`(`CO_RECALL_DELTA`·`DWELL_MS`·`DEBOUNCE_IDLE_MS`·`pairKey`)·`model/store.ts`(디바운스·재시도·in-flight 직렬화)·`pages/home/ui/HomePage.tsx`(`beforeunload`/`visibilitychange` flush)·`shared/api/transport.ts`(keepalive).
- **기록:** 구현: plan 10 · `frontend/src/features/record-memory/ui/MemoryForm.tsx`(본문+감정 select+강도+날짜)·`model/draft-store.ts`(기본 오늘·7종 mood)·`model/use-record-memory.ts`(낙관적 add/replace/remove).
- **잠든 별 재점화 동선:** 구현: plan 12 · `frontend/src/pages/dormant`(`ListDormant`)·`entities/memory/model/activation.ts`(`isDormant`).
- **변천사 보기:** 구현: plan 24 · `frontend/src/features/evolution/{api/evolution.ts,model/{history.ts,store.ts},ui/EvolutionPanel.tsx}`(unary read·순수 model·스크럽 타임랩스+불변 원본 병치)·`features/recall/ui/MemoryPanel.tsx`("변천사 보기" 진입점)·`pages/home/ui/HomePage.tsx`(오버레이 합성·콜백 배선)·`shared/lib/demo/data.ts`(`demoEvolution`). BE read RPC는 plan 23(`GetEvolutionHistory`).
- **체험:** 구현: plan 11·12 데모 분기 + plan 19 시뮬레이션 · `frontend/src/shared/lib/demo/flag.ts`(`enterDemoMode`/`isDemoMode`)·`shared/lib/demo/data.ts`(더미 우주·`demoMarkRecalled`·데모 연결 생성)·`shared/lib/demo/clock.ts`(`virtualNowMs`/`skipDemoDays`)·`shared/lib/demo/observe.ts`(관찰 셀렉터)·`features/recall/api/recall.ts`(demo no-op/recall)·`features/recall/model/store.ts`(데모 헵 로컬 bump)·`entities/synapse/model/store.ts`(`bumpEdgeWeight`)·`entities/memory/api/universe-query.ts`(`refreshActivation`)·`widgets/demo-sim`(`SIM_ENTRIES`·`DemoSimPanel`·`runTimeSkip`)·`pages/home/ui/HomePage.tsx`(데모 한정 마운트·`?sim=` 파서).
- **불변식:** 헌법 1·2·3·6·8(`spec/plan/00.overview.md`).
