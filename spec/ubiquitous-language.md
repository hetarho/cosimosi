# cosimosi — Ubiquitous Language (용어집)

> **이 문서의 권위.** 이것은 cosimosi **어휘(vocabulary)의 단일 진실 공급원(SSOT)** 이다. 새 도메인 명사·동사는 *코드에 등장하기 전에 여기에 먼저* 추가되고, 유비쿼터스-언어 lint가 이 표를 어기는 레이어(금지된 교차어휘 이름)를 실패시킨다.

> **세 문서의 권위 경계 — 서로 침범하지 않는다.**
> - `concept.md` — **무엇을·왜** (비전 + 신경과학 근거). 이름의 *의미*가 사는 곳.
> - **이 용어집** — **어휘 SSOT**: 한 개념 = 한 이름 (이중언어). concept의 의미 ↔ 코드(Go/DB/proto/FE)를 잇는 다리.
> - `ARCHITECTURE.md` — **구조·경계 SSOT**: 레이어, 의존 규칙, 어휘가 어느 레이어에 사는지. (어휘 자체는 이 용어집이 소유.)

---

## 0. 읽는 법 + 드리프트 방지 규칙

1. **한 개념 = 한 이름, 모든 레이어에서.** Go 타입 · DB 테이블 · proto 메시지 · FE 도메인 미러가 같은 이름을 쓴다. (§1 매트릭스가 이를 한눈에 보여준다.)
2. **렌더링 단어는 프론트엔드 전용.** `star` · `cell-star` · `filament` · `constellation`은 *시각화* 단어다. Go 도메인·DB·proto는 이 단어를 절대 쓰지 않는다(§4).
3. **창발하는 것에는 타입을 주지 않는다.** "기억 간 근접 / 별자리"는 force-sim의 출력이다 — Go 타입도, 테이블도, proto 메시지도 없다. 타입을 주면 기억↔기억 직접 엣지가 생겨 concept §10을 어긴다.
4. **어떤 레이어도 개념을 개명하지 않는다.** Go가 `Synapse`면 테이블은 `synapses`, proto는 `Synapse`, FE 미러도 `Synapse`이고, *시각* 레이어만 그 렌더링을 `filament`이라 부른다.
5. **동의어 금지.** 한 개념 행위에는 한 이름만. 단, *유스케이스(app)* 와 *원시 연산(domain pure fn)* 은 서로 다른 레이어의 다른 책임이므로 별개 이름을 가질 수 있다(예: `Reinforce` 유스케이스 ↔ `Potentiate` 원시 연산). 그 관계는 §3에 명시한다.
6. **신규 용어는 여기 먼저.** PR에서 새 도메인 명사·동사를 추가하면, 코드보다 이 문서가 먼저 갱신되어야 한다.

---

## 1. 교차-레이어 이름 매트릭스 (드리프트 방지 핵심표)

> 한 행 = 한 개념. 같은 이름이 모든 레이어를 가로질러 동일하게 흐르는지 한눈에 검사하는 표. "—"는 해당 레이어에 표상이 없음. **굵게**는 흔히 틀리는 지점.

| 개념 (KR) | Go 타입 | DB 테이블 | proto 메시지 | FE 도메인 | FE 렌더링 |
|---|---|---|---|---|---|
| 일기 원본 (불변) | `Record` | `records` | `Record` | `Record` | (텍스트 패널, 3D 바디 없음) |
| 기억 · 앙상블 (큰 별) | `Engram` | `engrams` | `Engram` | `Engram` | `star` |
| 세포 · 요소 (작은 별) | `EngramCell` | `engram_cells` | **`EngramCell`** | `EngramCell` | `cell-star` |
| 기억이 켠 세포 (멤버십) | `CellActivation` | `cell_activations` | `CellActivation` | `CellActivation` | (별이 켜는 세포들) |
| 시냅스 (**세포 사이** 연결) | `Synapse` | `synapses` | `Synapse` | `Synapse` | `filament` |
| 임베딩 | `Embedding` | `embeddings` | `Embedding` | `Embedding` | — |
| 감정 (13 mood, V/A) | `Emotion` (VO on `Engram`) | `engrams`의 mood/valence/arousal/intensity 컬럼 | `Emotion` | `Emotion` | `color` (전용) |
| 추상화 단계 (일화→의미) | `AbstractionStage` | `engrams.abstraction_stage` | `AbstractionStage` | `AbstractionStage` | `3D form` |
| 활성도 / 망각 | (파생) `EffectiveBrightness` | (저장 안 함) `last_recalled_at`로 계산 | (파생) | (파생) | `brightness` (어두워질 뿐, 0 아님) |
| 작업 (큐) | `Job` | `jobs` | `Job` | `Job` | — |
| 강화 멱등 배치 | — | `processed_batches` | (batch_id 필드) | — | — |
| **기억 간 근접 (별자리)** | **없음 (창발)** | **없음** | **없음** | **없음** | `constellation` (force-sim 출력) |

> **읽는 법.** "세포"는 모든 코드 레이어에서 `EngramCell`이다 — proto에서 `Cell`로 줄이지 않는다. "기억 간 근접"은 어느 레이어에도 타입이 없다 — 오직 FE가 force-sim 결과를 `constellation`으로 *그릴* 뿐이다.

---

## 2. 표준 명사 (Canonical Nouns)

> 각 명사의 *신경과학적 의미*와 *FE 시각 투영*. 과학 정의는 §5, 출처는 §5 인용 참조.

| 개념 (KR) | 표준명 | 무엇인가 (과학) | FE 시각 | concept.md |
|---|---|---|---|---|
| 일기 원본 | `Record` | 불변 일기 항목 — 원문·작성일(+선택적 작성자 힌트)만 보유. append-only, 수정·삭제 없음. **감정은 보유하지 않음**(→ `Engram`). | 텍스트 (패널에서 읽음) | §8.1, §8.4 |
| 기억 · 엔그램 | `Engram` | 한 기억 = 세포들의 *희소 앙상블*. **애그리거트 루트.** 세포를 소유하지 않고 id로 참조. `Emotion`·`AbstractionStage`를 보유. | `star` (큰 별) | §5.2 |
| 세포 · 엔그램 세포 | `EngramCell` | 한 요소(장소/인물/활동/주제). **여러 엔그램이 공유.** | `cell-star` (작은 별) | §5.1 |
| 멤버십 | `CellActivation` | engram↔cell 조인(어떤 세포를 켰는지 + 가중치). | 별이 켜는 세포들 | §5.2 |
| 시냅스 | `Synapse` | **두 세포 사이** 가중 엣지(무방향, `a_id<b_id` 정규화). 헵: 강화(LTP)/약화(LTD). **기억↔기억 엣지는 어디에도 없음.** | `filament` | §5.3 |
| 시냅스 강도 | `Synapse.Strength` (0..1) | 두 세포가 얼마나 단단히 묶였는가. | 선의 굵기·밝기·맥동 | §5.3, §7.5 |
| 임베딩 | `Embedding` | 의미 최근접 탐색용 pgvector 벡터. | — | §4.2 |
| 감정 | `Emotion` (값 객체) | mood + valence + arousal + intensity. **`Engram`에 붙음** — 일기를 사건으로 나눈 각 기억이 자기 색을 가짐. | `color` (위치엔 안 씀) | §7.3, §8.1 |
| 추상화 단계 | `AbstractionStage` (0..N) | 기억이 얼마나 요지화됐는가(일화→의미). | `3D form` (구체→추상) | §4.7, §7.4 |
| 활성도 / 망각 | (파생) | 지금의 접근성. read-time 계산, tick마다 저장 안 함. | `brightness` (어두워질 뿐, 절대 0 아님) | §4.5, §8.5 |
| 작업 | `Job` | extract/embed/link/consolidate 큐 항목. | — | §8.6 |
| 별자리 | *창발 — 타입 없음* | 두 엔그램이 가까운 이유: 세포를 공유하고 그 시냅스가 강해서. | `constellation` | §5.4, §6.3 |

---

## 3. 표준 동사 (Canonical Verbs)

> 유스케이스(app)와 도메인 순수 함수(domain pure fn)를 구분한다. 순수 함수는 IO가 없어 서버와 FE 오프라인 데모가 동일 수식을 공유한다(golden-parity).

### 3.1 유스케이스 (application services)

| 개념 (KR) | 동사 | 레이어 | 의미 | 쓰는 원시 연산 | concept.md |
|---|---|---|---|---|---|
| 부호화 | `Encode` | `engram/app` | 일기 → 사건 분할 → 세포(재사용/할당) → 엔그램 + 활성 → 잡 적재 | — | §8.1 |
| 연결 | `Link` | `engram/app` | 공유 세포·시냅스를 만들어 **기억 간 근접이 *창발*** 하게 함(감정 절대 안 씀). *엔그램끼리 직접 잇는 연산이 아님.* | `InitialStrength` | §4.3, §5.4 |
| 회상 | `Recall` | `engram/app` | 엔그램 재발화: 확산 활성화, 경쟁 억제, `last_recalled_at` 갱신. **예측 오류가 있을 때만** `Reconsolidate` 유발. | (호출) `Reinforce`/`Reconsolidate` | §8.3 |
| 강화 | `Reinforce` | `engram/app` | 회상의 강화를 적용하는 유스케이스. **client-local 누적 + debounced 멱등 unary 배치**로 공동 점화 쌍에 `Potentiate`(필요 시 경쟁 쌍에 `Depress`) 적용. `batch_id`로 중복 카운트 방지. | `Potentiate`, `Depress` | §8.3 |
| 재공고화 | `Reconsolidate` | `engram/app` | **예측 오류 게이트**로 형태를 재조형. 원문(`Record`)은 불변. | `Reshape` | §8.4 |
| 공고화 (수면) | `Consolidate` | `engram/app` (worker) | 야간: 재배치, 요지화(stage++), 도식, **항상성 다운스케일링**. | `Downscale` (+ `Reshape`, `AbstractionStageFor`) | §8.6 |

### 3.2 도메인 순수 함수 (domain pure fns)

| 개념 (KR) | 함수 | 의미 | 짝 | concept.md |
|---|---|---|---|---|
| 강화 (헵/LTP) | `Potentiate` | `strength = min(1, strength + δ)` — 공동 점화 세포 쌍. | ↔ `Depress` | §5.3, §8.3 |
| 약화 (LTD) | `Depress` | **연합적·시냅스 특이적** 약화(LTP의 짝). 공동 점화하지 않은/경쟁 시냅스에 적용. **삭제 절대 없음.** | ↔ `Potentiate` | §5.3 |
| 항상성 다운스케일링 | `Downscale` | **전역적** 시냅스 재정규화(SHY) — 수면 중 깨어 있을 때 쌓인 강화를 되돌림. **LTD와 다른 기전**(Tononi & Cirelli 2014). 삭제 없음. `Consolidate`가 호출. | (LTD와 별개) | §8.6 |
| 망각/감쇠 | `Decay` | `activation(Δt) = exp(-λ·Δt)`, `A_MIN`에서 바닥. 망각 = 접근성 감쇠(위치 이동 아님). | — | §8.5 |
| 형태 재조형 | `Reshape` | 재공고화 시 형태 재조각(부분 복원 + 미세 드리프트). | — | §8.4 |
| 초기 시냅스 강도 | `InitialStrength` | 새 연결의 초기 강도(세포 중첩·맥락 기반, **감정 제외**). | — | §4.3 |
| 추상화 단계 산출 | `AbstractionStageFor` | 시간/회상으로부터 현재 추상화 단계 도출. | — | §4.7 |
| 유효 밝기 | `EffectiveBrightness` | `last_recalled_at` + `Decay`로부터 현재 밝기 도출. | — | §7.1 |
| 유효 강도 | `EffectiveStrength` | 누적 강화로부터 현재 별 크기(강도) 도출. | — | §7.2 |

> **`Reinforce` vs `Potentiate` (동의어 아님).** `Reinforce`는 *유스케이스*(배치를 모아 멱등하게 적용)이고, `Potentiate`는 그 안에서 호출되는 *원시 연산*(LTP 수식)이다. 레이어가 다른 다른 책임이다.
> **`Depress`(LTD) vs `Downscale`(SHY) — 반드시 구분.** 전자는 *연합적·국소적* 약화(깨어 있을 때, 특정 시냅스), 후자는 *항상성·전역적* 재정규화(수면 중). 합치면 신경과학적으로 틀린다(concept §8.6).

### 3.3 AI 포트 (supporting context `ai`)

| 포트 | 책임 | 주의 |
|---|---|---|
| `Embedder` | 요소 → 임베딩 벡터. (연결 코어 — 필수) | — |
| `Extractor` | 일기 텍스트 → 사건 분할, 요소, 감정. | 키 없으면 mock으로 degrade |
| `Gistifier` | 추상화가 진행된 기억의 **파생 요지(gist) 텍스트** 생성. | **`Record`(원문)를 절대 변형하지 않음** — 파생 필드에만 쓴다(concept §10). |

---

## 4. 렌더링 어휘 (프론트엔드 전용)

이 단어들은 **시각화 레이어에서만** 존재한다. Go 도메인·DB·proto·FE 도메인 미러는 절대 쓰지 않는다.

| 렌더링 단어 | 무엇을 그리나 | 어느 도메인 개념의 투영 |
|---|---|---|
| `star` (큰 별) | 기억 하나 | `Engram` (크기=강도, 밝기=활성, 색=`Emotion`, 형태=`AbstractionStage`) |
| `cell-star` (작은 별) | 세포 하나 | `EngramCell` |
| `filament` | 세포 사이 선 | `Synapse` (굵기·밝기·맥동=`Strength`) |
| `constellation` | 기억 군집 | **창발물** — force-sim 출력. 도메인 타입 아님(그려질 뿐, 모델링되지 않음) |

> **두 어휘가 만나는 단 한 곳.** FE의 `entities/*/api` 매퍼(proto→FE 도메인)와 `entities/star`·`entities/cell-star`의 투영이 도메인 어휘와 시각 어휘가 만나는 *유일한* 경계다(architecture §3.4). 시각 단어(`star`/`filament`/`constellation`)는 이 경계 위로(도메인·API 매퍼로) 절대 거슬러 올라가지 않는다. 이것이 백엔드 anti-corruption 경계의 FE 거울이다.

---

## 5. 신경과학 용어 (이름 뒤의 과학)

> 코드 이름이 *왜* 그 이름인지의 근거. 출처 DOI 포함(대화 중 검증분 포함).

- **엔그램(engram)** — 한 기억의 물리적 흔적 = 뇌에 분산된 *희소 뉴런 앙상블*. "파편"이 아니라 "함께 묶임". → `Engram` (Josselyn & Tonegawa 2020, *Science*, DOI 10.1126/science.aaw4325).
- **엔그램 세포(engram cell)** — 그 앙상블을 이루는 개별 뉴런. 여러 기억에 공유됨. → `EngramCell`.
- **시냅스(synapse)** — 뉴런 사이 접점. *세포 사이에만* 존재(기억 덩어리 사이가 아님). → `Synapse`.
- **헵 가소성 / LTP(long-term potentiation)** — "함께 점화하는 세포는 함께 묶인다"; 동시 활성 세포의 시냅스 강화. → `Potentiate` (Hebb 1949; Bliss & Lømo 1973, *J Physiol*, DOI 10.1113/jphysiol.1973.sp010273; Bliss & Collingridge 1993, *Nature*, DOI 10.1038/361031a0).
- **LTD(long-term depression)** — *연합적·시냅스 특이적* 약화; LTP의 짝. → `Depress`.
- **시냅스 다운스케일링 / 항상성 가소성(SHY)** — 수면 중 시냅스 강도의 *전역적* 재정규화. **LTD와 근본적으로 다른 기전.** → `Downscale` (Tononi & Cirelli 2014, *Neuron*, DOI 10.1016/j.neuron.2013.12.025).
- **신경 할당(neuronal allocation)** — 흥분성 높은 뉴런이 새 기억을 맡도록 뽑히는 경쟁. → `Encode`의 세포 할당 (Han et al. 2007, *Science*, DOI 10.1126/science.1139438).
- **공동 할당(co-allocation)** — 가까운 시간(~시간 규모)에 부호화된 기억이 세포를 공유하게 됨. → `Link`의 시간 신호 (Cai et al. 2016, *Nature*, DOI 10.1038/nature17955).
- **재공고화(reconsolidation)** — 회상으로 불안정해진 기억이 갱신되며 재저장. *예측 오류*가 트리거. → `Reconsolidate` (Nader et al. 2000, *Nature*, DOI 10.1038/35021052; Sinclair & Barense 2019, *Trends Neurosci*, DOI 10.1016/j.tins.2019.08.007).
- **체계 응고화(systems consolidation) / 수면** — 해마 의존 → 신피질 분산표상; 수면 중 재배치·요지화. → `Consolidate` (McClelland et al. 1995, *Psychol Review*, DOI 10.1037/0033-295X.102.3.419; Diekelmann & Born 2010, *Nat Rev Neurosci*, DOI 10.1038/nrn2762; Klinzing et al. 2019, *Nat Neurosci*, DOI 10.1038/s41593-019-0467-3).
- **침묵 엔그램(silent engram)** — 존재하지만 자연 단서로는 안 켜지는 휴면 상태. → 밝기는 `A_MIN`에서 바닥(0 아님), 행 삭제 없음 (Roy et al. 2017, *PNAS*, DOI 10.1073/pnas.1714248114).
- **일화 vs 의미기억 / 흔적 변형** — 특정 사건 ↔ 맥락 벗긴 요지; 둘은 공존하며 시간이 지나며 의미화. → `AbstractionStage` (Tulving 1985, *Am Psychol*, DOI 10.1037/0003-066X.40.4.385; Winocur & Moscovitch 2011, *JINS*, DOI 10.1017/S1355617711000683).
- **망각 곡선** — 강도의 시간 감쇠. → `Decay` (Ebbinghaus 1885).
- **확산 활성화(spreading activation)** — 한 기억의 활성이 연결 이웃으로 번짐. → `Recall`의 이웃 효과 (Collins & Loftus 1975, *Psychol Review*, DOI 10.1037/0033-295X.82.6.407).
- **인출유도 망각(retrieval-induced forgetting)** — 인출이 경쟁 기억을 억제. → `Recall`의 경쟁 억제 (Anderson, Bjork & Bjork 1994, *J Exp Psychol LMC*, DOI 10.1037/0278-7393.20.5.1063).
- **자기 기억 체계(self-memory system)** — 자전적 기억은 자기를 중심으로 조직. → 반지름=자기관련성/연결도 (Conway & Pleydell-Pearce 2000, *Psychol Review*, DOI 10.1037/0033-295X.107.2.261).
- **시간 맥락 모형(temporal context)** — 시간은 거리가 아니라 *맥락*으로 들어와 같은 시기 기억을 묶음. → 위치 축이 아닌 링크 신호 (Howard & Kahana 2002, *J Math Psychol*, DOI 10.1006/jmps.2001.1388).

