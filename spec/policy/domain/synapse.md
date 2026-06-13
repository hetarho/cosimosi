# 시냅스 (synapse) 도메인 정책 (policy/domain/synapse)

> 현재 구현된 시냅스(두 별을 잇는 가중치 무방향 연결)의 사실 정의.

## 정의

시냅스는 두 기억(별) 사이의 **가중치(`weight ∈ [0,1]`)를 가진 무방향 연결**이다(`memory_links` 1행). 새 별의 임베딩으로 의미 KNN을 돌려 태어나고(`link_type='semantic'`), 함께 회상될 때 헵 규칙으로 강해지며(`link_type='co_recall'`), 시간으로 어두워지되 행은 결코 삭제되지 않는다(헌법2 — 밝기만 낮춘다). `weight`(서버 권위 그래프)와 별의 시간 감쇠가 합쳐져 화면의 밝기·alpha·펄스가 된다.

시냅스 자신은 좌표를 갖지 않는다 — 잇는 두 별의 클라 좌표를 조회해 그린다(헌법3, 좌표 배치 규칙은 navigation 정책 소관). 같은 일기에서 태어난 조각 별끼리는 **일내 결속(`intra_entry`, w=0.8 고정)** 으로 묶이고, 교차(semantic) 링크는 그 아래로 캡된다(21 — 아래 표). 새 별의 semantic 연결 후보는 의미 유사도뿐 아니라 **이웃 성단의 흥분성**(최근 활성도)으로 편향 선택된다(22 — 아래 경쟁적 할당). 공동 회상 횟수(`co_activation_count`)는 `Synapse` DTO로 노출돼 링크 활력 시각에 반영된다(26 — 아래 시각). 약하고 안 쓰인 선은 밤마다 가지치기로 밝기만 바닥으로 낮아진다(27 — 아래 §가지치기).

## 규칙 · 파라미터

### 생성 (genesis · semantic)

| 규칙 | 정전 값 |
|---|---|
| 의미 KNN 임계 τ | `cos_sim ≥ 0.75`, 미만은 미연결 — **조각 임베딩** 기준(조각마다 따로 임베딩, 21) |
| 후보 상한 candidateK | `KnnNearest LIMIT = 16`(=`knnK·2`), `embedding <=> query` 오름차순 — 흥분성 재정렬 여지 확보(22) |
| 최종 링크 수 biasedK | 후보를 흥분성 편향으로 재정렬해 상위 **`5`** 만 링크(22) |
| 초기 가중치 w0 | `min(clamp(α·cos_sim + temporal_bonus, 0, 1), 0.79)`, `α = 1.0` — **semantic 캡 0.79**(21: 교차 링크는 일내 결속 0.8보다 항상 약하다). 흥분성은 **선택만** 편향하고 가중치는 의미·시간이 정한다 |
| temporal_bonus | 같은 날 `+0.3` → 7일에 `0` 선형 감소(`본인 record entry_date` vs 후보 `entry_date`) |
| link_type | 리터럴 `'semantic'` |
| 업서트 | UNNEST 배치, `ON CONFLICT (a_id,b_id) DO UPDATE SET weight = GREATEST(기존, 신규)` — 형제 조각이 KNN에 잡혀도 GREATEST가 일내 0.8을 유지 |

### 경쟁적 할당 편향 (competitive allocation · excitability, 22)

새 조각은 의미만이 아니라 **최근 활성(흥분성 높은) 성단**으로 더 끌려가 연결된다. 흥분성은 새 컬럼 없이 기존 타임스탬프에서 파생한다(마이그레이션 0건 — 단일 출처).

| 규칙 | 정전 값 |
|---|---|
| 흥분성 `e(c,t)` | `Σ exp(-Δt/TAU_EXC)` — 성단 멤버 별 `last_recalled_at` + 멤버 간 시냅스 `last_activated_at`을 이벤트로 누적 |
| 시간 상수 TAU_EXC | `6h`(반감기 ≈4h) — 3h 전 활성 성단은 강하게 편향, **24h 전 성단은 사실상 0** |
| 성단 도출 | 후보 별들의 기존 시냅스로 **연결성분(union-find)** 파생, cluster 컬럼 없음(`ListLinksForCluster` 입력). 정밀 군집은 27 소관 |
| 편향 점수 | `score = cos_sim + W_EXC·norm_e(neighbor_cluster)`, `W_EXC = 0.25`, `norm_e = e / max_e`(후보 성단 중 최대, 0..1) |
| 소프트 억제 | 한 성단에 조각이 할당될 때마다 그 성단 `e × inhibitDecay`(`0.5`) → 한 성단 독식 방지(Delamare/Clopath 경쟁 항) |
| 폴백 | 후보 성단이 하나거나 흥분성이 전부 0이면 순수 `cos_sim` 정렬(기존 동작)로 자연 폴백, throw 없음 |
| 좌표 시드(클라) | 새 조각은 라이브 force-sim에서 **argmax-e 성단 centroid 근처**에 시드(navigation 정책 — `seedNearCluster`) |

### 일내 결속 (intra_entry — within-event binding, 21)

| 규칙 | 정전 값 |
|---|---|
| 생성 | extract fan-out 트랜잭션이 같은 `record_id` 조각의 **모든 쌍**을 결속(조각 N≤5 → 쌍 ≤10) |
| 가중치 | `0.8` 고정 — 교차 semantic 캡(0.79) 위 = 같은-사건 결속이 항상 최강 |
| link_type | 리터럴 `'intra_entry'` |
| 정규화·업서트 | `LEAST/GREATEST`(DB 콜레이션) a<b 정규화, `ON CONFLICT … GREATEST`(재실행이 약화시키지 않음) |

### 헵 공동 회상 강화 (co_recall)

| 규칙 | 정전 값 |
|---|---|
| 능동 인출 게이트 | 별 `DWELL_MS = 2000`(≥2초) 능동 열람 + 직전 능동 열람 별과 페어링 시 1 이벤트, 2초 미만 스침·스크롤 미카운트 |
| 이벤트당 증분 delta | `+0.05`(`CO_RECALL_DELTA`), 한 윈도 같은 페어는 합산 |
| 강화 식 | 기존 행 `weight = LEAST(1.0, weight + delta)`; 신규 행 `weight = LEAST(1.0, delta)`, `link_type='co_recall'` |
| 카운터 | 기존 행 갱신 시 `co_activation_count++`, `last_activated_at = now()`. 누계는 `Synapse.co_activation_count`(proto)로 노출(26) → 링크 활력 시각 + 27 가지치기 입력 |
| 영속 | 클라 증분 누적 → 디바운스 유휴 `5s`(`DEBOUNCE_IDLE_MS`) + `beforeunload` flush로 unary 배치 |
| 멱등 | `batch_id`를 `processed_batches`에 먼저 CLAIM(같은 tx) — 재전송 이중 가산 방지 |

### link_type

| 규칙 | 정전 값 |
|---|---|
| 정의된 값 | `'semantic'` \| `'temporal'` \| `'entity'` \| `'co_recall'` \| `'intra_entry'`(21) |
| 실제 생성 경로 | 의미 생성 = `'semantic'`, 공동 회상 = `'co_recall'`, 일내 결속 = `'intra_entry'`(`'temporal'`·`'entity'`는 타입에만 정의, 생성하는 경로 없음) |

### 가지치기 (prune, 27)

야간 공고화(27)는 약하고 거의 안 쓰인 선의 **`weight`를 바닥으로** 낮춘다 — 밝기는 클라가 `weight`로 산출하므로 선이 *어두워질 뿐 사라지지 않는다*. 행은 남고 클릭 가능(삭제 0 — 헌법2).

| 규칙 | 정전 값 |
|---|---|
| 가지치기 대상 | `weight < WEAK_THRESHOLD=0.2` 이고 `last_activated_at < now - WEAK_IDLE=14일` |
| 적용 | `weight = LEAST(weight, FLOOR=0.05)` — 절대 올리지 않고, `DELETE` 없다(행 보존) |
| WHERE 제약 | `weight`·시각 비교만(sargable) — `exp()`/감쇠식 금지(밝기 자체는 26 클라 모델 권위) |

### 시각 (visual)

| 규칙 | 정전 값 |
|---|---|
| 유효 시각 강도 | `visualIntensity = clamp(weight · max(A_MIN, brightness), 0, 1)` |
| 밝기 입력 brightness | `= max(A_MIN, activation)`(별 시간 감쇠 결과를 받는 입력값) |
| 밝기 바닥 | `A_MIN = 0.05`, alpha 바닥 `ALPHA_MIN = 0.15`(약/잠든 엣지도 잔존) |
| emissive · alpha | `emissive = visualIntensity`, `alpha = lerp(ALPHA_MIN, ALPHA_MAX, visualIntensity)` |
| 링크 활력 vitality (26) | `vitality = 0.12·min(1, log2(1 + co_activation_count)/4)` ∈ `[0, 0.12]` — 자주 함께 떠올린 연결일수록 또렷. 서버 미노출(데모/구버전 → 0)이면 0이라 기존 시각과 동일 |
| 펄스 | `sin(time·f)·amp`, `amp = clamp(reinforcedRecency + vitality, 0, 1)` — 최근 강화 + 누적 공동 회상 활력 |
| 두께 | per-edge 변조 불가(Line2NodeMaterial 전역 스칼라) → 선택적 2버킷(`thin=1px`/`thick=4px`, 임계 `weight ≥ 0.5`) |
| 렌더 | Line2(fat-line) 배칭 + TSL, `useFrame` 수동 갱신(React state 리렌더 없음) |

## 불변식 (invariants)

- **삭제 금지(헌법2).** 시냅스는 어떤 경로로도 `DELETE`되지 않는다 — 밝기만 낮춘다. `ListLinksByUser`는 잠든 엣지 포함 전체를 weight 필터 없이 반환한다.
- **`weight ∈ [0, 1]`.** 의미 생성·헵 강화 모두 `GREATEST`/`LEAST(1.0, …)`로 클램프한다. 한 배치의 합산 delta가 1.0을 넘어도 신규·기존 양 분기에서 상한이 걸린다. 음수 없음.
- **무방향 1행.** 한 쌍은 `a_id < b_id` 정규화로 정확히 1행. 정규화는 DB 콜레이션(`LEAST`/`GREATEST`)에서 수행해 `a_id<b_id` CHECK·PK와 일치시킨다(Go 바이트 순서 스왑 금지).
- **밝기 바닥(헌법2).** 유효 시각 강도는 `A_MIN = 0.05` 아래로 내려가지 않는다.
- **좌표는 서버 권위가 아니다(헌법3).** 시냅스는 좌표를 갖지 않고, 서버는 가중치 그래프만 권위로 저장한다.
- **model 순수성(헌법4·5).** `entities/synapse/model/**`·`features/recall/model/**`는 three/React/DOM을 import하지 않으며, `ReinforceLinks`/`RecallMemory`는 unary다(헌법6).

## 구현 근거

- 의미 생성(τ/k/w0/temporal_bonus·UNNEST 배치): plan 05 · `backend/internal/job/worker.go`(`buildLinks`·`initialWeight`·`temporalBonus`), `backend/internal/db/queries/embedding.sql`(`KnnNearest`), `backend/internal/db/queries/link.sql`(`BatchUpsertLinks`).
- 경쟁적 할당 편향(흥분성 `e(c,t)`·TAU_EXC 6h·W_EXC 0.25·inhibitDecay 0.5·candidateK 16·biasedK 5): plan 22 · `backend/internal/job/worker.go`(`excitability`·`deriveClusters`·`clusterExcitability`·`biasedLinks`), `backend/internal/db/queries/link.sql`(`ListLinksForCluster`)·`memory.sql`(`ListLastRecalled`), `backend/internal/job/repository_pg.go`(`LoadExcitabilityInputs`).
- 일내 결속·semantic 캡(0.8/`semanticWeightCap` 0.79): plan 21 · `backend/internal/db/queries/link.sql`(`BatchUpsertIntraEntryLinks`), `backend/internal/job/{worker.go,repository_pg.go}`(`FanOutFragments`).
- 헵 강화·멱등(+0.05 cap 1.0·co_activation_count·batch_id): plan 11 · `backend/internal/db/queries/link.sql`(`ReinforceLinks`·`ClaimBatch`), `frontend/src/features/recall/model/co-recall.ts`.
- link_type 4종 정의: plan 09 · `frontend/src/entities/synapse/model/types.ts`.
- 시각(weight·max(A_MIN,brightness)→emissive/alpha/펄스): plan 09 · `frontend/src/entities/synapse/model/mapping.ts`(`visualIntensity`·`A_MIN`·`ALPHA_MIN`), 별 감쇠 입력 plan 12.
- `co_activation_count` DTO 노출 + 링크 활력(`vitality`→펄스): plan 26 · `proto/cosimosi/v1/memory.proto`(`Synapse.co_activation_count`), `backend/internal/memory/handler.go`(GetUniverse 매핑), `frontend/src/entities/synapse/model/{store.ts,mapping.ts,types.ts}`(`toSynapseEdge`·`vitality`·`pulseAmp`). degree 정규화(`degreeNormById`)는 별 변조 감쇠 `R_conn` 입력([star](star.md)).
- 삭제 금지 전체 반환: plan 05/11 · `backend/internal/db/queries/link.sql`(`ListLinksByUser`).
- 가지치기(약·idle 선 weight→FLOOR 0.05·삭제 없음): plan 27 · `backend/internal/db/queries/link.sql`(`PruneWeakLinks`), `backend/internal/job/consolidate.go`(`handleConsolidate` ④·`weakEdgeThreshold`/`weakEdgeIdleDays`/`weakEdgeFloor`).
