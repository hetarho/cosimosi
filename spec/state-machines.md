# 상태 머신 아키텍처 (state-machines)

> cosimosi의 **유한 상태(finite state)**를 어디서·어떻게 모델링하는지 정한다.
> [Architecture.md](Architecture.md)가 "코드를 어떻게 나누나(레이어)"라면, 이 문서는 **"상태를 어떻게 나누나(머신)"**다.
> 작성 패턴·API 규약은 [xstate-guide.md](xstate-guide.md), 단계별 전환 작업은 [plan/39](plan/39.state-machine-refactor.md).

cosimosi는 일반적인 일기 앱이 아니라 **우주를 항해하는 게임**에 가깝다. 카메라는 성운 조망(nebula)·근접 회상(recall)·별로의 비행(fly-to)·일기 조망(frame-all) 사이를 오가고, "지금 무엇에 집중하나"(별 한 개 / 일기 한 편 / 리스트 / 변천사)는 **서로 배타적인 모드**로 갈린다. 이런 "모드·단계·수명주기"를 nullable 필드 + 동기화 이펙트로 흩뜨리면 **같은 논리 상태를 두 곳이 다른 변수로 표현해 불일치**가 난다(실제로 "일기로 별 보기"를 두 진입점이 다른 변수로 다뤄 한쪽만 동작했다).

그래서 **제어 상태(control state)는 [XState v5](xstate-guide.md) 상태 머신**으로 단일화하고, **데이터는 zustand / TanStack Query**로 분리한다.

---

## 0. 제어 상태 vs 데이터 — 무엇이 머신이 되는가

머신으로 만드는 것과 아닌 것을 먼저 못 박는다. 이 경계를 흐리면(예: 별 배열을 머신 context로) 머신이 비대해지고 리렌더·비교가 깨진다.

| | 머신(XState) | 데이터(zustand / Query / ref) |
|---|---|---|
| 무엇 | "N개 배타 상황 중 하나" — mode, phase, lifecycle, selection, open/closed | 값·컬렉션 |
| 예 | 카메라 모드, 작성 단계, 회상 flush 수명주기, 포커스 대상, 패널 열림 | `stars[]`, `edges[]`, `ambient`, `emotionColors`, 쿼리 캐시, force-sim 좌표 버퍼 |

**규칙**

- 머신 context에는 **데이터를 복제하지 않는다.** 선택은 `id`만 들고, 데이터는 그 id로 스토어/쿼리에서 참조한다.
- **고빈도 연속값은 머신 이벤트로 흘리지 않는다.** 매 프레임 카메라 좌표 lerp, D-pad `move` 벡터, drag offset 등은 ref/zustand에 둔다. 머신은 **이산(discrete) 전환**만 다룬다(60fps 이벤트 폭발 금지 — Architecture §3.2와 정합).
- 머신은 "무슨 일이 일어났나"를 **이벤트**로 받는다(setter 금지 — [xstate-guide §events-not-setters](xstate-guide.md)).

---

## 1. 배치 원칙 (FSD)

1. **머신은 그 관심사를 소유하는 레이어의 `model` 세그먼트에 둔다** — `<layer>/<slice>/model/<name>.machine.ts`. 하위 레이어(`entities`)는 머신 스냅샷에서 **파생한 props로 렌더만** 하고, 머신을 직접 import하지 않는다(헌법4 단방향).
2. **`model`은 `three`/React/DOM에 의존하지 않는다(헌법4).** XState 코어는 순수 TS라 이를 충족한다 — 머신 정의(`*.machine.ts`)는 `model`. React 바인딩(`@xstate/react`)·R3F 연동(`useFrame`+`getSnapshot`)은 **`ui`에서만**.
3. **머신끼리는 이벤트로 통신**(`sendTo`/`emit`)하고, 공유 가변 필드를 두지 않는다. 상호의존은 [§5 계약](#5-나브--포커스-계약)의 패턴으로 순환 없이 묶는다.
4. **진짜 글로벌 머신(세션)** → `app/model`. **위젯 단위(카메라)** → `widgets/<w>/model`. **기능 단위(포커스·작성·회상)** → `features/<f>/model`. (Architecture §2.7 Zustand 배치 원칙과 동일.)

---

## 2. 전체 카탈로그 (triage)

감사에서 식별한 모든 유한-상태 후보를 3등급으로 분류한다. **전부를 머신으로 만들지 않는다** — "N개 배타 상황의 명시적 수명주기"만 승격하고, 단순 토글·로컬 UI는 그대로 둔다.

### Core — 우주를 구동하는 두 머신 (반드시 XState)

| 영역 | 현재(흩어진) 위치 | 목표 머신 | 레이어 | Phase |
|---|---|---|---|---|
| **항행(navigation)** | `use-camera-mode`(mode·transitioning·focusStarId·resetNonce) + `UniverseCanvas`의 FlyTo·FrameAll·ModeTransition 컨트롤러(useRef 암묵 상태) | `navigation.machine` | `widgets/universe-canvas/model` | **P2** |
| **포커스(focus)** | `memory.selectedId` + `wayfinding.highlightedRecordId/frameRequest` + `NearFarHighlightGuard`(배타 강제 이펙트) | `focus.machine` | **`entities/memory/model`** | **P1 ✅** |

> **배치 정정(P1 구현 결과):** focus 머신은 `entities/memory/model`에 둔다(스펙 초안의 `features/universe`가 아니라). 이유 — 포커스는 `widgets/universe-canvas`(카메라 컨트롤러)와 `features/recall`·`features/diary-list`가 **모두 단방향으로 읽어야** 하는데, 그 둘의 공통 하위 레이어는 `entities`뿐이고, `selectedId`가 원래 거기 살았다(FSD 위반 없이 모두가 import). 모듈 싱글턴 액터(`focusActor`)로 노출 — 구 zustand 싱글턴과 동형 수명이라 `resetUniverseData`가 `DISMISS`를 보낼 수 있다.
>
> **범위 정정:** focus 머신은 `idle | star | diary`만 — `shell.panel/peek`(리스트 오버레이)와 `evolution.openFor`는 포커스와 **직교**(아래 §3)라 흡수하지 않고 깨끗한 zustand로 둔다. 변환 가치가 낮은 단순 스토어는 그대로(triage 원칙).

### Lifecycle — 명시적 async 수명주기 (XState로 큰 이득)

| 영역 | 현재 위치 | 목표 머신 | 레이어 | Phase |
|---|---|---|---|---|
| **세션(session)** | `app/model/auth-store` `status: loading\|authed\|anon` + 모듈 `syncIdentity` | `session.machine` | `app/model` | **P0(레퍼런스)** |
| **작성(compose)** | `record-memory/draft-store` `phase(compose\|review)` × `status(idle\|segmenting\|submitting\|error)` | `compose.machine` | `features/record-memory/model` | **P3** |
| **회상 flush(recall)** | `recall/store` `session{deltas,batchId}` + 모듈 `inFlight` + 디바운스 타이머 | `recall-flush.machine` | `features/recall/model` | **P4** |

### Leaf — 평가 후 대부분 유지 (승격은 가치가 증명될 때만)

| 영역 | 현재 위치 | 처리 |
|---|---|---|
| 변천사 오버레이 | `features/evolution/model/store` `openFor` | **focus 머신의 `evolution(memoryId)` 상태로 흡수**(P1) |
| 시간여행 트윈 | `widgets/demo-sim/model/time-travel.ts`(모듈 가변) | (선택) `fromCallback` 액터 — demo 전용, 저우선 **P5** |
| MemoryPanel phase, SignIn step, BottomSheet snap, DemoSimPanel(carousel·모달), 랜딩 카드 데모(NightlyConsolidation `stage 0–4` 등) | 각 컴포넌트 `useState` | **로컬 유지.** 명시적 다단계·재시도·교차 동기화가 생기면 그때 승격 |

### 데이터로 남기는 것 (머신 아님)

`memory.stars / loadedEmpty / ambient`, `synapse.edges`, `appearance.theme / object / selfObject / emotionColors`, force-sim 좌표 `Float32Array` 버퍼 — 전부 **값/컬렉션**이라 zustand/Query/ref 유지. 머신은 이들을 `id`로 참조만 한다.

> **요약:** 7개를 머신으로 승격(2 Core + 3 Lifecycle + evolution 흡수 + 선택적 time-skip), 나머지는 로컬 유지. 데이터는 절대 머신으로 옮기지 않는다.

---

## 3. Core 1 — 포커스 머신 `focus.machine` ✅(P1 구현됨)

> `entities/memory/model/focus.machine.ts` · **"지금 무엇에 집중하나"의 단일 출처.**

별 선택과 일기 조망은 **상호 배타**다. 구버전은 두 스토어(`memory.selectedId`, `wayfinding.highlightedRecordId`) + `NearFarHighlightGuard`가 배타를 *이펙트로 억지로* 유지했다. 한 머신이면 배타가 **구조**가 된다.

```
                 ┌──────────── DISMISS (빈 곳 탭·Esc·출처 리셋) ────────────┐
                 ▼                                                          │
              [ idle ] ──SELECT_STAR(id)──────────────► [ star(starId) ]    │
                 │  ▲                                      │   ▲            │
                 │  │ SELECT_STAR(id)            SELECT_STAR(id')│            │
   SELECT_DIARY  │  │                                      │   │            │
   SEE_DIARY     │  └──────────────────────────────────────┘   │            │
        _STARS   ▼              SEE_DIARY_STARS(rid) / SELECT_DIARY(rid)     │
              [ diary(recordId, frameNonce++) ] ◄──────────────────┘────────┘
```

**핵심 — 사용자가 지적한 불일치가 사라진다.** `SEE_DIARY_STARS`(회상 패널의 "이 일기의 다른 별들 보기")와 `SELECT_DIARY`(일기 목록 클릭)는 **둘 다 `diary` 한 상태로 수렴**한다(같은 `toDiary` 액션). 두 진입점이 **구조적으로 동일**해지므로, "한쪽만 카드가 뜨고 한쪽은 안 뜨던" 버그가 *코드 분기 자체가 없어져서* 사라진다(단위테스트로 고정). `NearFarHighlightGuard`의 "별 선택 시 강조 해제" 분기는 삭제 — 별을 고르면 `star` 상태라 `diary`는 자동 해제(구조적). near/far 가드(근접 진입 시 조망 해제)만 얇은 `RecallDismissGuard`로 남는다.

**상태·컨텍스트**

- `idle` — 집중 없음.
- `star` · `context.starId` — 회상 패널(`selectedId`).
- `diary` · `context.recordId` + `context.frameNonce`(단조 증가 — 같은 일기 재선택도 frame-all 재발화; 구 `frameRequest.nonce` 대체).

**파생 selector (컴포넌트 밖 정의 — `useSelector`/`getSnapshot`로 구독)**

```ts
selectFocusedStarId       = (s) => s.matches('star')  ? s.context.starId   : null
selectHighlightedRecordId = (s) => s.matches('diary') ? s.context.recordId : null
selectIsStarFocus / selectIsDiaryFocus / selectIsFocused / selectFrameNonce
```

`entities/star/ui/StarField`은 `selectedId`·`highlightedRecordId`·`onSelect`를 **prop**으로 받는다(엔티티는 머신을 직접 읽지 않음 — props 구동, 헌법4). 위젯(`UniverseCanvas`)이 selector로 읽어 내려주고 별 탭을 `focusActor.send(SELECT_STAR)`로 잇는다.

### 3.1 포커스 ⊥ 패널 — 왜 셸은 흡수하지 않았나

리스트 오버레이(`shell.panel/peek` — 잠든 별·일기 목록)와 변천사(`evolution.openFor`)는 포커스와 **직교**한다: 일기 목록을 peek한 채 그 일기를 조망(`diary`)할 수 있고, 별을 회상(`star`)하면서 변천사를 열 수 있다. 즉 "무엇에 집중하나"와 "어떤 리스트/오버레이가 떠 있나"는 동시에 성립하는 두 축이다. 그래서:

- **focus 머신은 `idle|star|diary`만** 다룬다.
- `shell.panel/peek`(`features/universe`)와 `evolution.openFor`(`features/evolution`)는 이미 깨끗한 단순 zustand라 **그대로 둔다**(triage: 변환 가치 낮음).
- **일기 카드(DiaryCard)는 `focus=diary`에 묶는다**(패널이 아니라). 구버전 버그의 진짜 원인이 카드를 `panel==='diary'`에 묶어 회상-패널 경로(panel=null)에선 안 떴던 것 — 이제 포커스로 렌더하므로 어느 진입점이든 뜬다.

**나브로 보내는 이벤트** — [§5 계약](#5-나브--포커스-계약). P1 단계(나브 머신 P2 도착 전)에서는 카메라 컨트롤러가 focus selector를 `getSnapshot`으로 읽고, fly-to 도착 시 `focusActor.send(SELECT_STAR)`로 패널을 연다(나브→포커스). P2에서 `star.entry → sendTo(nav, FLY_TO_STAR)` 등 양방향 계약으로 정식화한다.

---

## 4. Core 2 — 항행 머신 `navigation.machine` ✅(P2 구현됨)

> `widgets/universe-canvas/model/navigation.machine.ts` · **카메라의 "우주비행" FSM.**

`mode` 플래그 + 3개의 useRef 비행 컨트롤러(FlyTo·FrameAll·ModeTransition)와 곳곳에 흩어진 `transitioning` set을 **한 머신**으로.

> **as-built(P2):** 모듈 싱글턴 `navigationActor`(focus와 동형 — 구 use-camera-mode zustand 수명). 이벤트 `TOGGLE_MODE/FLY_TO_STAR/FRAME_DIARY/ARRIVED/SET_MOVE`. context = 이산 타깃(`flyStarId`/`frameRecordId`/`frameSeq`/`transitionTo`) + `move`. D-pad `move`는 press/release 이산 이벤트(`SET_MOVE`)로 context에 두고 NavController가 매 프레임 `getSnapshot`으로 읽는다(60fps 이벤트 아님). 뷰포트 시트 힌트(`sheetOpen`)는 항행이 아니라 HUD라 별도 `use-viewport.ts`(작은 zustand). 비행 도착은 컨트롤러가 `ARRIVED`로 알리고, 비행 컨트롤러(FlyTo·FrameAll)는 `getSnapshot().matches(자기상태)`로 다른 비행이 가져가면 양보한다(단일 카메라 소유 보장). 카메라 *수학*(arcball·flight lerp·shake)은 그대로, 상태 소스만 머신으로 교체.

```
        ┌──────────────── TOGGLE_MODE ────────────────┐
        ▼                                              │
   [ nebula ] ──TOGGLE_MODE──► [ modeTransition(to) ]──┘   (#transitioning)
     │  ▲                            │ ARRIVED
     │  │                            ▼
     │  └──────────────────────── [ recall ]
     │                                │
     │  FLY_TO_STAR(id)               │ FLY_TO_STAR(id)
     ▼                                ▼
   [ framingDiary(rid) ]        [ flyingToStar(id) ]        (#transitioning)
     │ ARRIVED                        │ ARRIVED → emit 'arrived.star'
     ▼                                ▼
   nebula                           recall
   ▲  FRAME_DIARY(rid) from nebula/recall ─┘
```

**상태**

- `nebula` — 조망 궤도(OrbitControls, 거리 클램프 좁음).
- `recall` — 자유 비행(D-pad/WASD), 함선 경계 클램프.
- `flyingToStar` · `context: { targetId }` · **tag `transitioning`** → `ARRIVED` 시 `recall` + `emit('arrived.star')`.
- `framingDiary` · `context: { recordId }` · **tag `transitioning`** → `ARRIVED` 시 `nebula`.
- `modeTransition` · `context: { to }` · **tag `transitioning`** → `ARRIVED` 시 `to`.

**tag `transitioning`로 클램프 완화.** 현재 `transitioning` boolean을 곳곳에서 set/read하던 걸, 비행 상태에 단 **tag 하나**로 대체한다. `CameraRig`는 `snapshot.hasTag('transitioning')`만 보면 된다.

**연속 보간 경계 — 가장 중요한 R3F 패턴.** 이산 상태·타깃만 머신이 들고, **매 프레임 카메라 lerp는 `useFrame` 컨트롤러**에 남긴다. 컨트롤러는 `actorRef.getSnapshot()`으로 `value`/`context.target`을 읽어 보간하고, 거리 < threshold면 `actorRef.send({ type: 'ARRIVED' })`로 전환을 트리거한다. **`move` 벡터·drag는 머신 밖**(ref/zustand). 컨트롤러는 절대 `useMachine`을 쓰지 않는다(리렌더 폭발) — [xstate-guide §R3F](xstate-guide.md).

---

## 5. 나브 ↔ 포커스 계약 (as-built)

둘은 상호의존이다(포커스가 비행을 요청, 나브의 도착이 포커스를 확정). 둘 다 **모듈 싱글턴 액터**(`focusActor`·`navigationActor`)라 input-ref 순환 문제가 없다 — **얇은 브리지/직접 send**로 잇는다:

```
  focus 머신 ── diary 진입(recordId/frameNonce 변화) ──► FocusNavBridge(useEffect)
                                                          └─► navigationActor.send(FRAME_DIARY) → framingDiary
  navigation 머신 ── flyingToStar ARRIVED ──► FlyToController
                                              └─► focusActor.send(SELECT_STAR)  (도착 시 회상 패널)
  navigation 머신 ── recall 진입 ──► RecallDismissGuard(useEffect)
                                     └─► focusActor.send(DISMISS) (diary면 — 근접에선 단일 엔그램만)
```

- **포커스 → 나브:** `FocusNavBridge`(widget useEffect)가 포커스 `diary` 진입(또는 같은 일기 재선택 frameNonce↑)을 `navigationActor.send(FRAME_DIARY)`로. 별 fly-to는 dormant 선택이 `navigationActor.send(FLY_TO_STAR)` 직접.
- **나브 → 포커스:** fly-to 도착 시 `FlyToController`가 `focusActor.send(SELECT_STAR)`(회상 패널), `recall` 진입 시 `RecallDismissGuard`가 diary면 `DISMISS`.
- 둘 다 모듈 싱글턴이라 per-frame `getSnapshot()`이 빠르고 `resetUniverseData`도 닿는다. 비행 컨트롤러는 `getSnapshot().matches(자기상태)`로 다른 비행이 가져가면 양보(단일 카메라 소유). 라우팅이 더 늘면 부모 `universe` 오케스트레이터로 승격(그 전엔 과설계).

**캔버스 입력.** `<Canvas onPointerMissed>`(빈 곳 탭)은 `focusActor.send({ type: 'DISMISS' })` **하나만** 보낸다 — 별·일기 해제가 한 곳으로 모인다(구 `selectedId`·`highlightedRecordId`를 각각 getState로 지우던 코드 대체).

---

## 6. 적용 후 사라지는 것 (왜 더 단순한가)

리팩토링의 가치는 "추가"가 아니라 **제거**로 측정한다.

- **`NearFarHighlightGuard`** (배타 강제 이펙트 2개) → 삭제. 배타는 머신 구조.
- **`selectedId` ↔ `highlightedRecordId` 동기화·diary-close 이펙트** → 삭제. 전환 함수로 흡수.
- **URL ↔ store 거울 이펙트** → focus 머신 ↔ URL 단일 동기화로 단순화(딥링크 = 초기 `input`/이벤트).
- **`transitioning` boolean의 산발적 set/read** (FlyTo·FrameAll·ModeTransition 각각) → tag `transitioning` 하나.
- **두 진입점 분기** (`frameDiary` vs `onSeeDiaryStars`) → `diaryFocus` 한 상태.
- **3개 useRef 비행 컨트롤러의 중복 수명주기 관리** → 머신 상태 + 얇은 lerp 컨트롤러.

---

## 7. 검증·유지보수

- 각 머신은 **순수 단위테스트**(`createActor` + `send` + `getSnapshot` 단언, React 없이) — `model`이 순수하므로 vitest로 직접.
- 분기가 많은 머신(포커스·항행)은 **모델 기반 경로 테스트**(`@xstate/graph` `createTestModel`)로 도달 가능 상태를 커버.
- 작성·규약·금지사항·R3F 연동·테스트 상세는 **[xstate-guide.md](xstate-guide.md)** 가 단일 출처. 새 머신은 거기 템플릿을 그대로 따른다.
- 단계별 전환·영향 파일·DoD는 **[plan/39](plan/39.state-machine-refactor.md)**.
