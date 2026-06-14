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

`focusStarId` 설정 → 진입 시 그 별의 **라이브 버퍼 좌표**(슬롯 = 배열 인덱스, fibonacci 폴백)를 타깃으로 잡아 `useFrame`에서 카메라 위치·`lookAt`(`controls.target`)을 보간해 이동, 도달 후 `select(id)`로 회상 패널을 연다(매 프레임 React state 금지 — ref 보간). 진입 시 `mode='recall'`·`transitioning=true`로 전환해 줌·경계 클램프를 풀고, `camera.up`을 월드업으로 재정렬한다.

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

- 모드 이탈 시 `camera.up`을 월드업(0,1,0)으로 재정렬해 아크볼 롤이 다른 모드로 새지 않게 한다.

### 별 포커스(focus)

별이 `select`로 선택되면 FocusController가 그 별을 화면 정면·중앙에 맞추고 패널이 열린 동안 유지한다(aim-lerp `FOCUS_K=4` /s). 타깃 좌표는 매 프레임 라이브 버퍼에서 읽어 아직 relax 중인 별도 따라간다. `recall`은 위치 고정·시선만 별로 회전, `nebula`는 같은 거리에서 별의 방사 방향으로 궤도 이동 후 수평 재정렬. 이때 NavController·NebulaOrbitController는 대기한다.

### 잠든 별 fly-to

`/dormant` 항목 클릭 → `focusStar(memory_id)` → `/universe` 이동 → 위 fly-to 메커니즘으로 동일하게 그 별로 이동 → 도달 후 회상으로 재점화. 잠든 별이라고 별도 카메라 경로를 쓰지 않는다.

### 조망 프레이밍(frame-all) — 원본 일기의 모든 별

원본 일기 하나(`record_id`)를 고르면 그 일기에서 태어난 **모든 조각 별을 한 화면에 담는** far 자세로 카메라를 보간 이동한다(fly-to의 별 집합 확장). 별 집합의 라이브 좌표에서 **중심(centroid)·바운딩 반경 R** 을 매번 새로 구하고(흩어진 별도 그 순간 좌표로), 그 구를 화면에 채우는 거리 `d = R / sin(fov/2) · MARGIN`을 잡는다. `fov`는 세로·가로 화각 중 **작은 쪽**(세로·가로 모두 들어오게). 카메라 = 중심 + 방사 방향·`d`, `lookAt` = 중심.

| 파라미터 | 값 | 의미 |
|---|---|---|
| 여유 배수 `FRAME_MARGIN` | `1.3` | 바깥 별이 화면 가장자리에 딱 붙지 않게 |
| 거리 바닥 `FRAME_MIN_DISTANCE` | `12` | 반경≈0(단일 별 일기)일 때 단일 fly-to와 같은 근접으로 수렴(degenerate) |
| 거리 클램프 | `[OBSERVE_MIN_DIST=58, 1500]` | 조망은 nebula이므로 도착 자세를 그 줌 범위에 맞춰(도착 후 클램프 yank 없음) |
| 보간 감쇠 | `k = 1 − exp(−dt·4)` | 모드 전환 비행과 같은 ease, 목표까지 `< 0.5`면 정차 |

중심·반경·거리 계산은 **순수 함수**(`features/wayfinding/model/frame.ts`, three/DOM 미의존)고, 위젯 컨트롤러가 라이브 좌표를 읽어 적용한다(좌표는 읽기만 — 헌법3).

### near/far 가드 — 근접=단일 엔그램만

일기 전체 조망(frame-all)은 **far(`nebula`)에서만** 일어난다. `recall`(근접)에서 조망을 요청하면 먼저 `nebula`로 전환하고 단일 포커스(`select`)를 풀고서 프레이밍한다. 반대로 카메라가 `recall`로 진입하면 일기 하이라이트는 해제된다 — **근접에서는 엔그램(단일 별) 단위만** 본다. 단일 엔그램 fly-to(`focusStar`)는 어느 모드에서나 허용된다.

## 불변식 (invariants)

- **3D 씬 안 DOM(`<Html>`) 금지.** 카메라·항행 컨트롤러는 씬 안에 DOM을 만들지 않는다(헌법8 — 모바일 이식성).
- **좌표는 클라 창발·서버는 그래프만.** 카메라는 좌표를 **읽기만** 하고 만들지 않는다. fly-to·focus·별 렌더·시냅스 렌더의 모든 reader가 같은 라이브 좌표 버퍼·같은 인덱싱(슬롯 = `stars` 배열 인덱스)을 공유한다 — 한 reader라도 옛 정적 fibonacci에 남으면 카메라가 렌더된 별을 놓친다(헌법3). fibonacci는 버퍼 미준비 시 폴백으로만 쓴다.
- **별은 삭제되지 않는다.** 잠든 별도 우주에 남아 클릭·항해로 접근 가능하다(헌법2). 항행은 별을 숨기거나 제거하지 않는다.
- **별은 거리로 움직인다(38).** 별은 고정이 아니라 강함(활성도+감정강도)에 따라 중심에서 멀어지고/가까워진다(회상→중앙·시간→바깥). fly-to·focus는 타깃을 **매 프레임 라이브 버퍼에서** 다시 읽으므로 아직 미끄러지는 별도 정확히 따라간다(고정 캡처 금지).
- **매 프레임 React state 구동 금지.** 카메라는 `useFrame`에서 ref/uniform으로만 갱신한다(헌법4 — 리렌더 폭발 방지).

## 구현 근거

- 카메라 모드·줌 클램프(`OBSERVE_MIN_DIST`/`SHIP_BOUNDARY`)·비행 물리(가속·관성·벽 반동)·아크볼 회전: 구현 plan 06 · `frontend/src/widgets/universe-canvas/model/use-camera-mode.ts`, `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`CameraRig`/`NavController`/`NebulaOrbitController`/`ModeTransitionController`).
- fly-to 보간(`k=1−exp(−dt·3)`, 오프셋 12, 임계 0.6)·잠든 별 도달·`focusStarId`/`focusStar`: 구현 plan 12 · `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`FlyToController`/`FocusController`), `frontend/src/pages/dormant`.
- 라이브 좌표 버퍼 단일 출처(네 reader 동기·fibonacci 폴백·`readBufferPosition`): 구현 plan 08·22 · `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`LiveLayoutController`), `frontend/src/shared/lib/force-sim/`, `frontend/src/shared/lib/layout.ts`.
- 별 반지름 이동(거리=강함)·fly-to/focus 매 프레임 라이브 추적: 구현 plan 38 · `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`radiusOf`·`FlyToController`/`FocusController`의 버퍼 재독), `frontend/src/shared/lib/layout.ts`(`targetRadius`).
- 조망 프레이밍(frame-all 거리·반경·`FRAME_MARGIN`/`FRAME_MIN_DISTANCE`)·near/far 가드(근접=단일만): 구현 plan 28 · `frontend/src/features/wayfinding/model/frame.ts`(순수 `frameTarget`)·`model/store.ts`, `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`FrameAllController`/`NearFarHighlightGuard`).
