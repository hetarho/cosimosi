# 우주 (universe) 도메인 정책 (policy/domain/universe)

> 현재 구현된 우주 전체(별·시냅스가 모인 3D 공간)의 사실 정의.

## 정의

우주는 별(기억)과 시냅스(연결)의 그래프를 3D 공간에 형상화한 것이다. 개별 별·시냅스의 규칙은 각 도메인 정책(star/synapse)에 두고, **이 문서는 그것들이 모인 전체 차원**만 정의한다: (1) 별 좌표가 어떻게 배치되는가, (2) 좌표의 권위가 어디 있는가, (3) 배경이 무엇을 비추는가, (4) 무엇이 절대 사라지지 않는가.

별 좌표는 클라의 **라이브 force-sim**(순수 Barnes-Hut, `shared/lib/force-sim`)에서 창발한다(22). `UniverseCanvas`의 `LiveLayoutController`가 별·시냅스 그래프로 단일 좌표 버퍼를 펌프하고 네 readers 전부에 공급한다. **좌표는 두 축으로 나뉜다(38): 거리(반지름)는 강함, 방향(각도)은 연결.** 우주 중심에는 **자아("나") 별**이 떠 있고(그래프 비참여), 각 기억은 강함(`activation`(최근성, 12) + 감정 강도)에 따라 그 중심에서 떨어진다 — 자주·최근 떠올린 강렬한 기억일수록 가깝고, 잊혀갈수록 바깥. 회상하면 강함↑로 **중앙으로**, 시간이 지나면 강함↓로 **바깥으로** 미끄러지고, 새 기억은 가장 강하므로 **중앙 근처에서 태어난다**. 방향(각도·이웃)은 여전히 그래프 스프링·척력과 22의 흥분성 편향이 정한다. 새 조각은 가장 뜨거운 성단의 *각도* 근처에 시드된다(`seedNearCluster`). 버퍼가 아직 없는 초기 프레임은 `fibonacciStarPosition`(방향)으로 폴백한다. 우주의 배경은 테마 깊은 베이스색 위에 **요즘 상태(ambient)** 가 여러 넓은 광원으로 번지는 한 겹을 더한다(25 — 아래 §요즘 상태 배경). 야간 공고화는 plan 27에서 다룬다(아직 정책 아님).

## 규칙 · 파라미터

### 좌표 (coordinates)

| 규칙 | 값 / 조건 |
|---|---|
| 별 좌표 | 클라 라이브 force-sim이 펌프하는 단일 `Float32Array` 버퍼. 슬롯 = `stars` 배열 인덱스 = InstancedMesh 인스턴스 인덱스(1:1). 폴백/초기 시드 *방향* 은 `fibonacciStarPosition(i, n, seed)` |
| 반지름 = 강함 (38) | 중심 거리 `targetRadius = lerp(R_MIN 8, R_MAX 60, 1 − strength)`, `strength = clamp(W_ACT 0.7·activation + W_INT 0.3·intensity, 0, 1)`. force-sim **반지름 셸 힘**(`SimNode.radius`·`SimParams.radialStrength`)이 각 별을 그 셸로 당기고, 척력이 같은 셸 위에서 각도로 흩는다 |
| 각도 = 연결 (38) | 방향은 그래프 스프링·척력 + 22 흥분성 편향(`seedNearCluster`)이 정한다. 모든 기억 별은 free(반지름으로 호흡)지만 `prevPos` resume으로 각도 연속성 보존 — 회상·시간으로 *반지름만* 미끄러지고 방향은 유지 |
| 자아 별 (38) | 우주 중심의 단일 앵커("나"). **그래프 비참여**(연결·KNN·시냅스 없음), `selfObject` 폼 2–3종(기본 nebula-heart). 강한 기억이 그 곁에 모인다 |
| 재이완 정책 | settle 후 정적. 새 별·회상·시간감쇠로 목표 반지름이 임계(0.5) 넘게 변하면 `alpha` 재상승(re-kick)해 부드럽게 활강, 그 외엔 매 프레임 재계산 없음 |
| 좌표 일치 | StarField·UniverseSynapses·FlyToController·FocusController **네 readers**가 동일한 라이브 버퍼·동일 인덱싱을 읽어 fly-to/focus가 렌더된 바로 그 별에 도달한다(어긋남 0). StarField·FlyTo·Focus는 버퍼를 직접 읽고, 시냅스는 settle 시 발행되는 좌표 스냅샷에 굽는다 |
| 좌표 권위 | 서버는 좌표를 저장하지 않는다 — **가중치 그래프만** 권위. 좌표(반지름·각도 모두)는 클라가 산출한다 |
| 별 먼지(star dust) | 마운트 시 `mulberry32` 시드로 1회 생성한 정적 포인트 클라우드(count=1500, 반지름 35~145); 그래프와 독립이라 빈 우주(별 0개)에서도 배경·먼지만 렌더되고 크래시하지 않는다 |

### 배경 (background)

| 규칙 | 값 / 조건 |
|---|---|
| 우주 배경색 | 선택한 테마의 깊은 배경색 한 겹 — `themeBg(theme)`(vast `#070b1e` / lively `#120617` / calm `#04140f`) |
| 테마 ↔ 별색 분리 | 배경은 테마(깊이), 별색은 mood(7색 의미 팔레트)로 독립. 테마 변경이 별의 mood 색을 바꾸지 않는다 |
| 먼지 디밍 | 별 선택(focus) 시 별 먼지 불투명도 0.5 → 0.14로 낮춰 선택 별만 밝게(스포트라이트) |

### 요즘 상태 배경 (ambient mood, 25)

개별 별이 *과거의 한 순간*이라면 **배경은 "지금의 나"** 다 — 최근 조각들의 감정을 7일로 시간가중 종합해, 우세한 감정 몇을 각각 하나의 넓은 광원으로 흩뿌려 테마 베이스색 위에 가산한다. 단일 톤이 아니라 군데군데 번지는 불규칙한 빛이다.

| 규칙 | 값 / 조건 |
|---|---|
| 종합 요약 (서버) | `GetUniverse`가 최근 7일(`TAU_MOOD=7d`) 윈도의 조각 감정(`mood·intensity·valence·last_recalled_at`)을 가중치 `w = intensity·exp(-Δt/τ)`로 종합해 `AmbientMood{hue,sat,arousal,valence}`로 응답. `arousal = 1−exp(-Σw)` ∈ [0,1), `valence = Σ(w·v)/Σw`, `hue/sat` = 강도가중 mood-RGB 블렌드의 HSV. 쿼리 `since = now − τ·3`(≈21일, exp 무시 가능 지점). 빈 우주 → 중립 0값. **좌표·광원 위치 필드 없음**(헌법3) |
| 다중 광원 배경 (클라) | `AmbientNebula`가 로드된 별에서 우세 감정 **top-K(≤6, 상대 비중 <0.04 버림)** 를 각각 하나의 넓고 부드러운 **가산(additive) 빌보드**로, `mulberry32` 시드 불규칙 배치(반경 120~200 구면, 별 구름 밖)·`depthWrite/depthTest=false`·`renderOrder<0`로 별·시냅스 뒤에 둔다. 카메라가 움직이면 3D 시차로 깊이가 산다 |
| 광원 색 | 각 풀 색 = `moodRgb(mood)`(테마 무관 7색 의미 팔레트)를 **valence로 온도·채도 보정**(양→따뜻·채도↑(금/장미), 음→차갑·탁(청록/보라)). 풀 밝기·크기 = `arousal`·상대 비중. 색의 의미는 테마와 무관하게 유지(테마=깊이, mood=요즘색) |
| 색 분포 권위 | 서버는 **요약(ambient)만**, 다중 광원의 **색 분포는 클라가 별에서 파생**(`ambientLights`/`deriveAmbient` — 좌표·렌더 입력은 클라 권위, 헌법3). 서버 `ambient` 미수신(데모·구버전)이면 클라가 같은 7일 종합으로 폴백 |
| 애니메이션 | BloomPass(`RenderPipeline`)가 내장 TSL `time` 노드를 진전시키지 않으므로, ambient 변경 시 **~0.8s 색 크로스페이드**·느린 드리프트·일렁임을 `useFrame` **수동 uniform**으로 구동(`StarField.update`·`Synapse uTime`과 같은 관용). `prefers-reduced-motion`이면 드리프트·일렁임 정지, 색만 유지 |
| 흥분성 게인 | `g = 1 + 0.3·arousal`(arousal만; ∈[1,1.3])을 도메인 헬퍼(`memory.ExcitabilityGain` / `entities/memory excitabilityGain`)로 정의. 현재 할당 바이어스 `W_EXC`(22)에는 배선돼 있지 않다 — `worker.go`에 배선 지점 주석만(라이브 스케일은 27 야간 공고화 seam) |

### 삭제 없음 (no deletion)

| 규칙 | 값 / 조건 |
|---|---|
| 별 | 시간 감쇠해도 유효 밝기 `A_MIN=0.05` 바닥 위 유지, 행 삭제 0건(밝기만 낮춤) |
| 시냅스 | 밝기 = `weight·max(A_MIN, activation)`로 낮추되 행 삭제 0건 |
| 기존 별 안정 (38 정제) | 기존 별의 **각도(방향)** 는 `prevPos` resume으로 보존되어 새 별 추가가 그 방향을 흔들지 않는다. **반지름** 만 강함(활성도·감정강도)에 따라 변한다 — "내 기억이 그 방향에 있다"는 유지되고, 거리만 호흡한다(헌법3 정제) |

## 불변식 (invariants)

- **무엇도 삭제하지 않는다(헌법2).** 감쇠·잠듦 어느 경우에도 `memories`/`memory_links`/`records` 행을 물리 삭제하지 않는다 — 별·시냅스는 밝기만 바뀌고 행은 남아 클릭 가능하다.
- **좌표는 클라, 서버는 그래프만(헌법3).** 서버는 좌표를 저장하지 않고 가중치 그래프만 권위로 둔다. proto DTO에 좌표/위치 필드가 없다. (38: 반지름=강함·각도=연결로 좌표를 두 축으로 나누되, 둘 다 여전히 클라 창발 — "기존 별 pin"은 "각도 안정·반지름 변동"으로 정제.)
- **좌표 일치(헌법8).** 네 readers가 동일한 라이브 좌표 버퍼·동일한 배열 인덱싱을 공유해 렌더 별·시냅스 끝점·fly-to·focus 좌표가 항상 일치한다(어긋남 0). 정적 fibonacci는 버퍼 미준비 시 폴백으로만 잔존한다.
- **순수성(헌법4).** `shared/lib/layout.ts`(좌표 식·`strength`·`targetRadius`)·`shared/lib/force-sim`(순수 tick·반지름 셸 힘·`seedNearCluster`)은 `three`/React/DOM을 import하지 않는다(모바일 재사용).
- **씬 내 DOM 금지(헌법4).** `UniverseCanvas`의 R3F 씬 안에 `<Html>` DOM을 넣지 않는다 — 라벨·HUD는 별도 2D widget.

## 구현 근거

- 라이브 force-sim 좌표 구동 · 네 reader 단일 버퍼 · 별 먼지: 구현 plan 06·07·22 · `frontend/src/shared/lib/force-sim/`(`createSim`·`tick`·`seedNearCluster`), `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`LiveLayoutController`·`readBufferPosition`·StarDust·UniverseSynapses·FlyTo/FocusController), `frontend/src/entities/star/ui/StarField.tsx`
- 반지름=강함·각도=연결 · 자아 별 · 재이완: 구현 plan 38 · `frontend/src/shared/lib/layout.ts`(`strength`·`targetRadius`·`R_MIN`/`R_MAX`), `frontend/src/shared/lib/force-sim/{types.ts,sim.ts}`(`radius`·`radialStrength`·셸 힘), `frontend/src/widgets/universe-canvas/ui/{UniverseCanvas.tsx,SelfStar.tsx}`(`radiusOf`·re-kick·자아 별), `frontend/src/entities/appearance/model/self-objects.ts`(`SELF_OBJECTS`)
- 좌표 권위 = 서버 그래프만 · fibonacci 폴백: 구현 plan 07·22 · `frontend/src/shared/lib/force-sim/types.ts`(순수 입출력 계약, 좌표 미저장), `frontend/src/shared/lib/layout.ts`
- 우주 배경색 · 테마 분리: 구현 plan 06 · `frontend/src/entities/appearance/model/themes.ts`(`themeBg`), `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`
- 요즘 상태(ambient) 배경 · 다중 광원 · 흥분성 게인: 구현 plan 25 · `backend/internal/memory/memory.go`(`AmbientMood`·`AggregateAmbient`·`ExcitabilityGain`·`moodRGB`·`rgbToHueSat`)·`service.go`(`GetUniverse`)·`db/queries/memory.sql`(`ListRecentForAmbient`), `frontend/src/entities/memory/model/ambient.ts`(`deriveAmbient`·`ambientLights`·`ambientToRgb`·`excitabilityGain`), `frontend/src/widgets/universe-canvas/ui/AmbientNebula.tsx`, `backend/internal/job/worker.go`(W_EXC 배선 지점 주석)
- 밝기 바닥 · 삭제 없음: 구현 plan 08·12 · `frontend/src/entities/memory/model/activation.ts`(`A_MIN`, `starBrightness`, `synapseBrightness`)
- 렌더 셸(WebGPU·WebGL2 폴백·노드 Bloom·씬 내 DOM 금지): 구현 plan 06 · `frontend/src/shared/lib/r3f/`, `frontend/src/widgets/universe-canvas/ui/BloomPass.tsx`
