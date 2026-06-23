# 별 (star) (policy/domain/star)

> 현재 구현된 별의 사실 정의.

## 정의

**별(star) = 하나의 기억 흔적(엔그램)을 표상하는 가변 오브젝트.** 별 1개 = `memories` 1행 = 일기 조각 1개의 1:1 관계다. 일기 한 편(record)은 사건 경계로 나뉘어 **N개의 조각 별**로 fan-out된다(1일기 → N별, 21 — 상세는 [memory](memory.md) 정책). 사용자가 쓴 **원본 일기(record)는 별이 아니다**: record는 불변·영구 보관되는 별도 레이어(`records`)이고, 별은 그 record를 가리키는(`memories.record_id`, non-unique FK) 가변 표상(`memories`)이다(헌법1).

별의 *지금 모습*은 결정론적 시드와 조각의 감정에서 나온다 — 색은 감정(mood)에서, 크기는 강도(intensity)에서, 형태는 시드에서 정해지고, 밝기는 회상 최근성으로 감쇠한다. 별의 감정·강도는 **AI가 일기 조각마다 감지하며**, 기록 폼의 수동 입력은 선택적 전체-일기 힌트로만 남는다(상세는 [memory](memory.md) 정책). 좌표는 별의 속성이 아니라 클라이언트가 결정론적으로 배치하며 서버는 좌표를 저장하지 않는다(헌법3 — navigation 정책 소관).

> 조각 fan-out·조각별 AI 감정 감지의 데이터 모델·extract 워커 상세는 [memory](memory.md) 정책. 야간 요지화는 아래 §요지화(27).

## 규칙 · 파라미터

### 별이 되는 조건 (genesis)

| 규칙 | 값 / 조건 |
|---|---|
| 일기 1편 → N 조각 별 | `RecordMemory`가 불변 record 1행 + extract job을 만들고, extract 워커가 사건 경계로 나눈 조각마다 별(`memories`) 1행 + embed job을 fan-out한다(1일기→N별, 21 — [memory](memory.md) 정책) |
| record는 별이 아니다 | record는 불변·영구(`records`, UPDATE/DELETE 금지); 별은 `memories.record_id`로 record를 가리키는 가변 행 |
| 별 등장 = refetch | 작성은 `SegmentMemory` 조각 미리보기 → 검토 → `RecordMemory`(확정 조각) 동기 fan-out. 성공 시 temp 별을 직접 넣지 않고 universe 쿼리 invalidate→refetch로 확정 별이 들어온다(10) |

### 감정 입력 (emotion)

| 규칙 | 값 / 조건 |
|---|---|
| mood·intensity·valence는 AI 감지 | 조각마다 AI 추출이 감지해 가변 별(`memories`)에 저장. 기록 폼의 수동 입력은 선택적 전체-일기 힌트로 `records`에만 남고, 추출이 단일-중립-조각으로 강등됐을 때만 fallback 적용(상세는 [memory](memory.md) 정책) |
| mood 13종 | 4사분면 정동 모델 13종(기존 7 + 추가 6, 29). 색·UX 레이어이며 단일 출처는 proto `enum Mood`·`shared/config/mood.ts`(29) — star 정책은 그 값을 색에 소비만 |

### 시각 규칙 (appearance)

| 규칙 | 값 / 조건 |
|---|---|
| 형태×표면 2축 스킨 (spec 52) | **형태(form)=geometry** `lowpoly`·`octa`·`smooth`·`cloudy`·`liquid` × **표면(surface)=발광 셰이딩** `facet`·`glossy`·`lava`·`cloud`·`pulse`를 독립 선택·조립한다(`buildStarBody(form, surface)`, shared toolkit plan 50 조각; `STAR_FORM_BUILDERS`×`STAR_SURFACE_BUILDERS` registry로 N-제네릭). 기본 무료 `lowpoly+facet`. 레거시 단일 id는 프리셋 디컴포지션(crystal=lowpoly+facet·ember=octa+lava·pulsar=smooth+pulse·liquid=liquid+glossy·nebula=cloudy+cloud)으로 시각 보존. 단일 `InstancedMesh` + TSL 노드 머티리얼(소수 draw call, 헌법8). **커스터마이즈 '별' 축 = form·surface 각각 판매**(무료 1+유료 N, 합성 wire id `"<form>+<surface>"`). **색은 mood 불변**(형태·질감만 바뀐다). [customization](customization.md) |
| 색 = mood 팔레트 | mood → RGB 튜플 색; 팔레트 밖 값 → `NEUTRAL_RGB`(=`[0.6,0.6,0.6]`) 폴백(throw 금지). per-instance `aMood` attribute로 보존, 랜딩 테마와 독립 |
| spec 07 경계 | 기억 가중치 R(`recall_count` 파생, spec 07)은 **자기근접 반지름(38)과 배경 감정 순위(25)** 를 바꾼다. 별 밝기는 그 반지름을 빛으로 읽으므로 R을 통해 함께 움직이되(change 19), **별 색(=mood)·spec 03 반사 중립은 R과 무관하게 불변**. 배경이 같은 감정색을 빌려 짜 넣어도(25) 별 자체 색 규칙은 그대로다 |
| 감정색 확정 게이트 (45) | **인증 개인 우주는 13 mood 감정색이 모두 확정된 뒤 렌더**된다 — `EmotionColorGate`가 `GetSettings`의 `user_emotion_colors` 13색 완성 여부(유효 `#RRGGBB`)로 판정해 미완료면 `/emotion-colors`로 보낸다(최초 로그인 여부 아님, *서버 내용*으로만). 렌더는 `resolveMoodRgb(mood, emotionColors)`로 사용자 색 우선·미설정/공개·체험은 기본 팔레트. **색=mood·추천=`MOOD_PALETTE` 파생** 불변(감정색은 판매/잠금 대상 아님 — 무료 필수 설정). [customization](customization.md) |
| 크기 = f(intensity) | `sizeFor(intensity) = 0.6 + clamp(intensity,0,1)·1.4` → 인스턴스 행렬 scale에 baked |
| 형태 시드 = 결정론적 다축 (spec 53) | `seedComponents(memory_id)` = 3축 시드(축 0 = `seedFromId`(FNV-1a 32-bit → `[0,1)`); 축 1·2는 id에 접미사 덧대 재해시). 같은 id → 같은 3축 → 같은 형태(결정론, Math.random 비사용). per-instance `aSeed`(표면 무늬, 축 0)·`aShape`(vec3, 형태 변위). **형태(geometry)는 단일 `InstancedMesh`(헌법8)라 in-shader 정점 변위로 별마다 다른 실루엣**을 만든다(`star-body` seedShape): shape 방향 *평균 기준* 비대칭 스트레치(균일 확대 없음 — 크기는 intensity 단독) + 저주파 럼프 + 고주파 디테일. lowpoly/octa는 flatShading이라 변위 위 면 법선 자동 재계산, smooth는 스트레치만(법선 보존), cloudy/liquid는 기존 변위에 합성. 튜닝 `spec/values.yaml star_form`(displace_amp·detail_amp·asymmetry·stage_simplify) |
| 형태 = f(추상화 단계) (spec 53) | `abstraction_stage`(0~`gist_stage_radii` 길이=4)가 오를수록 변위·비대칭이 `stage_simplify` 비율만큼 줄고 디테일이 먼저 녹아 일반적 인상만 남는다(요지화, 단조). per-instance `aStage`. 색·크기·밝기 규칙은 불변(이 변형은 *형태*만) |
| 애니메이션 | 형태별 자가발광·뷰의존(fresnel)·변위; 공유 `uTime` uniform을 `useFrame`이 수동 갱신(BloomPass가 TSL `time` 노드를 우회하므로) |

### 밝기 · 감쇠 (brightness · decay)

> **별 밝기 = 자기-거리 (spec 38 change 19).** 별의 밝기는 독립 감쇠 모델이 아니라 **"나로부터의 거리(반지름)"를 빛으로 읽은 단조 함수**다 — 가까운(작은 반지름) 별이 밝고, 먼(휴면) 별은 `A_MIN` 바닥. 연결·회상·감정은 *반지름*을 늦추므로(change 18) 그 효과가 거리를 통해 그대로 밝기에 전해진다(이중 계산 없음). 렌더는 이 한 값을 두 채널로 나눠 쓴다 —
> 1. **반사(reflection, lit) = 거리 밝기 운반체.** 중앙 자아-별(우주) 또는 우상단 평행광(배경)이 별을 비춘 밝기. 가까운(=강한) 별이 더 밝게 반사된다 — 위치(spec 38)의 광학적 읽기. 거리 밝기(`starGlow`)가 그 per-instance 변조 입력(`aRecency`). **bloom 안 함.** **change 08·spec 49: 메인 우주에서 자아 광원 위치가 카메라 모드에 따라 달라진다** — "멀리서 내 우주 보기"는 중심 자아 별(원점·정적), "별들 가까이서 탐험하기"는 **카메라 어깨 너머(뒤+위) 앵커를 매 프레임 따라간다**(`StarField.selfLightRef` uniform; 같은 앵커를 `SelfStar` 아바타도 공유 → 광원이 곧 나). **이동 광원은 반사 채널 광원 위치만** 바꾼다 — 거리 밝기·별 색·좌표·`A_MIN` 바닥은 불변(채널 경계). 겹쳐보기는 각 우주 기존 규칙 유지.
> 2. **자가발광(self-glow, emissive) = 거리 밝기.** 스스로 빛나는 세기 = `starGlow`(거리 밝기, `A_MIN` 바닥). 옛 연결성 구동 self-glow·`λ_eff`는 폐기 — 연결성은 거리(반지름)를 통해서만 밝기에 닿는다. `StarField`의 `aGlow`. **bloom 함. A_MIN 밝기 바닥은 이 채널이 단독 보증.**
> 3. **색(color) = 감정.** mood hue(+ hue_shift, spec 23). 불변.
>
> 반사는 진짜 `THREE.PointLight` 객체가 아니라 `buildStarBody`의 emissiveNode TSL 그래프 안에서 self-position uniform + per-instance 좌표로 N·L·falloff를 직접 계산한다 — 단일 InstancedMesh·per-instance attribute 유지(헌법8). focus 디밍(`aFocus`)은 두 채널 공통. 튜닝 스칼라는 `spec/values.yaml` `star_lighting`·`radial_layout`. 시냅스 밝기·휴면 판정용 `activation`(시간 감쇠) 식은 그대로다.

| 규칙 | 값 / 식 |
|---|---|
| 시간 감쇠 `activation` | `activation(Δt) = exp(-λ_base·Δt_days)`, `λ_base = ln2/30` (`HALF_LIFE_DAYS=30` → ≈0.0231/day); Δt=0 → 1, 30일 → 0.5. **시냅스 밝기(spec 12)·휴면 판정 입력** — 별 밝기는 거리 함수라 더는 이걸 쓰지 않는다 |
| 별 밝기 `brightnessFromRadius` | `A_MIN + (1−A_MIN)·(1 − (radius−R_MIN)/(R_MAX−R_MIN))` ∈ `[A_MIN,1]` — 반지름에 단조 감소. `R_MIN`→1·`R_MAX`→`A_MIN`. `starGlow(recallCount, intensity, lastRecalledAt, now, degreeNorm, weightedDegreeNorm)`가 레이아웃과 같은 반지름(`targetRadius(memoryRadiusR(…))`, plan 38·change 18)을 다시 빛으로 읽는다 → `aGlow`·`aRecency`를 한 값으로 구동 |
| 밝기 바닥 `A_MIN` | **0.05** — 별은 0으로 꺼지거나 삭제되지 않는다(헌법2). 별 밝기(`brightnessFromRadius`)·시냅스 밝기·휴면 컷오프의 단일 바닥. self-glow(emissive) 채널이 별 밝기 바닥을 단독 보증(반사는 bloom 안 하는 물리광·floor 없음). 둘째 바닥 금지 |
| 시냅스 유효 밝기 | `synapseBrightness = weight·max(A_MIN, activation)`(시간 감쇠, spec 12). 별-탐색 리스트(star-explorer)는 `starBrightness = max(A_MIN, activation)`로 간이 표시 |
| 잠든(dormant) 판정 | raw activation `≤ 2·A_MIN`. 바닥 적용 *전* raw 값 기준. 서버 `ListDormant`는 동등한 시각 cutoff로 환산 |
| 계산 위치 | 밝기·activation은 **클라이언트가 렌더 시 계산**; 서버는 `last_recalled_at`/`last_activated_at`만 권위(밝기 컬럼 없음·relevance 폐기) |

#### 별 밝기 = 자기-거리 (spec 38 change 19)

우주에 그려지는 별 밝기는 단일 λ도, 별마다 변조된 `λ_eff`도 아니라 **자기-거리(반지름)의 단조 함수**다 — 연결 많고·자주 떠올리고·감정 강한 별은 천천히 멀어져(가깝고 밝게 머묾), 고립된 저강도·일회성 별은 빨리 멀어진다(어두워진다). 연결·회상·감정이 *반지름*을 늦추므로(change 18) 그 효과가 거리를 통해 그대로 밝기에 전해진다 — 별도의 시간·연결·관련성·감정 밝기 감쇠 항은 없다. "망각은 시간만이 아니라 관련성의 함수다"(concept.md §망각)는 이제 하나의 변수(거리)로 통합돼 표현된다. **옛 변조 감쇠 `λ_eff = λ_base·R_conn·R_recent·R_emo`와 서버 `relevance`(요즘 토픽 정합도)는 폐기됐다** — 연결성은 거리를 통해서만 밝기에 닿는다(plan 26·38).

| 규칙 | 값 / 식 |
|---|---|
| 밝기 = `f(반지름)` | `brightness = A_MIN + (1−A_MIN)·R_radius^γ` 꼴(반지름 매핑 역, γ=`sat_gamma`) — 반지름에 단조 감소, `R_MAX`에서 정확히 `A_MIN`. 회상→반지름↓→밝기↑, 시간→반지름↑→밝기↓ |
| 연결성 입력 | `degreeNorm`(degree/median)·`weightedDegreeNorm`(Σweight/median)이 *반지름*의 τ를 늘려(change 18) 연결 강한 별을 가깝고 밝게 유지 — 별 밝기에 직접 들어가지 않는다(거리를 통해서만) |
| 재성형·포커스 합성 | `aGlow = clamp(starGlow + brightness_offset, A_MIN, 1)`(spec 23 재성형 오프셋·바닥 OUTERMOST), `aRecency = starGlow`. focus(`aFocus`)는 반사+self-glow 양채널 공통 배율 |
| 고립 vs 연결 | 고립·저강도·드문 회상 별은 연결·고강도·잦은 회상 별보다 **~2~3배 빠르게** 어두워진다(거리를 통해; 둘 다 `A_MIN`에서 멈춤, 삭제 없음) |
| 계산 위치 | `brightnessFromRadius`·`starGlow`는 **클라가 렌더 시 계산**(`entities/memory/model/activation.ts`, 순수). 서버는 좌표도 밝기도 relevance도 주지 않는다(헌법3) |

### 재공고화 재성형 (reconsolidation reshaping)

회상은 단순 재점화가 아니라, **새로운 맥락(예측 오차, PE)** 을 담을 때 별을 말랑하게 만들어 양방향으로 다시 빚는다. 재성형 상태(`brightness_offset`/`hue_shift`/`form_seed_delta`/`version`)는 가변 별(`memories`)에만 산다 — 불변 `records`엔 없다(헌법1). 모든 변형은 append-only 변천사에 쌓인다([memory](memory.md) 정책).

| 규칙 | 값 / 식 |
|---|---|
| PE 게이트 | `pe = clamp(1 - cos(recall_ctx_emb, last_consolidated_emb), 0, 1)`; `pe < 0.15`면 재성형·변천사 append 없음(단순 재점화). `recall_ctx_emb`는 `co_activation_count>0` 직접 이웃 임베딩 centroid(없으면 자기 임베딩 fallback), `last_consolidated_emb`는 회상 별 자신의 임베딩 baseline이라 co-recall 맥락이 있을 때 pe>0이 가능하다 |
| 강도 의존 | `strength = clamp(0.15·log2(1+co_recall_total) + 0.30·clamp(age/90d,0,1), 0, 1)`; 자주·오래 공고화될수록 1에 가까워진다 |
| 재성형 크기 | `magnitude = 0.22·pe·(1 - strength)` → strength↑ ⇒ magnitude↓(공고화될수록 덜 흔들림) |
| 양방향 적용 | 방향(±)은 `회상 별 id 해시 + version`에서 결정론적. `brightness_offset += dir·clamp(magnitude, 0.10, 0.22)`; `hue_shift`는 ±28°(도) 안에서 누적; `form_seed_delta`는 ±0.6 안에서 누적; `version++` |
| 내용 한정적 범위 | 회상 별 + **직접 이웃(memory_links 1-홉)** 만 재성형; 이웃은 `NEIGHBOR_FACTOR=0.4` 축소 크기. 간접 이웃·나머지 우주는 불변 |
| 렌더 합성 | `aGlow = clamp(starGlow(...) + brightness_offset, A_MIN, 1)`(거리 밝기·바닥 OUTERMOST 보존); `aRecency = starGlow(...)`(반사 변조); `aSeed = seed + form_seed_delta`; `aHueShift`(rad)로 mood 색을 회색축(1,1,1) 둘레로 회전(휘도 보존). brightness_offset은 self-glow에만(반사는 점광 물리량). 회상 직후 갱신은 GetUniverse refetch로 반영(낙관 갱신 아님) |
| 공동 회상 강화 | delta는 FE `co-recall`에서 **간격 무관 고정** `CO_RECALL_DELTA`(change 22 — 간격 효과 제거; 몰아보기 1× = 하루 띄움 1×); 서버 `ReinforceLinks`는 클라 delta를 1.0 cap으로 멱등 업서트(변경 없음) |

### 요지화 (gist, 27 change 20)

야간 공고화(27)는 멀리 표류한(거의 잊힌) 별을 한 단계 더 추상화한다 — 디테일이 녹고 일반적 인상만 남는 요지 추출(체계 공고화). 트리거가 나이/회상 → **별의 반지름**(중심 거리)으로, 단순화 신호가 연속 `form_seed_delta` → **이산 `abstraction_stage`(0~4)**로 바뀌었다(change 20). 원본 `records`는 손대지 않는다(헌법1 — 가변 별의 단계 컬럼만).

| 규칙 | 값 / 조건 |
|---|---|
| 요지 트리거 | 별 반지름(서버가 change 18 공식으로 근사)이 `GIST_STAGE_RADII=[40,55,68,78]`의 임계를 넘긴 수 = target stage(0~4). 나이/회상 트리거·`form_seed_delta < 1` 조건은 폐기 |
| 단계 승급 | `abstraction_stage = GREATEST(현재, target)`(target > 현재인 별만 승급 → 단조·≤4·멱등), `version++`. 멀어질수록 단계가 오른다 |
| 형태 배선 | `abstraction_stage`는 proto `Star`(필드 15)로 노출되어 클라가 형태(plan 53)·재공고화 AI 내용 변형(plan 54)에 소비한다. 형태: `aStage` attribute → in-shader 정점 변위 단순화(요지화, plan 53). (23 재공고화의 `form_seed_delta`→`aSeed`/`aShape` 배선은 그대로, 야간 요지는 더는 그 경로를 안 쓴다) |
| 변천사 | 각 단계 승급은 `evolution_history`에 `trigger='nightly_gist'`(pe 0·dir −1) **append**(23 테이블 재사용, INSERT 전용 — [memory](memory.md) 정책). 24 변천사 타임랩스가 그대로 보여준다 |

## 불변식 (invariants)

- **별은 삭제되지 않는다(헌법2).** 감쇠는 밝기만 낮추며, 유효 밝기는 `A_MIN=0.05` 바닥 위로 유지된다(spec 03: 이 바닥은 **self-glow 채널**이 단독 보증 — 연결성 0·먼 별도 ≥A_MIN 자가발광). 잠든 별도 `A_MIN` 잔광으로 계속 렌더되고 클릭(geometry raycast, 밝기 무관) 가능하다 — 물리 삭제·소멸이 없다.
- **원본 record는 불변·영구다(헌법1).** 별의 색·크기·밝기·재성형 상태는 모두 가변 별 레이어(`memories`)·클라 렌더 계산에서만 결정되고, `records`는 UPDATE/DELETE되지 않는다. 재공고화가 누적돼도 유효 밝기는 `A_MIN` 바닥 위로 유지된다(헌법2).
- **시드 재현성(헌법3).** 같은 `memory_id`는 항상 `seedFromId`로 같은 시드 → 같은 형태. 새로고침·재진입 후에도 같은 별 모양. 별은 좌표를 속성으로 갖지 않는다(좌표는 클라 결정·서버 비저장).
- **model 순수성(헌법4).** `entities/memory/model/**`·`shared/config/mood.ts`의 도메인 식(`activation`·`starBrightness`·`synapseBrightness`·`isDormant`·`brightnessFromRadius`·`starGlow`·`seedFromId`·`MOOD_PALETTE`)은 three/React/DOM을 import하지 않는다(모바일 재사용).
- **밝기는 클라 계산(헌법3).** 별 밝기는 자기-거리(반지름)를 클라가 렌더 시 빛으로 읽은 값이다(`brightnessFromRadius`·`starGlow`). 연결성(`degree`·`Σweight`)은 클라 synapse 그래프에서 산출해 *반지름*에 먹이고, `intensity`/`valence`는 `Star`에서 읽는다 — 서버는 좌표도 밝기도 저장하지 않는다(relevance 폐기).
- **렌더 권위(헌법8).** 수천 별은 단일 `InstancedMesh`로 그려 draw call이 별 수에 비례하지 않는다. 색·밝기·시드는 uniform이 아니라 per-instance attribute(`aMood`/`aGlow`/`aRecency`/`aFocus`/`aSeed`/`aHueShift`)에서 온다. (spec 03) 자아 광원 반사도 진짜 `THREE.PointLight`가 아니라 `buildStarBody`의 emissiveNode TSL 그래프 안에서 self-position uniform으로 계산 — per-instance attribute·focus와 합성되고 단일 InstancedMesh를 유지한다.

## 구현 근거

- 형태 4종·InstancedMesh·TSL·색=mood·크기=f(intensity)·`seedFromId`·`activation`·`A_MIN`: 구현 plan 08 · `entities/star/ui/forms.ts` · `entities/star/ui/StarField.tsx` · `entities/star/model/{kinds,types}.ts` · `entities/memory/model/{activation,seed,types}.ts` · `shared/config/mood.ts`.
- 시간 감쇠 운영·`starBrightness=max(A_MIN, activation)`·dormant `≤2·A_MIN`·서버 `ListDormant` cutoff: 구현 plan 12 · `entities/memory/model/activation.ts`.
- 조각 감정 AI 감지(→ `memories`)·수동 힌트(→ `records`)·13 mood: 구현 plan 20·21·29 · `backend/internal/ai/extractor.go` · `backend/internal/job/worker.go`(`applyManualHint`) · `frontend/src/shared/config/mood.ts` · `features/record-memory/ui/MemoryForm.tsx`(수동 감정 토글).
- record(불변)/memory(별) 분리·낙관적 단일 별: 구현 plan 03·04·10 · `backend/internal/db/migrations/00001_engram_schema.sql` · `features/record-memory/model/use-record-memory.ts`.
- 재공고화 재성형(PE 게이트·강도 의존·양방향 경계·직접 이웃 한정·간격 효과·렌더 합성): 구현 plan 23 · `backend/internal/db/migrations/00005_reconsolidation.sql` · `backend/internal/memory/service.go`(`reconsolidate`·`reshapeState`·`strengthOf`·`cosineSim`·`directionFor`) · `entities/memory/model/reshape.ts` · `entities/star/ui/{StarField.tsx,forms.ts}` · `features/recall/model/co-recall.ts`.
- 요지화(반지름 트리거·`abstraction_stage` 단조 승급·변천사 append): 구현 plan 27(change 20) · `backend/internal/job/consolidate.go`(`handleConsolidate`·`stageForRadius`)·`radius.go`(반지름 근사) · `backend/internal/db/queries/memory.sql`(`AbstractStarsByRadius`·`AppendGistHistory`) · `db/migrations/00013_nightly_rework.sql`(`memories.abstraction_stage`). 단계→형태/AI 배선은 plan 53·54 소관(23의 `form_seed_delta`→`aSeed` 경로는 재공고화 전용으로 보존).
