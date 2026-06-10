# 상호작용 (policy/ux/interaction)

> 현재 구현된 사용자-우주 상호작용(회상·공동 회상·기록·체험)의 사실 정의.

## 정의

cosimosi의 상호작용은 **능동 인출(active retrieval)**을 중심으로 동작한다. 사용자가 별을 일정 시간 이상 *바라보는* 행위만이 회상·공동 회상으로 카운트되고, 그보다 짧은 스침은 아무 것도 바꾸지 않는다. 현재 구현된 갈래는 네 가지다: (1) **회상** — 별 클릭 → ≥2초 능동 열람 → 읽기 전용 원본 패널, (2) **공동 회상** — 직전 능동 열람 별과의 페어 연결 강화, (3) **기록** — 본문+감정+강도+날짜 폼 제출 → 단일 별 낙관적 등장, (4) **체험(demo)** — 비로그인 더미 우주 둘러보기. AI 감정 감지·기억 조각화·이론 렌즈 오버레이는 plan 19·21에서 다룬다(아직 정책 아님).

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
| 진입 — 랜딩의 데모 버튼 → `enterDemoMode()` → `sessionStorage('cosimosi:demo'='1')` → `/universe` | 세션 플래그 |
| 데이터 출처 — `isDemoMode()`이면 API 래퍼가 백엔드 대신 더미데이터로 분기(`demoStars`/`demoSynapses`/`demoRecall`/`demoAddRecord`) | 더미 우주 |
| 강화 영속 없음 — `reinforceLinks`는 데모에서 no-op, 서버/proto 미기록 | no server write |
| 새로고침 시 모듈 리로드 → base 더미만 재생성, 체험 중 추가한 별은 소멸 | 세션 한정 |
| 화면 코드 동일 — 회상·기록·이웃·잠든 별 동선은 일반 모드와 같은 컴포넌트(데이터 출처는 쿼리 queryFn 안에서 분기) | UI 분기 없음 |
| 모드 전환(enter/exit) = 데이터 출처 전환 → 쿼리 캐시·렌더 스토어 전체 리셋([data-sync](../domain/data-sync.md) 출처 경계) — 체험 별이 실계정 우주에 섞이지 않는다 | 경계 리셋 |

## 불변식 (invariants)

- **원본 편집·삭제 UI 없음 (헌법1).** 회상 패널은 read-only `Record`만 보여준다. 어떤 상호작용도 `records`를 UPDATE/DELETE하지 않는다.
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
- **체험:** 구현: plan 11·12 데모 분기 · `frontend/src/shared/lib/demo/flag.ts`(`enterDemoMode`/`isDemoMode`)·`shared/lib/demo/data.ts`(더미 우주)·`features/recall/api/recall.ts`(demo no-op/recall).
- **불변식:** 헌법 1·2·3·6·8(`spec/plan/00.overview.md`).
