# cosimosi — Ubiquitous Language (용어집)

> cosimosi 어휘의 단일 진실 공급원(SSOT). **한 개념 = 한 이름.** 각 항목은 *단어 / 간단 / 세부*만 담는다 — 의미의 *왜*와 신경과학 근거는 `concept.md`가 소유한다.

## 규칙

- **한 개념 = 한 이름, 모든 레이어에서.** Go 타입 · DB 테이블 · proto · FE 도메인 미러가 같은 이름을 쓴다.
- **렌더링 단어는 FE 전용.** `star`·`cell-star`·`filament`·`constellation`은 시각화 단어다 — 도메인·DB·proto는 절대 쓰지 않는다(§4).
- **창발하는 것에는 타입을 주지 않는다.** "기억 간 근접 / 별자리"는 force-sim 출력일 뿐, 타입·테이블이 없다.
- **신규 도메인 용어는 코드보다 이 문서에 먼저.**

---

## 1. 명사 (Nouns)

| 단어 | 간단 | 세부 |
|---|---|---|
| `Record` | 일기 원본 | 사용자가 작성한 불변 일기 항목 — 원문·작성일만 보유, append-only. 감정은 보유 안 함(→ `Engram`). |
| `Engram` | 기억 | 세포들의 희소 앙상블. 애그리거트 루트 — 세포를 id로 참조. `Emotion`·`AbstractionStage`·`CurrentMemoryText`·`GistStages` 보유. |
| `EngramCell` | 세포 | 기억을 이루는 한 요소. 여러 기억이 공유. 타입 3종(→ `CellType`). |
| `CellType` | 세포 타입 | 셀 분류 3종 — 의미(주제·개념)/공간(장소)/개체(사람·고유 대상). |
| `CellActivation` | 멤버십 | engram↔cell 조인 — 어떤 세포를 켰는지 + 가중치. |
| `Synapse` | 시냅스 | 두 세포 사이 가중 무방향 엣지(`a_id<b_id` 정규화). 기억↔기억 엣지는 없음. |
| `Synapse.Strength` | 시냅스 강도 | 두 세포가 얼마나 단단히 묶였는가 (0..1). |
| `Embedding` | 임베딩 | 의미 최근접 탐색용 pgvector 벡터. |
| `Emotion` | 감정 | mood + valence + arousal + intensity 값 객체. `Engram`에 붙음. |
| `AbstractionStage` | 추상화 단계 | 기억이 얼마나 요지화됐는가 (0=구체/해마 .. 4=요지/신피질). |
| `Engram.CurrentMemoryText` | 현재 기억 텍스트 | 마지막 회상 시 재구성된 서사. `Record`와 별개, 재공고화로 갱신. |
| `Engram.GistStages` | 요지 단계 | 미리 생성한 요지 텍스트 4개 배열(stage 1..4). `Gistifier`가 생성. |
| `MemoryProvenance` | 별 변천사 | 한 엔그램의 기억 텍스트 상태 변화 append-only 이력(종류 + 출처). |
| `Job` | 작업 | extract/embed/link 큐 항목. |
| `Stardust` | 별가루 | 회상 경제 화폐. append-only 원장(`stardust_ledger`)에서 잔액 파생. |
| 활성도 / 망각 | (파생) | 지금의 접근성. read-time 계산, 저장 안 함. 어두워질 뿐 0 아님. |
| 별자리 | (창발 — 타입 없음) | 두 엔그램이 세포를 공유하고 그 시냅스가 강해서 가까워짐. FE가 `constellation`으로 그림. |

---

## 2. 동사 — 유스케이스 (application services)

| 단어 | 간단 | 세부 |
|---|---|---|
| `Encode` | 부호화 | 일기 → 사건 분할 → 세포(재사용/할당) → 엔그램 + 활성 → 잡 적재. |
| `Link` | 연결 | 공유 세포·시냅스로 기억 간 근접이 *창발*하게 함. 엔그램끼리 직접 잇지 않음, 감정 안 씀. |
| `Recall` | 회상 | 엔그램 재발화 — 확산 활성화·경쟁 억제·`last_recalled_at` 갱신. 예측 오류 시만 `Reconsolidate`. |
| `Reinforce` | 강화 | "회상하기" 버튼 한 번의 강화를 멱등(`batch_id`) 적용. 내부에서 `Potentiate`/`Depress` 호출. |
| `Reconsolidate` | 재공고화 | 예측 오류 게이트로 `CurrentMemoryText` 갱신·`GistStages` 재생성·형태 재조형. `Record`는 불변. |
| `Consolidate` | 공고화 (수면) | 우주 시간 전진 순간 read-time 진행 — 재배치·요지화(stage++)·도식·항상성 다운스케일링. |
| `Earn` | 별가루 적립 | 일기 작성·접속으로 `Stardust` 적립. |
| `Spend` | 별가루 소모 | 무료 한도 초과 회상에서 `Stardust` 차감. 요지 단계 높을수록 저렴. |

---

## 3. 동사 — 도메인 순수 함수 (domain pure fns)

> IO 없음 — 서버와 FE 오프라인 데모가 동일 수식 공유(golden-parity).

| 단어 | 간단 | 세부 |
|---|---|---|
| `Potentiate` | 강화 (LTP) | `strength = min(1, strength + δ)` — 공동 점화 쌍. `Reinforce`가 호출하는 원시 연산. ↔ `Depress`. |
| `Depress` | 약화 (LTD) | 연합적·시냅스 특이적 약화. 삭제 없음. ↔ `Potentiate`. |
| `Downscale` | 항상성 다운스케일링 (SHY) | 수면 중 전역 시냅스 재정규화. **LTD와 다른 기전**, 삭제 없음. `Consolidate`가 호출. |
| `Decay` | 망각 / 감쇠 | `activation(Δt) = exp(-λ·Δt)`, `A_MIN` 바닥. Δt = 우주 시간 경과분. λ는 arousal 변조. |
| `Reshape` | 형태 재조형 | 재공고화 시 형태 재조각 — 부분 복원 + 미세 드리프트. |
| `InitialStrength` | 초기 시냅스 강도 | 새 연결 초기 강도(세포 중첩·맥락 기반, 감정 제외). |
| `AbstractionStageFor` | 추상화 단계 산출 | 시간/회상으로부터 현재 추상화 단계 도출. |
| `EffectiveBrightness` | 유효 밝기 | `last_recalled_at`와 `Decay`로부터 현재 밝기 도출. |
| `EffectiveStrength` | 유효 강도 | 누적 강화 + 각성 초기값으로부터 현재 별 크기 도출. |

---

## 4. 렌더링 어휘 (FE 전용)

> 시각화 레이어에서만 존재. Go 도메인·DB·proto·FE 도메인 미러는 절대 쓰지 않는다.

| 단어 | 간단 | 세부 |
|---|---|---|
| `star` | 큰 별 | 기억 하나 = `Engram` (크기=강도, 밝기=활성, 색=`Emotion`, 형태=`AbstractionStage`). |
| `cell-star` | 작은 별 | 세포 하나 = `EngramCell`. |
| `filament` | 선 | 세포 사이 선 = `Synapse` (굵기·밝기·맥동 = `Strength`). |
| `constellation` | 별자리 | 기억 군집 = 창발물, force-sim 출력. 도메인 타입 아님. |
| `latent-star` | 회색 별 | 잠재 세포 배경 점. 켜지는 순간 `cell-star`로 깨어남. 렌더 전용·비-DB. |
| `hippocampal-layer` / `neocortical-layer` | z축 2층 | `AbstractionStage`에서 파생되는 z 렌더 좌표(저장 안 함). 해마층 z0–10·신피질층 z15–25. |

---

## 5. AI 포트 (supporting context `ai`)

| 단어 | 간단 | 세부 |
|---|---|---|
| `Embedder` | 임베더 | 요소 → 임베딩 벡터. (연결 코어 — 필수) |
| `Extractor` | 추출기 | 일기 텍스트 → 사건 분할·요소·감정. 키 없으면 mock으로 degrade. |
| `Gistifier` | 요지 생성기 | 추상화된 기억의 파생 요지 텍스트 생성. `Record` 원문은 절대 변형 안 함. |
