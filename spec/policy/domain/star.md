# 별 (star) (policy/domain/star)

> 현재 구현된 별의 사실 정의.

## 정의

**별(star) = 하나의 기억 흔적(엔그램)을 표상하는 가변 오브젝트.** 현재 구현에서는 **일기 1편 = record 1개(불변 원본) = memory 1개(별)** 의 1:1 관계다 — record 1개를 쓰면 별 1개가 생긴다. 사용자가 쓴 **원본 일기(record)는 별이 아니다**: record는 불변·영구 보관되는 별도 레이어(`records`)이고, 별은 그 record를 가리키는(`memories.record_id`) 가변 표상(`memories`)이다(헌법1).

별의 *지금 모습*은 결정론적 시드와 사용자가 고른 감정에서 나온다 — 색은 감정(mood)에서, 크기는 강도(intensity)에서, 형태는 시드에서 정해지고, 밝기는 회상 최근성으로 감쇠한다. 감정·강도는 **사용자가 기록 폼에서 직접 고른다**(AI 감정 감지가 아니다). 좌표는 별의 속성이 아니라 클라이언트가 결정론적으로 배치하며 서버는 좌표를 저장하지 않는다(헌법3 — navigation 정책 소관).

> 일기 1편 → N 조각 별 분할, 조각별 AI 감정 감지, 야간 요지화는 plan 20·21·27에서 다룬다(아직 정책 아님).

## 규칙 · 파라미터

### 별이 되는 조건 (genesis)

| 규칙 | 값 / 조건 |
|---|---|
| 일기 1개 = 별 1개 | record 1개 → memory 1개 (1:1); `RecordMemory`가 record·memory·embed job을 한 트랜잭션으로 생성 |
| record는 별이 아니다 | record는 불변·영구(`records`, UPDATE/DELETE 금지); 별은 `memories.record_id`로 record를 가리키는 가변 행 |
| 낙관적 별 등장 | 제출 즉시 `temp-` id로 별 1개를 띄우고, 서버 확정 `memory_id`로 교체(seed 재파생) — 실패 시 임시 별만 롤백 |

### 감정 입력 (emotion)

| 규칙 | 값 / 조건 |
|---|---|
| mood·intensity는 사용자 입력 | 기록 폼의 mood `<select>` + intensity 슬라이더(0..1); `records.mood`/`records.intensity`에 저장 |
| 7 moods | `JOY`/`CALM`/`SAD`/`ANGER`/`FEAR`/`LOVE`/`NEUTRAL` (proto `enum Mood`와 단일 출처) |

### 시각 규칙 (appearance)

| 규칙 | 값 / 조건 |
|---|---|
| 형태 4종 (generative form) | `deepfield`(Crystal) · `aurora`(Nebula) · `liquid`(Liquid) · `ember`(Ember); 기본값 `deepfield`. 단일 `InstancedMesh` + TSL 노드 머티리얼(소수 draw call) |
| 색 = mood 팔레트 | mood → RGB 튜플 색; 팔레트 밖 값 → `NEUTRAL_RGB`(=`[0.6,0.6,0.6]`) 폴백(throw 금지). per-instance `aMood` attribute로 보존, 랜딩 테마와 독립 |
| 크기 = f(intensity) | `sizeFor(intensity) = 0.6 + clamp(intensity,0,1)·1.4` → 인스턴스 행렬 scale에 baked |
| 형태 시드 = 결정론적 | `seedFromId(memory_id)`(FNV-1a 32-bit → `[0,1)`); 같은 id → 같은 seed → 같은 형태. per-instance `aSeed`로 표면 무늬 변형 |
| 애니메이션 | 형태별 자가발광·뷰의존(fresnel)·변위; 공유 `uTime` uniform을 `useFrame`이 수동 갱신(BloomPass가 TSL `time` 노드를 우회하므로) |

### 밝기 · 감쇠 (brightness · decay)

| 규칙 | 값 / 식 |
|---|---|
| 시간 감쇠 `activation` | `activation(Δt) = exp(-λ_base·Δt_days)`, `λ_base = ln2/30` (`HALF_LIFE_DAYS=30` → ≈0.0231/day); Δt=0 → 1, 30일 → 0.5. 변조 감쇠(아래)의 기준 λ |
| 밝기 바닥 `A_MIN` | **0.05** — 별은 0으로 꺼지거나 삭제되지 않는다(헌법2). 변조 감쇠도 같은 바닥을 쓴다(랜딩 카드의 0.12는 시연용 값일 뿐 두 번째 바닥이 아니다) |
| 별 유효 밝기(잠든 별 탐색) | `starBrightness = max(A_MIN, activation)`(단일 λ — `ListDormant` cutoff 환산·dormant 판정의 기준) |
| 잠든(dormant) 판정 | raw activation `≤ 2·A_MIN`. 바닥 적용 *전* raw 값 기준. 서버 `ListDormant`는 동등한 시각 cutoff로 환산 |
| 계산 위치 | 밝기·activation은 **클라이언트가 렌더 시 계산**; 서버는 `last_recalled_at`/`last_activated_at` + (변조 감쇠의) `relevance`만 권위(밝기 컬럼 없음) |

#### 관련성·감정 가중 변조 감쇠 (modulated decay, spec 26)

우주에 그려지는 별 밝기(`StarField`의 `aBrightness`)는 단일 λ가 아니라 **별마다 변조된 `λ_eff`** 로 감쇠한다 — 연결 많고·요즘의 나와 닿고·감정 강한 별은 천천히, 고립된 저강도·요즘 무관 별은 빨리 어두워지되 바닥(`A_MIN`) 아래로는 내려가지 않는다. "망각은 시간만이 아니라 관련성의 함수다"(concept.md §망각).

| 규칙 | 값 / 식 |
|---|---|
| 변조 감쇠율 `λ_eff` | `λ_eff = λ_base · R_conn · R_recent · R_emo`. 각 `R ∈ (0,1]`이라 변조는 감쇠를 **늦추기만** 한다(`λ_eff ≤ λ_base`, 가속 없음). 모든 입력은 clamp 방어 |
| `R_conn` (연결) | `1/(1 + 0.6·degree_norm)`, `ALPHA_CONN=0.6`. `degree_norm = 별 degree / 우주 degree 중앙값`(중앙값 0 → 1 폴백). 연결 많을수록 저항↑ |
| `R_recent` (요즘 관련성) | `1/(1 + 0.5·relevance)`, `BETA_RECENT=0.5`. `relevance = clamp(cos(별 임베딩, 요즘 토픽 중심 벡터), 0, 1)` — **서버가 `GetUniverse`에서 계산**(weight처럼 의미 그래프 파생값이므로 헌법3 위반 아님; 밝기 자체는 여전히 클라가 계산). 요즘 토픽 = 최근 별 임베딩의 시간가중 평균(`intensity·exp(-Δt/7d)`, `AggregateAmbient`와 같은 envelope). 임베딩 미생성 별·데모(서버 없음) → `relevance=0`(중립) |
| `R_emo` (감정) | `1/(1 + 0.7·intensity + 0.4·max(0,-valence))`, `GAMMA_EMO=0.7`·`DELTA_VAL=0.4`. 각성(intensity)과 강한 **부정** 정서가일수록 저항↑(편도체 매개 — Kensinger & Corkin 2004) |
| 변조 유효 밝기 | `modulatedBrightness = A_MIN + (1-A_MIN)·exp(-λ_eff·Δt_days)` ∈ `[A_MIN, 1]`. 재성형 합성(`+brightness_offset`)·focus 가중은 그 위에 그대로 얹힌다 |
| 고립 vs 연결 | 고립·저강도·요즘 무관 별은 연결·고강도·요즘 관련 별보다 **~2~3배 빠르게** 어두워진다(둘 다 `A_MIN`에서 멈춤, 삭제 없음) |
| 계산 위치 | `λ_eff`·`modulatedBrightness`는 **클라가 렌더 시 계산**(`entities/memory/model/activation.ts`, 순수). 서버가 주는 건 `relevance` 입력 하나뿐(헌법3) |

### 재공고화 재성형 (reconsolidation reshaping)

회상은 단순 재점화가 아니라, **새로운 맥락(예측 오차, PE)** 을 담을 때 별을 말랑하게 만들어 양방향으로 다시 빚는다. 재성형 상태(`brightness_offset`/`hue_shift`/`form_seed_delta`/`version`)는 가변 별(`memories`)에만 산다 — 불변 `records`엔 없다(헌법1). 모든 변형은 append-only 변천사에 쌓인다([memory](memory.md) 정책).

| 규칙 | 값 / 식 |
|---|---|
| PE 게이트 | `pe = clamp(1 - cos(recall_ctx_emb, last_consolidated_emb), 0, 1)`; `pe < 0.15`면 재성형·변천사 append 없음(단순 재점화). MVP는 회상 별 임베딩 = 마지막 공고화 임베딩이라 `pe=0`(서버 무변) — 미래의 회상 맥락/야간 gist 임베딩이 같은 게이트를 연다 |
| 강도 의존 | `strength = clamp(0.15·log2(1+co_recall_total) + 0.30·clamp(age/90d,0,1), 0, 1)`; 자주·오래 공고화될수록 1에 가까워진다 |
| 재성형 크기 | `magnitude = 0.22·pe·(1 - strength)` → strength↑ ⇒ magnitude↓(공고화될수록 덜 흔들림) |
| 양방향 적용 | 방향(±)은 `회상 별 id 해시 + version`에서 결정론적. `brightness_offset += dir·clamp(magnitude, 0.10, 0.22)`; `hue_shift`는 ±28°(도) 안에서 누적; `form_seed_delta`는 ±0.6 안에서 누적; `version++` |
| 내용 한정적 범위 | 회상 별 + **직접 이웃(memory_links 1-홉)** 만 재성형; 이웃은 `NEIGHBOR_FACTOR=0.4` 축소 크기. 간접 이웃·나머지 우주는 불변 |
| 렌더 합성 | `aBrightness = clamp(starBrightness + brightness_offset, A_MIN, 1)`(바닥 보존); `aSeed = seed + form_seed_delta`; `aHueShift`(rad)로 mood 색을 회색축(1,1,1) 둘레로 회전(휘도 보존). 회상 직후 갱신은 GetUniverse refetch로 반영(낙관 갱신 아님) |
| 간격 효과 | 공동 회상 강화 delta는 FE `co-recall`에서 `CO_RECALL_DELTA·(1 + SPACING_GAIN·clamp(gapDays/SPACING_REF,0,1))`로 키운다(간격 둔 인출이 더 큰 강화); 서버 `ReinforceLinks`는 클라 delta를 1.0 cap으로 멱등 업서트(변경 없음) |

## 불변식 (invariants)

- **별은 삭제되지 않는다(헌법2).** 감쇠는 밝기만 낮추며, 유효 밝기는 `A_MIN=0.05` 바닥 위로 유지된다. 잠든 별도 `A_MIN` 잔광으로 계속 렌더되고 클릭 가능하다 — 물리 삭제·소멸이 없다.
- **원본 record는 불변·영구다(헌법1).** 별의 색·크기·밝기·재성형 상태는 모두 가변 별 레이어(`memories`)·클라 렌더 계산에서만 결정되고, `records`는 UPDATE/DELETE되지 않는다. 재공고화가 누적돼도 유효 밝기는 `A_MIN` 바닥 위로 유지된다(헌법2).
- **시드 재현성(헌법3).** 같은 `memory_id`는 항상 `seedFromId`로 같은 시드 → 같은 형태. 새로고침·재진입 후에도 같은 별 모양. 별은 좌표를 속성으로 갖지 않는다(좌표는 클라 결정·서버 비저장).
- **model 순수성(헌법4).** `entities/memory/model/**`·`shared/config/mood.ts`의 도메인 식(`activation`·`starBrightness`·`isDormant`·`lambdaEff`·`modulatedBrightness`·`seedFromId`·`MOOD_PALETTE`)은 three/React/DOM을 import하지 않는다(모바일 재사용).
- **relevance만 서버 권위(헌법3).** 변조 감쇠의 `relevance`는 서버가 임베딩 cos로 계산해 `Star.relevance`로 보내는 의미 그래프 파생값이다(weight와 동급). `degree`(연결)·`intensity`/`valence`(감정)는 클라가 이미 가진 값이고, `λ_eff`·밝기 합성은 전부 클라 렌더 계산 — 서버는 좌표도 밝기도 저장하지 않는다.
- **렌더 권위(헌법8).** 수천 별은 단일 `InstancedMesh`로 그려 draw call이 별 수에 비례하지 않는다. 색·밝기·시드는 uniform이 아니라 per-instance attribute에서 온다.

## 구현 근거

- 형태 4종·InstancedMesh·TSL·색=mood·크기=f(intensity)·`seedFromId`·`activation`·`A_MIN`: 구현 plan 08 · `entities/star/ui/forms.ts` · `entities/star/ui/StarField.tsx` · `entities/star/model/{kinds,types}.ts` · `entities/memory/model/{activation,seed,types}.ts` · `shared/config/mood.ts`.
- 시간 감쇠 운영·`starBrightness=max(A_MIN, activation)`·dormant `≤2·A_MIN`·서버 `ListDormant` cutoff: 구현 plan 12 · `entities/memory/model/activation.ts`.
- 사용자 감정·강도 입력(mood select + intensity 슬라이더) → `records`: 구현 plan 04 · `features/record-memory/ui/MemoryForm.tsx` · `features/record-memory/model/use-record-memory.ts`.
- record(불변)/memory(별) 분리·낙관적 단일 별: 구현 plan 03·04·10 · `backend/internal/db/migrations/00001_engram_schema.sql` · `features/record-memory/model/use-record-memory.ts`.
- 재공고화 재성형(PE 게이트·강도 의존·양방향 경계·직접 이웃 한정·간격 효과·렌더 합성): 구현 plan 23 · `backend/internal/db/migrations/00005_reconsolidation.sql` · `backend/internal/memory/service.go`(`reconsolidate`·`reshapeState`·`strengthOf`·`cosineSim`·`directionFor`) · `entities/memory/model/reshape.ts` · `entities/star/ui/{StarField.tsx,forms.ts}` · `features/recall/model/co-recall.ts`.
