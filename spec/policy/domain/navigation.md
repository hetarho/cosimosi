# 항행·카메라 (navigation) (policy/domain/navigation)

> 현재 구현된 항행·카메라 운동(비행선 속도·가속도·관성)의 사실 정의.

## 정의

**항행(navigation)** 은 사용자가 자기 우주를 둘러보고 별에 다가가는 **카메라의 운동 규칙**이다. 두 시점(`nebula`=**멀리서 내 우주 보기** / `recall`=**별들 가까이서 탐험하기**)과 한 별로의 접근(fly-to)을 별개 화면이 아니라 **같은 우주의 다른 카메라 자세**로 잇는다. (change 08: 사용자-facing 용어는 `성운/회상`을 버린다 — `nebula`/`recall`은 내부 식별자일 뿐이고, `recall`은 카메라 모드명이지 도메인 행위 `RecallMemory`(회상·2초 dwell)와 별개다.) 카메라는 좌표를 만들지 않고 별의 좌표를 **읽어** 그 위를 날 뿐이다(헌법3). fly-to·focus가 읽는 별 좌표는 클라 **라이브 force-sim 좌표 버퍼**다(22) — `UniverseCanvas.LiveLayoutController`가 펌프하는 단일 `Float32Array`(슬롯 = `stars` 배열 인덱스)를 StarField·UniverseSynapses·FlyToController·FocusController 네 readers가 공유한다(`readBufferPosition`). 버퍼가 아직 없는 초기 프레임엔 `fibonacciStarPosition(i, n, seed)`(`shared/lib/layout.ts`)로 폴백한다. fly-to/focus는 버퍼를 직접(capture·매 프레임) 읽고, 시냅스는 settle 시 발행되는 좌표 스냅샷에 굽는다.

## 규칙 · 파라미터

### 카메라 모드 — 2종

> 사용자-facing 이름은 **멀리서 내 우주 보기**(`nebula`) / **별들 가까이서 탐험하기**(`recall`)다(change 08). 괄호 안 영문은 내부 식별자.

| 모드 | 의미 | 카메라 거동 |
|---|---|---|
| **멀리서 내 우주 보기** (`nebula`, 기본값) | 우주 전체를 밖에서 관찰 | 줌 범위 제한·아크볼 회전·두 손가락 pan·double-tap-hold zoom scrub; 별 셸 안으로 못 들어옴 |
| **별들 가까이서 탐험하기** (`recall`) | 별 사이를 비행선처럼 항해, 사용자가 이동 광원 | 자유 근접 비행(한 손가락 look·두 손가락 전후진); 경계 안에 갇힘 |

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
| 회전 속도 `gesture.far_rotate_speed` | `2.4` rad / 캔버스폭 드래그 | 로컬 축 아크볼(극점 없음) |
| 회전 감쇠 `gesture.far_damp` | `9` /s | 릴리스 후 관성 회전 감쇠 |
| 돌리 감도 `gesture.far_zoom_speed` | `0.12` | 휠/핀치 줌 한 노치당 반경 비율 |
| pan 속도 `gesture.far_pan_speed` | `1.0` | 두 손가락 centroid 이동 → world pan(반경 비례) |
| zoom scrub `gesture.far_zoom_scrub_*` | deadzone `8`px · speed `0.004` | double-tap-hold 세로 드래그 zoom |
| 탭/드래그 데드존 `gesture.drag_deadzone_px` | `8` px | 한 손가락이 이 미만 움직이면 **탭(=별 선택)**, 넘으면 **회전 드래그** — 탭하다 우주가 미끄러지거나, 끌어 돌리다 별이 잘못 선택되는 충돌을 가른다 |

> change 08(A14): 위 카메라 gesture 상수는 모두 `spec/values.yaml` `gesture` 그룹이 단일 출처다(옛 `NEBULA_*` 코드 상수 이전). 근접 모드 노브: `close_look_sensitivity 2.2`·`close_thrust_deadzone_px 6`·`close_thrust_full_px 90`·`double_tap_ms 300`·`double_tap_max_dist_px 24`.

- 모드 이탈 시 `camera.up`을 월드업(0,1,0)으로 재정렬해 아크볼 롤이 다른 모드로 새지 않게 한다.
- **탭 vs 회전(터치).** 포인터는 down 시점에 캡처해(업이 항상 캔버스로 돌아오게 — stale 포인터 방지) 두되, 회전은 데드존(8px)을 넘은 뒤에만 시작한다. 별 선택은 R3F `onClick`이되 `e.delta > 8`(드래그)면 무시한다 — 캡처는 별 `onClick`을 막지 않으므로, 탭=선택·드래그=회전이 양쪽 경로(카메라/선택)에서 함께 갈린다.
- **NavPad fallback화(change 08, A7).** D-pad는 더는 기본 조작 표면이 아니다 — **터치 지원 기기(`pointer: coarse`)에서는 렌더하지 않는다**(캔버스 제스처가 주 입력). **데스크톱(비터치)은 D-pad + `W/S/A/D/Arrow` 키보드**를 유지하고, 키보드 핸들러는 터치 여부와 무관하게 recall에서 항상 동작한다(렌더만 끔). 탐색 오버레이가 열리면(데스크톱) pad를 숨기고 이동을 0으로 정지한다.

### 제스처 문법 (Pointer Events, change 08)

캔버스는 Pointer Events 기반이고 표면에 **`touch-action: none`**(우주 캔버스 한정 — 전역 페이지 스크롤/뒤로가기 보존)을 적용한다. 연속 입력은 React state를 거치지 않고 ref 버퍼(`navigation-input`)와 `useFrame`로 흐른다. 순수 판정(deadzone·double-tap·centroid/spread·thrust ramp·pan/zoom scrub)은 `navigation-gesture`(three/React/DOM 미의존, 단위 테스트).

| 모드 | 입력 | 동작 |
|---|---|---|
| 멀리서 내 우주 보기 | 한 손가락 드래그 | 아크볼 회전(로컬 축, 극점 없음) — 데드존 넘은 뒤 시작 |
| 멀리서 내 우주 보기 | 두 손가락 이동 | centroid 이동 → 화면 평면 pan(`controls.target` 이동, 조망 기준점이 중앙에 안 묶임) + 거리 변화 → pinch zoom |
| 멀리서 내 우주 보기 | double-tap-hold + 세로 드래그 | zoom scrub(lock — 잠긴 동안 pan 없음). 위=zoom in, 아래=zoom out. wheel/pinch도 유지 |
| 별들 가까이서 탐험하기 | 한 손가락 드래그 | 고개 회전(좌우=yaw, 상하=pitch; 화살표 키와 같은 방향 감각) |
| 별들 가까이서 탐험하기 | 두 손가락 세로 쓸기 | 전진(위)/후진(아래). deadzone 이후 이동량 비례 ramp, 떼면 관성/제동으로 멈춤. 좌우 흔들림은 무시(세로 성분만) |

- **lock 규칙(A11).** 손가락 1→2 전환 시 look을 끝내고 thrust로 lock, 2→1 복귀 시 새 deadzone 전까지 look 재개 안 함. 탭=별 선택(R3F `onClick`, 서브-데드존 통과), 드래그/두 손가락/zoom scrub은 `gestureActive`를 세워 캔버스 `onPointerMissed` dismiss를 막는다(up 후 microtask까지 유지 → 동기 콜백을 넘김; 진짜 탭은 set 안 돼 통과).
- **stand down(A13).** `flyingToStar`·`framingDiary`·`modeTransition`·별 focus 중에는 제스처 컨트롤러가 비활성(useEffect 게이트) — 유도 비행/포커스 컨트롤러와 싸우지 않는다. 전환이 끝나면 해당 모드 제스처가 다시 붙는다.
- **값 단일 출처(A14).** deadzone·sensitivity·double-tap 시간/거리·pan/zoom 속도·far rotate/damp/zoom은 `spec/values.yaml` `gesture` 그룹에서 생성된 `VALUES.gesture.*`. 새 하드코딩 튜닝 숫자 없음.

### 이동 광원 — 별들 가까이서 탐험하기 (change 08 · spec 49)

근접 탐험에서 사용자는 **빛을 들고 별 사이를 움직이는 존재**다. `StarField.selfLightRef`(매 프레임 갱신 ref)가 **반사 채널만** 갱신한다(uniform — React rerender 없음). spec 49 이후 그 광원은 **카메라 어깨 너머(뒤+위) 앵커**이고, 같은 ref를 `SelfStar`(나 아바타)도 읽어 `recall`에서 함께 그 앵커로 항해한다(광원이 곧 나).

- **멀리서 보기:** 광원 = 중심 자아 별(원점·정적 `selfLightPos`) — 거리=강함의 광학적 읽기 보존(`selfLightRef.current = null` → 정적 폴백). `SelfStar`도 원점 고정(중심 닻, 헌법3).
- **가까이서 탐험하기:** 광원·아바타 위치 = **카메라 어깨 너머 앵커** `anchor = camPosBase − fwd·BACK + up·UP`(`fwd = normalize(target − camPos)`, `up = camera.up`; `BACK`=`star_lighting.recall_light_back_offset`, `UP`=`recall_light_up_offset`). `NavController`의 **shake 적용 전 깨끗한 항행 기준 위치**(`camPosBase`)에서 계산 — idle/벽 shake가 반사·아바타를 흔들지 않는다. 광원이 시야 뒤+위에 있어 **정면 비행 화면엔 안 들어오고**, 정면 별은 *뒤에서 위로* 비추는 빛을 받아 정면광·터미네이터 음영(입체)으로 선다(머리 위 플래시 회귀 제거). 멀리 있던 별에 다가가면 거리 falloff로 반사가 강해지되 **recency 곱 유지** — 최근 회상한 별은 확 타오르고 잠든 별은 은은하게만 반응한다. 아바타는 `SelfStar`에서 ease-lerp로 앵커를 따라붙어(전이의 원점↔앵커 점프를 매끄럽게 잇고 화면 중앙으로 튀어 bloom을 덮지 않게), 부유 그룹(`UniverseDrift`) 안이라 world 앵커를 부모 로컬로 변환해 광원과 한 점에 둔다.
- **채널 경계(불변).** 이동 광원·아바타 이동은 **반사 채널·렌더 위치만** 바꾼다 — `selfGlow`·`activation`·`λ_eff`·별 색·별 좌표·force-sim 권위·`A_MIN` 밝기 바닥은 불변. 진짜 `THREE.PointLight`를 별마다 만들지 않는다(헌법8 — TSL uniform 계산). 겹쳐보기(`UniverseOverlay`)는 각 우주의 기존 self-light 규칙 유지(이 변경 범위 밖).

### 별 포커스(focus)

별이 `select`로 선택되면 FocusController가 그 별을 화면 정면·중앙에 맞추고 패널이 열린 동안 유지한다(aim-lerp `FOCUS_K=4` /s). 타깃 좌표는 매 프레임 라이브 버퍼에서 읽어 아직 relax 중인 별도 따라간다. `recall`은 위치 고정·시선만 별로 회전, `nebula`는 같은 거리에서 별의 방사 방향으로 궤도 이동 후 수평 재정렬. 이때 NavController·NebulaOrbitController는 대기한다.

### 잠든 별 fly-to

잠든 별(망원경 탐색기 별 탭) 항목 클릭 → `focusStar(memory_id)` → 위 fly-to 메커니즘으로 그 별로 이동(라우트 이동 없음 — 캔버스 영속) + 시트는 peek로 잦아듦 → 도달 후 회상으로 재점화. 잠든 별이라고 별도 카메라 경로를 쓰지 않는다.

### 일기 페이지 → 우주 handoff (`?record=`)

독립 일기 페이지(`/diary`)의 "우주에서 보기"는 `/`로 `?record=<recordId>` 검색 파라미터를 달아 이동한다. 우주 셸(HomePage)이 이를 **1회 소비**한다 — 그 record의 별이 로드되면(`starsOfRecord`) `focusActor` `SELECT_DIARY`로 그 별들을 frame-all하고, **소비 후 파라미터를 지운다**. `?fly=`(잠든 별 딥링크)와 동일한 one-time-consume + clear 패턴이라 뒤로가기·새로고침이 frame-all을 무한 재발화하지 않는다. 좌표 권위는 여전히 클라 force-sim(헌법3).

### 우주 셸 영속 — 탐색은 라우트가 아니라 패널 상태

우주 내 탐색(잠든 별·일기 길찾기·변천사)은 **별도 페이지로 우주를 떠나지 않는다**. 우주(`/`)의 WebGPU 캔버스는 **영속 셸**로 한 번만 마운트되고, 망원경 탐색기는 그 위 2D 오버레이로 떠오른다(모바일=바텀시트/데스크톱=떠있는 카드, 캔버스 밖 DOM). 화면 상시 버튼은 둘(카메라 시점 토글 + "메뉴" 런처)이고, 나머지 기능(만들기·일기·잠든 별·우주 공개·주고받은 별·테마)은 메뉴 뒤에 접는다. 결과·메뉴·기능은 모두 비차단 `Surface`로 띄운다(home-ia revamp). 오버레이를 여닫아도 캔버스·렌더러는 **재초기화되지 않는다**. 탐색은 라우트가 아니라 **셸 상태**(`useShellStore`)이며 항목을 고르면 시트가 peek(핸들)로 낮아지고 뒤 우주에서 fly-to/frame-all로 그 별(들)로 이동한다.

- **레거시 `?panel=` 딥링크(1회 리다이렉트).** 옛 `?panel=dormant|diary` search param은 더는 영속 셸 상태가 아니라 망원경 탐색기로 진입하는 **1회 리다이렉트**다 — `?panel=dormant`는 탐색기 별 탭으로, `?panel=diary`는 탐색기 일기 탭으로 보낸 뒤 파라미터를 지운다. (원본 일기를 모두 읽는 표면은 이제 독립 라우트 `/diary`다 — 거기서 "우주에서 보기"로 `?record=` handoff. 옛 `/dormant`·`/universe` 라우트는 제거 — change 01.)

### 조망 프레이밍(frame-all) — 원본 일기의 모든 별

원본 일기 하나(`record_id`)를 고르면(망원경 탐색기 일기 탭, 또는 `/diary` 페이지에서 `?record=` handoff) 그 일기에서 태어난 **모든 조각 별을 한 화면에 담는** far 자세로 카메라를 보간 이동한다(fly-to의 별 집합 확장). 별 집합의 라이브 좌표에서 **중심(centroid)·바운딩 반경 R** 을 매번 새로 구하고(흩어진 별도 그 순간 좌표로), 그 구를 화면에 채우는 거리 `d = R / sin(fov/2) · MARGIN`을 잡는다. `fov`는 세로·가로 화각 중 **작은 쪽**(세로·가로 모두 들어오게). 카메라 = 중심 + 방사 방향·`d`, `lookAt` = 중심.

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
- 제스처 항행(change 08 — `touch-action:none`·pan·zoom scrub·근접 look/thrust·이동 광원·NavPad fallback·onPointerMissed 가드): 구현 plan 06·change 08 · `frontend/src/widgets/universe-canvas/model/{navigation-input.ts,navigation-gesture.ts}`(순수 ref 버퍼 + 제스처 수학·단위 테스트), `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`NebulaOrbitController` pan/zoom scrub·`CloseGestureController`·`NavController` 합성·`selfLightRef`), `frontend/src/entities/star/ui/StarField.tsx`(`selfLightRef` per-frame uniform), `frontend/src/pages/home/ui/HomePage.tsx`(용어·`NavPad` 터치 fallback), `spec/values.yaml` `gesture`.
- fly-to 보간(`k=1−exp(−dt·3)`, 오프셋 12, 임계 0.6)·잠든 별 도달·항행 머신 `FLY_TO_STAR`·포커스 머신 `SELECT_STAR`: 구현 plan 12 · `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`FlyToController`/`FocusController`), `frontend/src/features/dormant-search`.
- 우주 셸 영속·탐색=셸 상태(캔버스 비재초기화)·`?panel=` 레거시 1회 리다이렉트·`?record=` 일기 페이지 handoff(1회 소비+clear): 구현 tech/overlay-shell.md · `frontend/src/pages/home/ui/HomePage.tsx`(셸 합성·`?record=`/`?fly=` 1회 소비), `frontend/src/pages/diary/`(`/diary` 페이지·"우주에서 보기"), `frontend/src/features/universe/model/shell-store.ts`(`useShellStore`), `frontend/src/shared/ui/{OverlayHost,Surface,BottomSheet,FloatingCard}.tsx`, `frontend/src/app/router.tsx`(index 라우트 검증·`?panel=` 레거시 리다이렉트·`/diary` 보호 라우트).
- 라이브 좌표 버퍼 단일 출처(네 reader 동기·fibonacci 폴백·`readBufferPosition`): 구현 plan 08·22 · `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`LiveLayoutController`), `frontend/src/shared/lib/force-sim/`, `frontend/src/shared/lib/layout.ts`.
- 별 반지름 이동(거리=강함)·fly-to/focus 매 프레임 라이브 추적: 구현 plan 38 · `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`radiusOf`·`FlyToController`/`FocusNavBridge`의 버퍼 재독), `frontend/src/shared/lib/layout.ts`(`targetRadius`).
- 별 각도 표류(표상 부동 — 밤마다 한 스텝)·항행=다시 찾기: 구현 plan 40 · `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`LiveLayoutController` `useFrame` 밤 경계 드리프트·`nightRef`), `frontend/src/shared/lib/layout.ts`(`applyAngularDrift`·`DRIFT_STEP_RAD`).
- 조망 프레이밍(frame-all 거리·반경·`FRAME_MARGIN`/`FRAME_MIN_DISTANCE`)·near/far 가드(근접=단일만): 구현 plan 28 · `frontend/src/features/wayfinding/model/frame.ts`(순수 `frameTarget`)·`model/store.ts`, `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`FrameAllController`/`RecallDismissGuard`).
