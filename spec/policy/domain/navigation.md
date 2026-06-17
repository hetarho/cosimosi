# 항행·카메라 (navigation) (policy/domain/navigation)

> 현재 구현된 항행·카메라 운동(비행선 속도·가속도·관성)의 사실 정의.

## 정의

**항행(navigation)** 은 사용자가 자기 우주를 둘러보고 별에 다가가는 **카메라의 운동 규칙**이다. 두 시점(`nebula` 성운 조망 / `recall` 회상 근접)과 한 별로의 접근(fly-to)을 별개 화면이 아니라 **같은 우주의 다른 카메라 자세**로 잇는다. 카메라는 좌표를 만들지 않고 별의 좌표를 **읽어** 그 위를 날 뿐이다(헌법3). fly-to·focus가 읽는 별 좌표는 클라 **라이브 force-sim 좌표 버퍼**다(22) — `UniverseCanvas.LiveLayoutController`가 펌프하는 단일 `Float32Array`(슬롯 = `stars` 배열 인덱스)를 StarField·UniverseSynapses·FlyToController·FocusController 네 readers가 공유한다(`readBufferPosition`). 버퍼가 아직 없는 초기 프레임엔 `fibonacciStarPosition(i, n, seed)`(`shared/lib/layout.ts`)로 폴백한다. fly-to/focus는 버퍼를 직접(capture·매 프레임) 읽고, 시냅스는 settle 시 발행되는 좌표 스냅샷에 굽는다.

## 규칙 · 파라미터

### 카메라 모드 — 2종

| 모드 | 의미 | 카메라 거동 |
|---|---|---|
| `nebula` (성운 조망, 기본값) | 우주 전체를 밖에서 관찰 | 줌 범위 제한·아크볼 회전; 별 셸 안으로 못 들어옴 |
| `recall` (회상 근접) | 별 사이를 비행선처럼 항해 | 자유 근접 비행; 경계 안에 갇힘 |

- 모드 전환(`toggle` → `resetNonce` 증가)은 화면 교체가 아니라 **카메라 fly 보간**으로 시그니처 자세로 이어진다: `recall`은 우주 중심(0,0,0)으로 진입, `nebula`는 직전 떠난 조망 자세(없으면 `NEBULA_FRAME_DIST=110` 전체 프레이밍)로 복귀.
- 모드 전환 비행 보간 = `k = 1 − exp(−dt·4)`, 목표까지 `< 0.5`면 정차. 비행 중 줌 클램프·경계 클램프는 일시 해제(`transitioning`)된다.

### fly-to — 대상 별로의 부드러운 접근

`navigationActor.send({type:'FLY_TO_STAR', id})` → 진입 시 그 별의 **라이브 버퍼 좌표**(슬롯 = 배열 인덱스, fibonacci 폴백)를 타깃으로 잡아 `useFrame`에서 카메라 위치·`lookAt`(`controls.target`)을 보간해 이동, 도달(`ARRIVED`) 후 `focusActor`에 `SELECT_STAR`로 회상 패널을 연다(매 프레임 React state 금지 — ref 보간). 진입 시 `flyingToStar` 상태(tag `transitioning`)로 전환해 줌·경계 클램프를 풀고, `camera.up`을 월드업으로 재정렬한다.

| 파라미터 | 값 | 의미 |
|---|---|---|
| 감쇠 계수 | `k = 1 − exp(−dt·3)` | 프레임레이트 독립 lerp(시정수 ≈ 1/3 s) |
| 접근 정차 오프셋 | 대상 별 → 중심 방향 `12` 단위 | 별을 우주 안쪽에서 마주 봄(경계 밖으로 안 나감) |
| 도달 임계 | 목표 위치까지 `< 0.6` 단위 | 이 안에 들면 도달 → `select` 트리거, `transitioning` 해제 |

### `recall` 비행 물리 — 속도·가속·관성

| 파라미터 | 값 | 의미 |
|---|---|---|
| 순항 속도 `BASE_SPEED` | `16` u/s | 추력 유지 시 기본 전진 속도 |
| 부스트 상한 `MAX_BOOST` / 램프 `BOOST_RAMP` | `2×` / `1.4` s | 길게 누를수록 가속 |
| 추력 가속 `ACCEL_K` / 제동 `DRAG_K` | `2.4` / `4` (1/s) | 속도 ease-in / 관성 코스팅(τ≈0.25 s) |
| 시선 회전 `LOOK_BASE_RATE` | `1.4` rad/s | 자유 시선 기본 회전율 |
| 시선 부스트 `LOOK_MAX_BOOST` / 램프 `LOOK_BOOST_RAMP` | `2.2×` / `1.2` s | 길게 누를수록 회전 가속 |
| 시선 가속 `LOOK_ACCEL_K` / 제동 `LOOK_DRAG_K` | `5` / `3` (1/s) | 회전 ease-in / 관성 코스팅 |
| 비행 경계 `SHIP_BOUNDARY` | `STAR_SHELL_OUTER·0.85 ≈ 39` | 셸 안쪽에 갇혀 빈 가장자리로 못 나감 |
| 벽 반동 `RECOIL` / 재무장 `WALL_REARM` | `1.2` / `3` | 경계 접촉 시 안쪽 반동 + 1회 흔들림 |
| 미세 모션 `IDLE_AMP` | `0.09` 상시 | 정차 시에도 항상-온 엔진 흔들림(속도·충돌로 가산) |

### `nebula` 줌·회전

| 파라미터 | 값 | 의미 |
|---|---|---|
| 줌 범위 | `[OBSERVE_MIN_DIST=58, 1500]` | 별 셸 외곽(≈46) 밖에서만 관찰 |
| 회전 속도 `NEBULA_ROTATE_SPEED` | `2.4` rad / 캔버스폭 드래그 | 로컬 축 아크볼(극점 없음) |
| 회전 감쇠 `NEBULA_DAMP` | `9` /s | 릴리스 후 관성 회전 감쇠 |
| 돌리 감도 `NEBULA_ZOOM_SPEED` | `0.12` | 휠/핀치 줌 한 노치당 반경 비율 |
| 탭/드래그 데드존 | `8` px | 한 손가락이 이 미만 움직이면 **탭(=별 선택)**, 넘으면 **회전 드래그** — 탭하다 우주가 미끄러지거나, 끌어 돌리다 별이 잘못 선택되는 충돌을 가른다 |

- 모드 이탈 시 `camera.up`을 월드업(0,1,0)으로 재정렬해 아크볼 롤이 다른 모드로 새지 않게 한다.
- **탭 vs 회전(터치).** 포인터는 down 시점에 캡처해(업이 항상 캔버스로 돌아오게 — stale 포인터 방지) 두되, 회전은 데드존(8px)을 넘은 뒤에만 시작한다. 별 선택은 R3F `onClick`이되 `e.delta > 8`(드래그)면 무시한다 — 캡처는 별 `onClick`을 막지 않으므로, 탭=선택·드래그=회전이 양쪽 경로(카메라/선택)에서 함께 갈린다.
- **모바일 NavPad 한 손 배치.** recall 비행 D-pad는 모바일에서 추력(전진/후진)을 좌하단, 시선 회전을 우하단으로 갈라(`justify-between`) 양 엄지가 각자 한쪽을 잡고 "전진하며 회전"을 한 손에 친다(데스크톱은 좌측 한 묶음). 탐색 오버레이가 열리면 pad를 숨기고 이동을 0으로 정지한다.

### 별 포커스(focus)

별이 `select`로 선택되면 FocusController가 그 별을 화면 정면·중앙에 맞추고 패널이 열린 동안 유지한다(aim-lerp `FOCUS_K=4` /s). 타깃 좌표는 매 프레임 라이브 버퍼에서 읽어 아직 relax 중인 별도 따라간다. `recall`은 위치 고정·시선만 별로 회전, `nebula`는 같은 거리에서 별의 방사 방향으로 궤도 이동 후 수평 재정렬. 이때 NavController·NebulaOrbitController는 대기한다.

### 잠든 별 fly-to

잠든 별 오버레이(우주 셸 위, `?panel=dormant`) 항목 클릭 → `focusStar(memory_id)` → 위 fly-to 메커니즘으로 그 별로 이동(라우트 이동 없음 — 캔버스 영속) + 시트는 peek로 잦아듦 → 도달 후 회상으로 재점화. 잠든 별이라고 별도 카메라 경로를 쓰지 않는다.

### 우주 셸 영속 — 탐색은 라우트가 아니라 패널 상태

리스트·탐색(잠든 별·원본 일기·변천사)은 **별도 페이지로 우주를 떠나지 않는다**. 우주(`/`)의 WebGPU 캔버스는 **영속 셸**로 한 번만 마운트되고, 목록은 그 위 2D 오버레이로 떠오른다(모바일=바텀시트/데스크톱=떠있는 카드, 캔버스 밖 DOM). 화면 상시 버튼은 둘(카메라 시점 토글 + "메뉴" 런처)이고, 나머지 기능(만들기·일기·잠든 별·우주 공개·주고받은 별·테마)은 메뉴 뒤에 접는다. 결과·메뉴·기능은 모두 비차단 `Surface`로 띄운다(home-ia revamp). 오버레이를 여닫아도 캔버스·렌더러는 **재초기화되지 않는다**. 탐색은 라우트가 아니라 **셸 패널 상태**(`useShellStore{panel,peek}`)이며, 딥링크·뒤로가기는 `?panel=dormant|diary` search param으로만 동기화한다 — URL이 단일 출처이고 거울 이펙트 1개가 스토어에 반영한다(라우트 비증가; 옛 `/dormant`·`/universe` 라우트는 제거 — change 01). 항목을 고르면 시트가 peek(핸들)로 낮아지고 뒤 우주에서 fly-to/frame-all로 그 별(들)로 이동한다.

### 조망 프레이밍(frame-all) — 원본 일기의 모든 별

원본 일기 하나(`record_id`)를 고르면 그 일기에서 태어난 **모든 조각 별을 한 화면에 담는** far 자세로 카메라를 보간 이동한다(fly-to의 별 집합 확장). 별 집합의 라이브 좌표에서 **중심(centroid)·바운딩 반경 R** 을 매번 새로 구하고(흩어진 별도 그 순간 좌표로), 그 구를 화면에 채우는 거리 `d = R / sin(fov/2) · MARGIN`을 잡는다. `fov`는 세로·가로 화각 중 **작은 쪽**(세로·가로 모두 들어오게). 카메라 = 중심 + 방사 방향·`d`, `lookAt` = 중심.

| 파라미터 | 값 | 의미 |
|---|---|---|
| 여유 배수 `FRAME_MARGIN` | `1.3` | 바깥 별이 화면 가장자리에 딱 붙지 않게 |
| 거리 바닥 `FRAME_MIN_DISTANCE` | `12` | 반경≈0(단일 별 일기)일 때 단일 fly-to와 같은 근접으로 수렴(degenerate) |
| 거리 클램프 | `[OBSERVE_MIN_DIST=58, 1500]` | 조망은 nebula이므로 도착 자세를 그 줌 범위에 맞춰(도착 후 클램프 yank 없음) |
| 보간 감쇠 | `k = 1 − exp(−dt·4)` | 모드 전환 비행과 같은 ease, 목표까지 `< 0.5`면 정차 |

중심·반경·거리 계산은 **순수 함수**(`features/wayfinding/model/frame.ts`, three/DOM 미의존)고, 위젯 컨트롤러가 라이브 좌표를 읽어 적용한다(좌표는 읽기만 — 헌법3).

- **일기 카드 시선↑(view offset).** 일기를 고르면 하단에 일기 카드가 떠 있으므로, frame-all 위에 **투영 시선만 위로**(`ViewOffsetController`, 화면높이 1/6) 올려 별들이 카드에 가리지 않게 한다(모바일·데스크톱 공통). frame-all이 이미 화면에 맞췄으므로 **줌아웃은 하지 않는다**(별이 작아지지 않게 — 줌아웃은 모바일 작성/회상 시트 한정). 카드를 닫으면(배경 탭) 오프셋이 부드럽게 0으로 복귀.

### near/far 가드 — 근접=단일 엔그램만

일기 전체 조망(frame-all)은 **far(`nebula`)에서만** 일어난다. `recall`(근접)에서 조망을 요청하면 먼저 `nebula`로 전환하고 단일 포커스(`select`)를 풀고서 프레이밍한다. 반대로 카메라가 `recall`로 진입하면 일기 하이라이트는 해제된다 — **근접에서는 엔그램(단일 별) 단위만** 본다. 단일 엔그램 fly-to(`focusStar`)는 어느 모드에서나 허용된다.

## 불변식 (invariants)

- **3D 씬 안 DOM(`<Html>`) 금지.** 카메라·항행 컨트롤러는 씬 안에 DOM을 만들지 않는다(헌법8 — 모바일 이식성).
- **좌표는 클라 창발·서버는 그래프만.** 카메라는 좌표를 **읽기만** 하고 만들지 않는다. fly-to·focus·별 렌더·시냅스 렌더의 모든 reader가 같은 라이브 좌표 버퍼·같은 인덱싱(슬롯 = `stars` 배열 인덱스)을 공유한다 — 한 reader라도 옛 정적 fibonacci에 남으면 카메라가 렌더된 별을 놓친다(헌법3). fibonacci는 버퍼 미준비 시 폴백으로만 쓴다.
- **별은 삭제되지 않는다.** 잠든 별도 우주에 남아 클릭·항해로 접근 가능하다(헌법2). 항행은 별을 숨기거나 제거하지 않는다.
- **별은 거리로, 그리고 방향으로 움직인다(38).** 별은 고정이 아니라 강함(활성도+감정강도)에 따라 중심에서 멀어지고/가까워지고(회상→중앙·시간→바깥, 38), **방향(각도)도 시간이 흐르면 천천히 표류한다**(표상 부동, 38 — 데모 타임머신이 밤 경계마다 한 스텝 시연; 고립 별이 더, 연결 별이 덜; 프로덕션은 좌표 비영속이라 세션마다 재창발). 그래서 항행은 *고정 좌표*가 아니라 **검색·회상 fly-to로 별을 다시 찾는 행위**가 보장한다. fly-to·focus는 타깃을 **매 프레임 라이브 버퍼에서** 다시 읽으므로 거리·각도로 미끄러지는 별도 정확히 따라간다(고정 캡처 금지).
- **매 프레임 React state 구동 금지.** 카메라는 `useFrame`에서 ref/uniform으로만 갱신한다(헌법4 — 리렌더 폭발 방지).

## 구현 근거

- 카메라 모드·줌 클램프(`OBSERVE_MIN_DIST`/`SHIP_BOUNDARY`)·비행 물리(가속·관성·벽 반동)·아크볼 회전: 구현 plan 06 · `frontend/src/widgets/universe-canvas/model/navigation.machine.ts`(카메라 모드 FSM — tech/state-machines.md), `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`CameraRig`/`NavController`/`NebulaOrbitController`/`ModeTransitionController`).
- fly-to 보간(`k=1−exp(−dt·3)`, 오프셋 12, 임계 0.6)·잠든 별 도달·항행 머신 `FLY_TO_STAR`·포커스 머신 `SELECT_STAR`: 구현 plan 12 · `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`FlyToController`/`FocusController`), `frontend/src/features/dormant-search`.
- 우주 셸 영속·탐색=패널 상태(`?panel=` 동기화·캔버스 비재초기화): 구현 tech/overlay-shell.md · `frontend/src/pages/home/ui/HomePage.tsx`(셸 합성·URL↔스토어 거울 이펙트), `frontend/src/features/universe/model/shell-store.ts`(`useShellStore`), `frontend/src/shared/ui/{OverlayHost,Surface,BottomSheet,FloatingCard}.tsx`, `frontend/src/app/router.tsx`(index 라우트 `?panel=` 검증·동기화).
- 라이브 좌표 버퍼 단일 출처(네 reader 동기·fibonacci 폴백·`readBufferPosition`): 구현 plan 08·22 · `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`LiveLayoutController`), `frontend/src/shared/lib/force-sim/`, `frontend/src/shared/lib/layout.ts`.
- 별 반지름 이동(거리=강함)·fly-to/focus 매 프레임 라이브 추적: 구현 plan 38 · `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`radiusOf`·`FlyToController`/`FocusNavBridge`의 버퍼 재독), `frontend/src/shared/lib/layout.ts`(`targetRadius`).
- 별 각도 표류(표상 부동 — 밤마다 한 스텝)·항행=다시 찾기: 구현 plan 40 · `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`LiveLayoutController` `useFrame` 밤 경계 드리프트·`nightRef`), `frontend/src/shared/lib/layout.ts`(`applyAngularDrift`·`DRIFT_STEP_RAD`).
- 조망 프레이밍(frame-all 거리·반경·`FRAME_MARGIN`/`FRAME_MIN_DISTANCE`)·near/far 가드(근접=단일만): 구현 plan 28 · `frontend/src/features/wayfinding/model/frame.ts`(순수 `frameTarget`)·`model/store.ts`, `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`FrameAllController`/`RecallDismissGuard`).
