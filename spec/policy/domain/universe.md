# 우주 (universe) 도메인 정책 (policy/domain/universe)

> 현재 구현된 우주 전체(별·시냅스가 모인 3D 공간)의 사실 정의.

## 정의

우주는 별(기억)과 시냅스(연결)의 그래프를 3D 공간에 형상화한 것이다. 개별 별·시냅스의 규칙은 각 도메인 정책(star/synapse)에 두고, **이 문서는 그것들이 모인 전체 차원**만 정의한다: (1) 별 좌표가 어떻게 배치되는가, (2) 좌표의 권위가 어디 있는가, (3) 배경이 무엇을 비추는가, (4) 무엇이 절대 사라지지 않는가.

현재 별 좌표는 클라에서 **결정론적 `fibonacciStarPosition(index, seed)` 정적 배치**로 결정된다. `shared/lib/force-sim`에 순수 Barnes-Hut tick 모듈이 존재하지만 `UniverseCanvas`가 라이브 좌표 버퍼를 공급하지 않아 **현재 좌표를 구동하지 않는다**(`StarField`의 `positionsRef`가 비어 정적 fibonacci로 폴백). 라이브 force-sim 좌표 구동·경쟁적 할당·요즘 상태(ambient) 배경·야간 공고화는 plan 16~27에서 다룬다(아직 정책 아님).

## 규칙 · 파라미터

### 좌표 (coordinates)

| 규칙 | 값 / 조건 |
|---|---|
| 별 좌표 | 클라 `fibonacciStarPosition(i, n, seed)` — 피보나치 구면, 반지름 `r = 22 + seed·24`(별 셸 외곽 ≈ 46). 배열 인덱스 = 별 슬롯 = InstancedMesh 인스턴스 인덱스(1:1) |
| 좌표 일치 | StarField·UniverseSynapses·FlyToController·FocusController **네 readers**가 동일한 `fibonacciStarPosition`을 읽어 렌더 좌표가 어긋나지 않는다 |
| 정적 배치 | 좌표는 마운트 시 1회 설정되어 정적이다. 라이브 좌표 버퍼(`positionsRef`)가 없으면 useFrame 위치 갱신은 no-op(움직이지 않는 씬을 매 프레임 재업로드하지 않음) |
| 좌표 권위 | 서버는 좌표를 저장하지 않는다 — **가중치 그래프만** 권위. 좌표는 클라가 산출한다 |
| 별 먼지(star dust) | 마운트 시 `mulberry32` 시드로 1회 생성한 정적 포인트 클라우드(count=1500, 반지름 35~145); 그래프와 독립이라 빈 우주(별 0개)에서도 배경·먼지만 렌더되고 크래시하지 않는다 |

### 배경 (background)

| 규칙 | 값 / 조건 |
|---|---|
| 우주 배경색 | 선택한 테마의 깊은 배경색 한 겹 — `themeBg(theme)`(vast `#070b1e` / lively `#120617` / calm `#04140f`) |
| 테마 ↔ 별색 분리 | 배경은 테마(깊이), 별색은 mood(7색 의미 팔레트)로 독립. 테마 변경이 별의 mood 색을 바꾸지 않는다 |
| 먼지 디밍 | 별 선택(focus) 시 별 먼지 불투명도 0.5 → 0.14로 낮춰 선택 별만 밝게(스포트라이트) |

### 삭제 없음 (no deletion)

| 규칙 | 값 / 조건 |
|---|---|
| 별 | 시간 감쇠해도 유효 밝기 `A_MIN=0.05` 바닥 위 유지, 행 삭제 0건(밝기만 낮춤) |
| 시냅스 | 밝기 = `weight·max(A_MIN, activation)`로 낮추되 행 삭제 0건 |
| 기존 별 안정 | 정적 fibonacci 배치라 새 별 추가가 기존 별의 좌표를 흔들지 않는다 |

## 불변식 (invariants)

- **무엇도 삭제하지 않는다(헌법2).** 감쇠·잠듦 어느 경우에도 `memories`/`memory_links`/`records` 행을 물리 삭제하지 않는다 — 별·시냅스는 밝기만 바뀌고 행은 남아 클릭 가능하다.
- **좌표는 클라, 서버는 그래프만(헌법3).** 서버는 좌표를 저장하지 않고 가중치 그래프만 권위로 둔다. proto DTO에 좌표/위치 필드가 없다.
- **좌표 일치(헌법8).** 네 readers가 동일한 `fibonacciStarPosition`·동일한 배열 인덱싱을 공유해 렌더 별·시냅스 끝점·fly-to·focus 좌표가 항상 일치한다.
- **순수성(헌법4).** `shared/lib/layout.ts`(좌표 식)·`shared/lib/force-sim`(순수 tick 모듈)은 `three`/React/DOM을 import하지 않는다(모바일 재사용).
- **씬 내 DOM 금지(헌법4).** `UniverseCanvas`의 R3F 씬 안에 `<Html>` DOM을 넣지 않는다 — 라벨·HUD는 별도 2D widget.

## 구현 근거

- 좌표 정적 배치 · 좌표 일치 · 별 먼지: 구현 plan 06·07 · `frontend/src/shared/lib/layout.ts`, `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(StarDust·UniverseSynapses·FlyTo/FocusController), `frontend/src/entities/star/ui/StarField.tsx`
- 좌표 권위 = 서버 그래프만: 구현 plan 07 · `frontend/src/shared/lib/force-sim/types.ts`(순수 입출력 계약, 좌표 미저장)
- 우주 배경색 · 테마 분리: 구현 plan 06 · `frontend/src/entities/appearance/model/themes.ts`(`themeBg`), `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`
- 밝기 바닥 · 삭제 없음: 구현 plan 08·12 · `frontend/src/entities/memory/model/activation.ts`(`A_MIN`, `starBrightness`, `synapseBrightness`)
- 렌더 셸(WebGPU·WebGL2 폴백·노드 Bloom·씬 내 DOM 금지): 구현 plan 06 · `frontend/src/shared/lib/r3f/`, `frontend/src/widgets/universe-canvas/ui/BloomPass.tsx`
