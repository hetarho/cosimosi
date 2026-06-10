# 시냅스 (synapse) 도메인 정책 (policy/domain/synapse)

> 현재 구현된 시냅스(두 별을 잇는 가중치 무방향 연결)의 사실 정의.

## 정의

시냅스는 두 기억(별) 사이의 **가중치(`weight ∈ [0,1]`)를 가진 무방향 연결**이다(`memory_links` 1행). 새 별의 임베딩으로 의미 KNN을 돌려 태어나고(`link_type='semantic'`), 함께 회상될 때 헵 규칙으로 강해지며(`link_type='co_recall'`), 시간으로 어두워지되 행은 결코 삭제되지 않는다(헌법2 — 밝기만 낮춘다). `weight`(서버 권위 그래프)와 별의 시간 감쇠가 합쳐져 화면의 밝기·alpha·펄스가 된다.

시냅스 자신은 좌표를 갖지 않는다 — 잇는 두 별의 클라 좌표를 조회해 그린다(헌법3, 좌표 배치 규칙은 navigation 정책 소관). 조각 일내 결속(intra_entry)·교차 캡·경쟁적 할당 편향·약한 선 가지치기·변조 감쇠·`co_activation_count`의 DTO 노출은 plan 21·22·26·27에서 다룬다(아직 정책 아님).

## 규칙 · 파라미터

### 생성 (genesis · semantic)

| 규칙 | 정전 값 |
|---|---|
| 의미 KNN 임계 τ | `cos_sim ≥ 0.75`, 미만은 미연결 |
| top-k | 의미 후보 최대 `k = 8`, `embedding <=> query` 오름차순 |
| 초기 가중치 w0 | `clamp(α·cos_sim + temporal_bonus, 0, 1)`, `α = 1.0` |
| temporal_bonus | 같은 날 `+0.3` → 7일에 `0` 선형 감소(`본인 record entry_date` vs 후보 `entry_date`) |
| link_type | 리터럴 `'semantic'` |
| 업서트 | UNNEST 배치, `ON CONFLICT (a_id,b_id) DO UPDATE SET weight = GREATEST(기존, 신규)` |

### 헵 공동 회상 강화 (co_recall)

| 규칙 | 정전 값 |
|---|---|
| 능동 인출 게이트 | 별 `DWELL_MS = 2000`(≥2초) 능동 열람 + 직전 능동 열람 별과 페어링 시 1 이벤트, 2초 미만 스침·스크롤 미카운트 |
| 이벤트당 증분 delta | `+0.05`(`CO_RECALL_DELTA`), 한 윈도 같은 페어는 합산 |
| 강화 식 | 기존 행 `weight = LEAST(1.0, weight + delta)`; 신규 행 `weight = LEAST(1.0, delta)`, `link_type='co_recall'` |
| 카운터 | 기존 행 갱신 시 `co_activation_count++`, `last_activated_at = now()` |
| 영속 | 클라 증분 누적 → 디바운스 유휴 `5s`(`DEBOUNCE_IDLE_MS`) + `beforeunload` flush로 unary 배치 |
| 멱등 | `batch_id`를 `processed_batches`에 먼저 CLAIM(같은 tx) — 재전송 이중 가산 방지 |

### link_type

| 규칙 | 정전 값 |
|---|---|
| 정의된 값 | `'semantic'` \| `'temporal'` \| `'entity'` \| `'co_recall'` |
| 실제 생성 경로 | 의미 생성 = `'semantic'`, 공동 회상 = `'co_recall'`(`'temporal'`·`'entity'`는 타입에만 정의, 생성하는 경로 없음) |

### 시각 (visual)

| 규칙 | 정전 값 |
|---|---|
| 유효 시각 강도 | `visualIntensity = clamp(weight · max(A_MIN, brightness), 0, 1)` |
| 밝기 입력 brightness | `= max(A_MIN, activation)`(별 시간 감쇠 결과를 받는 입력값) |
| 밝기 바닥 | `A_MIN = 0.05`, alpha 바닥 `ALPHA_MIN = 0.15`(약/잠든 엣지도 잔존) |
| emissive · alpha | `emissive = visualIntensity`, `alpha = lerp(ALPHA_MIN, ALPHA_MAX, visualIntensity)` |
| 펄스 | `sin(time·f)·amp`, `amp = reinforcedRecency` |
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
- 헵 강화·멱등(+0.05 cap 1.0·co_activation_count·batch_id): plan 11 · `backend/internal/db/queries/link.sql`(`ReinforceLinks`·`ClaimBatch`), `frontend/src/features/recall/model/co-recall.ts`.
- link_type 4종 정의: plan 09 · `frontend/src/entities/synapse/model/types.ts`.
- 시각(weight·max(A_MIN,brightness)→emissive/alpha/펄스): plan 09 · `frontend/src/entities/synapse/model/mapping.ts`(`visualIntensity`·`A_MIN`·`ALPHA_MIN`), 별 감쇠 입력 plan 12.
- 삭제 금지 전체 반환: plan 05/11 · `backend/internal/db/queries/link.sql`(`ListLinksByUser`).
