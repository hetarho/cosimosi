# 우주 (universe) 도메인 정책 (policy/domain/universe)

> 현재 구현된 우주 전체(별·시냅스가 모인 3D 공간)의 사실 정의.

## 정의

우주는 별(기억)과 시냅스(연결)의 그래프를 3D 공간에 형상화한 것이다. 개별 별·시냅스의 규칙은 각 도메인 정책(star/synapse)에 두고, **이 문서는 그것들이 모인 전체 차원**만 정의한다: (1) 별 좌표가 어떻게 배치되는가, (2) 좌표의 권위가 어디 있는가, (3) 배경이 무엇을 비추는가, (4) 무엇이 절대 사라지지 않는가.

별 좌표는 클라의 **라이브 force-sim**(순수 Barnes-Hut, `shared/lib/force-sim`)에서 창발한다(22). `UniverseCanvas`의 `LiveLayoutController`가 별·시냅스 그래프로 단일 좌표 버퍼를 펌프하고 네 readers 전부에 공급한다. **좌표는 두 축으로 나뉜다(38): 거리(반지름)는 강함, 방향(각도)은 연결.** 우주 중심에는 **자아("나") 별**이 떠 있고(그래프 비참여), 각 기억은 강함(`activation`(최근성, 12) + 감정 강도)에 따라 그 중심에서 떨어진다 — 자주·최근 떠올린 강렬한 기억일수록 가깝고, 잊혀갈수록 바깥. 회상하면 강함↑로 **중앙으로**, 시간이 지나면 강함↓로 **바깥으로** 미끄러지고, 새 기억은 가장 강하므로 **중앙 근처에서 태어난다**. 방향(각도·이웃)은 그래프 스프링·척력과 22의 흥분성 편향이 정하되, 이 힘들은 **접선(각도)만** 바꾸고 거리(반지름)는 반지름 셸 힘이 독점한다(38 — 연결이 새 별을 바깥 이웃 셸로 끌어내지 못한다). 새 조각은 가장 뜨거운 성단의 *각도* 근처에 시드되고(`seedNearCluster`), 이웃이 아직 없으면 **분산 방향**(`scatterDirection` — 황금각 나선 아님)으로 떨어진다(38). 게다가 **데모**에선 별의 방향이 밤 경계마다 한 스텝씩 천천히 표류한다(표상 부동, 38 — 고정축 회전·반지름 보존; 프로덕션은 좌표 비영속(헌법3)이라 세션 중 정적). 버퍼가 아직 없는 초기 프레임 렌더는 `fibonacciStarPosition`(방향)으로 폴백한다. 우주의 배경은 테마 깊은 베이스색 위에 **요즘 상태(ambient)** 가 여러 넓은 광원으로 번지는 한 겹을 더한다(25 — 아래 §요즘 상태 배경). 밤마다 **야간 공고화**가 우주를 한 번 정돈한다(27 — 아래 §야간 공고화).

## 규칙 · 파라미터

### 좌표 (coordinates)

| 규칙 | 값 / 조건 |
|---|---|
| 별 좌표 | 클라 라이브 force-sim이 펌프하는 단일 `Float32Array` 버퍼. 슬롯 = `stars` 배열 인덱스 = InstancedMesh 인스턴스 인덱스(1:1). 폴백/초기 시드 *방향* 은 `fibonacciStarPosition(i, n, seed)` |
| 반지름 = 강함 (38·07) | 중심 거리 `targetRadius = lerp(R_MIN 6, R_MAX 40, 1 − R)`, **R = Bjork 인출 강도**(`memoryR(recall_count, intensity, lastRecalledAt, now)` — `R = exp(-Δt/τ(S))`, `S = (storage_base+recall_count)·(1+emo_consolidation·intensity)`, `τ(S)=tau0_days·(1+tau_storage_gain·ln(1+S))`). 옛 `strength(W_ACT·act+W_INT·int)` 혼합을 단일 R로 대체(spec 07) — 자주 떠올린 기억은 같은 Δt에서 더 중앙에 머문다. force-sim **반지름 셸 힘**(`SimNode.radius`·`SimParams.radialStrength 0.1`)이 거리를 **독점**하고, 연결·척력은 거리를 못 바꾼다(38) |
| 각도 = 연결 (38) | 방향은 그래프 스프링·척력 + 22 흥분성 편향(`seedNearCluster`)이 정한다. **접선/radial 분리(38):** `radius>0` free 노드는 연결·척력의 **방사 성분을 제거**해 셸 위에서 *각도만* 바꾸고, 거리는 셸 힘이 정한다 — 새 별(강함↑)이 바깥 이웃 셸로 안 끌려간다(연결 weight 0.6~0.8 ≫ radialStrength 0.1이던 38 갭 해소). 새 별 시드 fallback은 **분산 방향**(`scatterDirection` — 나선 아님). `prevPos` resume으로 각도 연속성 보존 |
| 표상 부동 (40·데모) | 별의 *방향* 이 **밤 경계마다 한 스텝**(`DRIFT_STEP_RAD 0.08`·**고정 per-seed 축** 회전·반지름(거리) 보존) 표류한다 — **데모 모드**에서 `floor(virtualNow/DAY)` 증가 시 컨트롤러가 각 free 별을 회전(+vx 0)·re-kick(시계 역행 시 baseline 재설정). 축이 pos-무관·고정이라 회전군(`drift(N)=N×drift(1)` → 스킵=대기). **밤 미교차엔 정적.** 연결 스프링이 성단을 부분 복원해 **고립 별이 더, 잘 연결된(도식) 별이 덜** 흐른다(차등 — 동역학 창발). **프로덕션은 좌표 비영속(헌법3)이라 세션 중 드리프트 없음** — 데모 타임머신이 시간 경과·표상 부동의 쇼케이스 |
| 자아 별 (38·44) | 우주 중심의 단일 앵커("나"). **그래프 비참여**(연결·KNN·시냅스 없음), `selfObject` 폼(기본 nebula-heart·유료 core/well — 커스터마이즈 '나' 축). 강한 기억이 그 곁에 모인다. **몸체 색 = 요즘 감정(ambient mood) 파생**(테마/배경 무관; 데이터 없음·미인증이면 중립/배경 accent 폴백). 단 자아 별이 **다른 별에 던지는 빛(self-light 반사)은 중립** 유지(spec 03 — 요즘 감정색 소유권은 배경 스킨 weave, 이중 주입 금지). 상세 [customization](customization.md) |
| 재이완 정책 | settle 후 정적. 새 별·회상·시간감쇠로 목표 반지름이 임계(0.5) 넘게 변하거나 **밤 경계를 넘으면(각도 드리프트, 38)** `alpha` 재상승(re-kick)해 부드럽게 활강, 그 외엔 매 프레임 재계산 없음 |
| 좌표 일치 | StarField·UniverseSynapses·FlyToController·FocusController **네 readers**가 동일한 라이브 버퍼·동일 인덱싱을 읽어 fly-to/focus가 렌더된 바로 그 별에 도달한다(어긋남 0). StarField·FlyTo·Focus는 버퍼를 직접 읽고, 시냅스는 settle 시 발행되는 좌표 스냅샷에 굽는다 |
| 좌표 권위 | 서버는 좌표를 저장하지 않는다 — **가중치 그래프만** 권위. 좌표(반지름·각도 모두)는 클라가 산출한다 |
| 별 먼지(star dust) | 마운트 시 `mulberry32` 시드로 1회 생성한 정적 포인트 클라우드(count=1500, 반지름 35~145); 그래프와 독립이라 빈 우주(별 0개)에서도 배경·먼지만 렌더되고 크래시하지 않는다 |

### 배경 (background)

| 규칙 | 값 / 조건 |
|---|---|
| 배경(Background) 번들 (44) | "테마"를 **배경(Background)** 으로 정명. 배경은 색만이 아니라 **깊은 clear color + fluid 팔레트 + 텍스처/요소 슬롯** 번들이다(`themeBg`/`paletteForBackground`/optional veil). 무료 `vast` + 유료 `lively`·`calm`·`aurora-veil`. 와이어/store id는 호환 위해 `theme` 유지(커스터마이즈 '배경' 축). 상세 [customization](customization.md) |
| 몽환 성운 워시 + 감정 weave (44·07) | 선택 배경 스킨(**받침색 팔레트 + 무늬 `BackgroundPattern{warp,freq,detail}`**)을 사방을 감싸는 큰 안쪽 구(`UniverseNebula`)에 도메인워프 오로라로 칠하고(랜딩/사인인 `CosmosScene`과 같은 결, **방향 도메인** 노이즈라 uv 극 핀칭 없음 · draw call 1개), 그 위에 **요즘 감정색을 짜 넣는다**(아래 §요즘 상태). 모든 것 뒤(renderOrder −11)·`depthWrite/depthTest=false` → 별 mood 색·깊이 불간섭, 낮은 밝기로 별을 씻지 않음. reduced-motion이면 모션 정지(색 유지) |
| 배경 ↔ 별색 분리 | 배경은 배경 자체 색, 별색은 mood(13색 의미 팔레트)로 독립. **배경 변경이 별의 mood 색을 바꾸지 않는다**(StarField는 emotionColors/mood만 읽음) |
| 별먼지 vs 별가루 | 배경 점구름 "별먼지"(cosmic dust, count 1500)는 화폐가 아니다 — 커스터마이즈 화폐는 별개의 "별가루"(Stardust, [customization](customization.md)) |
| 먼지 디밍 | 별 선택(focus) 시 별 먼지 불투명도 0.5 → 0.14로 낮춰 선택 별만 밝게(스포트라이트) |

### 요즘 상태 배경 (ambient mood, 25·07)

개별 별이 *과거의 한 순간*이라면 **배경은 "지금의 나"** 다. spec 07로 떠 있던 무드 오브를 없애고, **하나의 Bjork 인출 강도 R**(반지름과 같은 가중치)로 감정 순위를 매겨 **배경 스킨 텍스처에 사용자 감정색을 직접 짜 넣는다**. 별개의 빛이 아니라 배경 자체의 결이다.

| 규칙 | 값 / 조건 |
|---|---|
| 감정 순위 (클라) | `rankedEmotions(stars, emotionColors, now)` = mood별 **Σ R** 내림차순(R = Bjork 인출 강도, weight.ts). 각 항목 색 = `resolveMoodRgb(mood, emotionColors)`(**사용자 감정색** 45·30), weight = 그 mood Σ R의 상대 비중. 서버는 종합을 주지 않는다 — 클라가 로드된 별(+`recall_count`)에서 파생(헌법3) |
| 배경 weave (클라) | `UniverseNebula`가 받침색·무늬 위에 상위 **`emotionSlots`**개 감정색을 노이즈 밴드별 R-비중으로 합성(dominant=넓은 결, 차순위=밝은 결 액센트). `emotionSlots`(스킨별: vast·calm `1`·lively `3`·aurora-veil `13`·`0`=감정 무관 순수 텍스처)는 코드 카탈로그 시각 정의 |
| 전역 생동 (arousal) | `arousalOf(stars,now) = 1−exp(-Σ R)` ∈ [0,1)가 배경 스킨 밝기(`1+bg_brightness_gain·arousal`)·흐름 속도(`1+bg_motion_gain·arousal`)를 키운다 — 격동한 요즘=생동, 평온=잔잔 |
| 별색 불간섭 | 짜 넣는 색은 배경 결이고 별 mood 색(`resolveMoodRgb`)·26 밝기·spec 03 반사 중립은 불변. 자아 몸체 색만 R-가중 `deriveAmbient`로 요즘 감정 파생(고정 의미 팔레트, 사용자 감정색 아님) |
| 애니메이션 | BloomPass가 내장 TSL `time` 노드를 진전시키지 않으므로 `useFrame` **수동 uTime**으로 흐름 구동. 감정색·arousal은 유니폼 갱신(셰이더 재컴파일 없음), 받침색·무늬는 스킨 교체 시 재빌드. `prefers-reduced-motion`이면 모션 정지, 색·밝기 유지 |
| 흥분성 게인 | `g = 1 + 0.3·arousal`(arousal만; ∈[1,1.3])을 헬퍼(`memory.ExcitabilityGain(arousal)` / `excitabilityGain`)로 정의. 22 할당 바이어스에 라이브 배선은 없다(27 야간 공고화 seam) |

### 야간 공고화 (nightly consolidation, 27)

밤마다 사용자별 `consolidate` 잡(`KindConsolidate`)이 한 번 깨어나 우주를 4패스로 정돈하고, 아침에 살짝 달라진 풍경(morning diff)을 남긴다 — **무엇도 삭제하지 않는다(헌법2).** 잡은 **야간 티커**가 매일 한 번(`consolidateHourUTC=18` ≈ 03:00 KST) 활성 사용자(별 ≥1)별로 enqueue하고(멱등 — 대기/실행 중이면 미적재), 워커가 `Claim(KindConsolidate)`로 한 건씩(extract·embed 다음 우선순위) 처리한다. 티커는 실제로 배포되는 단일 바이너리(`cmd/api`)와 분리 워커(`cmd/worker`) 양쪽에서 기동된다.

| 패스 | 규칙 / 값 |
|---|---|
| ① 재안정화 (re-stabilize) | 사용자 전 그래프를 서버 측 force-sim(클라 `shared/lib/force-sim`과 **동일 힘 모델** — 척력 −30·linkDistance 30·centerGravity 0.01·velocityDecay 0.6·alphaMin 0.001, 척력은 정확 O(N²))으로 수렴(≤600틱)시킨다. 밤엔 pin을 풀어 **전체** 재안정화. 캐시 좌표가 있으면 그걸 시드(재진입 가속), 없으면 결정론적 fibonacci 셸 |
| ② 재분배 (redistribute) | 각 별을 **호스트 성단**(연결 성분, union-find) centroid로 `redistributeLerp=0.6` 끌어들인다. **도식 적합**(성단 크기 ≥3 이고 degree ≥2) 별엔 `schemaBonus=0.15` 추가(최대 lerp 0.95) — 반복 성단의 잘 연결된 기억이 더 빨리 통합 |
| 안정 좌표 캐시 | ①② 결과를 `memories.stable_x/y/z`에 upsert. **권위 아님 — 캐시뿐(헌법3).** proto로 클라에 나가지 않는다(`memory.proto` "no coordinate fields"); 서버의 **다음 밤 재진입 시드**로만 재사용한다 |
| ③ 요지 (gist) | `created_at`이 `gistAgeDays=30`보다 오래되고 `last_recalled_at`이 `gistRecallCutoffDays=14`보다 과거이며 `form_seed_delta<1`인 별의 `form_seed_delta`를 `gistFormSimplify=0.4`만큼 **단조 증가**(GREATEST — 후퇴 금지)하고 `version++`. 각 변경은 `evolution_history`에 `trigger='nightly_gist'`(pe 0·dir −1)로 **append**(23 테이블 재사용, INSERT 전용). 형태가 한 단계 추상화된다(별 도메인 §요지화) |
| ④ 가지치기 (prune) | `weight < weakEdgeThreshold=0.2` 이고 `last_activated_at`이 `weakEdgeIdleDays=14`보다 과거인 선의 `weight`를 `weakEdgeFloor=0.05`로 **LEAST**(밝기만↓). 행은 남고 클릭 가능 — **DELETE 0(헌법2)** |
| ⑤ 흥분성 리셋 (24h 회전) | 성단 흥분성 `e(c,t)`(22)는 타임스탬프 파생(τ=6h)이라 **영속 컬럼이 없다** — 잡이 활동 수시간 뒤(야간) 돌므로 아침엔 이미 ≈0. 리셋은 시간 감쇠로 **내재**하며 별도 UPDATE가 없다(00.overview 공유 결정) |
| 실패 안전 | 어떤 패스가 실패해도 기존 `failWithBackoff`로 재시도/보존(`failed`). 모든 패스 멱등(좌표 재캐시·`form_seed_delta` GREATEST·`weight` LEAST·요지 history는 RETURNING 집합에 키잉)이라 재실행이 삭제·손상 없음(헌법1·2) |
| morning diff (FE) | 갱신된 `form_seed_delta`(요지 형태)·어두워진 약한 선이 다음 `GetUniverse` refetch로 자연히 반영된다. 라이브는 **하루 첫 접속 1회** "밤사이 우주가 한 번 정리됐어요" 노트(localStorage 일자 스탬프·`MorningDiffNote`). 데모는 별도 버튼 없이 **"하루/한 달 지나기"가 밤사이 정리(4패스)를 함께** 돌려(트윈 정착 후 1회) 같은 노트를 띄운다 — "하루가 지났으면 밤도 지났다". 안정 좌표는 클라에 안 가므로 좌표 자체는 클라 force-sim 재창발(헌법3). 데모의 "하루/한 달 지나기"는 추가로 **별 방향을 밤 수만큼 표류**시킨다(표상 부동, 38); 라이브 morning-diff는 형태·밝기 변화만 보이고 좌표는 세션마다 재창발한다 |

### 삭제 없음 (no deletion)

| 규칙 | 값 / 조건 |
|---|---|
| 별 | 시간 감쇠해도 유효 밝기 `A_MIN=0.05` 바닥 위 유지, 행 삭제 0건(밝기만 낮춤). (spec 03: 이 바닥은 별 빛 3채널 중 **self-glow(자가발광)** 채널이 단독 보증 — star.md §밝기·감쇠) |
| 시냅스 | 밝기 = `weight·max(A_MIN, activation)`로 낮추되 행 삭제 0건 |
| 기존 별 안정 (38 정제) | 기존 별의 **각도(방향)** 는 `prevPos` resume으로 보존되어 새 별 추가가 그 방향을 흔들지 않는다. **반지름** 만 강함(활성도·감정강도)에 따라 변한다 — "내 기억이 그 방향에 있다"는 유지되고, 거리만 호흡한다(헌법3 정제) |

## 불변식 (invariants)

- **무엇도 삭제하지 않는다(헌법2).** 감쇠·잠듦 어느 경우에도 `memories`/`memory_links`/`records` 행을 물리 삭제하지 않는다 — 별·시냅스는 밝기만 바뀌고 행은 남아 클릭 가능하다.
- **좌표는 클라, 서버는 그래프만(헌법3).** 서버는 좌표를 저장하지 않고 가중치 그래프만 권위로 둔다. proto DTO에 좌표/위치 필드가 없다. (38: 반지름=강함·각도=연결로 좌표를 두 축으로 나누되, 둘 다 여전히 클라 창발 — "기존 별 pin"은 "각도 안정·반지름 변동"으로 정제.)
- **좌표 일치(헌법8).** 네 readers가 동일한 라이브 좌표 버퍼·동일한 배열 인덱싱을 공유해 렌더 별·시냅스 끝점·fly-to·focus 좌표가 항상 일치한다(어긋남 0). 정적 fibonacci는 버퍼 미준비 시 폴백으로만 잔존한다.
- **순수성(헌법4).** `shared/lib/layout.ts`(좌표 식·`targetRadius`)·`entities/memory/model/weight.ts`(Bjork R·S, spec 07)·`shared/lib/force-sim`(순수 tick·반지름 셸 힘·`seedNearCluster`)은 `three`/React/DOM을 import하지 않는다(모바일 재사용).
- **씬 내 DOM 금지(헌법4).** `UniverseCanvas`의 R3F 씬 안에 `<Html>` DOM을 넣지 않는다 — 라벨·HUD는 별도 2D widget.

## 구현 근거

- 라이브 force-sim 좌표 구동 · 네 reader 단일 버퍼 · 별 먼지: 구현 plan 06·07·22 · `frontend/src/shared/lib/force-sim/`(`createSim`·`tick`·`seedNearCluster`), `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`LiveLayoutController`·`readBufferPosition`·StarDust·UniverseSynapses·FlyTo/FocusController), `frontend/src/entities/star/ui/StarField.tsx`
- 반지름=강함(R)·각도=연결 · 자아 별 · 재이완: 구현 plan 38·07 · `frontend/src/shared/lib/layout.ts`(`targetRadius`·`R_MIN`/`R_MAX`)·`frontend/src/entities/memory/model/weight.ts`(`memoryR`·`storageStrength`·`retrievalStrength`), `frontend/src/shared/lib/force-sim/{types.ts,sim.ts}`(`radius`·`radialStrength`·셸 힘), `frontend/src/widgets/universe-canvas/ui/{UniverseCanvas.tsx,SelfStar.tsx,UniverseNebula.tsx}`(`radiusOf`·감정 weave·re-kick·자아 별), `frontend/src/entities/appearance/model/self-objects.ts`(`SELF_OBJECTS`)
- 접선/radial 분리(거리=강함 강제) · 분산 시드(나선 제거) · 표상 부동(야간 각도 드리프트): 구현 plan 40 · `frontend/src/shared/lib/force-sim/sim.ts`(`step()` 외력 `fbuf`→셸 노드 접선 투영), `frontend/src/shared/lib/layout.ts`(`scatterDirection`·`applyAngularDrift`·`DRIFT_STEP_RAD`), `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(`LiveLayoutController` — 새 별 fallback `scatterDirection`·`useFrame` 밤 경계 드리프트·`nightRef`)
- 좌표 권위 = 서버 그래프만 · fibonacci 폴백: 구현 plan 07·22 · `frontend/src/shared/lib/force-sim/types.ts`(순수 입출력 계약, 좌표 미저장), `frontend/src/shared/lib/layout.ts`
- 우주 배경색 · 테마 분리: 구현 plan 06 · `frontend/src/entities/appearance/model/themes.ts`(`themeBg`), `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`
- 요즘 상태(ambient) 배경 · 감정 weave · 흥분성 게인: 구현 plan 25·07 · `backend/internal/memory/memory.go`(`recall_count`·`ExcitabilityGain(arousal)`)·`db/queries/memory.sql`(`RecallMemoryTouch` +1·`recall_count`), `frontend/src/entities/memory/model/{weight.ts,ambient.ts}`(`memoryR`·`rankedEmotions`·`arousalOf`·`deriveAmbient`·`ambientToRgb`·`excitabilityGain`), `frontend/src/widgets/universe-canvas/ui/UniverseNebula.tsx`(감정 weave), `frontend/src/entities/appearance/model/backgrounds.ts`(`emotionSlots`·`pattern`), `backend/internal/job/worker.go`(W_EXC 배선 지점 주석)
- 밝기 바닥 · 삭제 없음: 구현 plan 08·12 · `frontend/src/entities/memory/model/activation.ts`(`A_MIN`, `starBrightness`, `synapseBrightness`)
- 야간 공고화 4패스 · 야간 티커 · 안정 좌표 캐시: 구현 plan 27 · `backend/internal/job/consolidate.go`(`handleConsolidate`·`consolidateLayout`·`redistribute`·`consolidateClusters`·`StartNightlyConsolidation`)·`worker.go`(claim 분기)·`repository.go`/`repository_pg.go`(`GraphStore` 공고화 포트·`Scheduler`)·`db/queries/{memory.sql,link.sql,job.sql}`(`ListStarsForConsolidate`·`CacheStableCoords`·`GistSimplifyStars`·`AppendGistHistory`·`PruneWeakLinks`·`EnqueueConsolidateJob`·`ListActiveUserIDs`)·`db/migrations/00006_nightly_consolidation.sql`(`stable_x/y/z`)·`cmd/{api,worker}/main.go`(티커 기동) / FE morning diff: `frontend/src/shared/ui/MorningDiffNote.tsx`·`pages/home/ui/HomePage.tsx`·`shared/lib/demo/data.ts`(`demoConsolidate`)·`widgets/demo-sim`(`runConsolidate`·"밤 보내기")
- 렌더 셸(WebGPU·WebGL2 폴백·노드 Bloom·씬 내 DOM 금지): 구현 plan 06 · `frontend/src/shared/lib/r3f/`, `frontend/src/widgets/universe-canvas/ui/BloomPass.tsx`
