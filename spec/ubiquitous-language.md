# cosimosi — Ubiquitous Language (용어집)

> cosimosi 어휘의 단일 진실 공급원(SSOT) — [PRD.md](PRD.md) §3의 정규 미러. **한 개념 = 한 이름.** 각 항목은
> *단어 / 간단 / 세부*만 담는다 — 의미의 *왜*와 신경과학 근거는 [concept.md](concept.md) · PRD §9가 소유한다.

## 세 층의 언어

- **코드 = UL = 과학(기능) 용어.** 비즈니스 로직이 기억 인지과학 기반이므로 코드·DB·proto·기획·대화가 *하나의 과학
  용어*를 쓴다(`EpisodicMemory`·`Neuron`·`Synapse`·`Hippocampus`…). 한 개념 = 한 이름, 모든 레이어에서.
- **사용자 표시 = 시적 카피.** 사용자 UI에만 보이는 감성 표현(기억의 별·우주먼지·기억의 바다·별의 영혼·별가루…).
  코드와 *느슨하게* 매핑하며 **코드/도메인엔 절대 안 쓴다**(렌더링 어휘는 §4).
- **영감을 얻은 곳.** 해부학·이론 출처(engram 등)는 concept.md · PRD §9가 보존하되, UL 이름은 위 기능 용어를 쓴다.

## 규칙

- **한 개념 = 한 이름, 모든 레이어에서.** Go 타입 · DB 테이블 · proto · FE 도메인 미러가 같은 이름을 쓴다(표현별
  casing/접미사/복수형은 허용, 동의어·약어는 금지).
- **렌더링 단어는 FE 전용.** `star`·`cell-star`·`filament`·`constellation`·`nebula`는 시각화 단어다 — 도메인·DB·proto는
  절대 쓰지 않는다(§4).
- **창발하는 것에는 타입을 주지 않는다.** "기억 간 근접 / 별자리"·"성운"·"잠재 뉴런"은 force-sim 출력·파생·렌더 배경일
  뿐, 타입·테이블이 없다(타입을 주면 폐기된 기억↔기억 엣지가 부활한다).
- **유스케이스 ↔ 원시 연산은 다른 레이어라 별개 이름 가능**(`Reinforce`≠`Potentiate`, `Depress`≠`Downscale`).
- **신규 도메인 용어는 코드보다 이 문서에 먼저.**

---

## 1. 명사 (Nouns)

| 단어 | 간단 | 세부 |
|---|---|---|
| `Diary` (`diaries`) | 일기 원본 | 사용자가 쓴 **불변** 일기. live 상태에서는 append-only이며 시스템/재공고화가 수정하지 않는다; 사용자 명시적 삭제([X])는 예외. 시적: *일기*. |
| `EpisodicMemory` (`episodic_memories`) | 일화기억 | 한 경험의 기억 = 뉴런들의 *희소 앙상블*. **애그리거트 루트**(뉴런을 id로 참조). `name`(LLM 추천, 사용자 수정 가능)·`Emotion`·`CurrentText`·`SemanticStages`·`DecayStages` 보유. 시적: *기억의 별(○○별)*. |
| `SemanticMemory` | 의미기억 | 일화기억이 *요지화*되어 신피질로 오른 버전. `EpisodicMemory`에 종속(별도 대등 엔티티 아님). 시적: *별의 영혼*. |
| `EpisodicMemory.CurrentText` | 현재 기억 텍스트 | 마지막 회상 시 재구성된 서사. 재공고화로 갱신, `Diary`(불변)와 별개. |
| `EpisodicMemory.SemanticStages` | 요지화 단계 텍스트 | LLM이 미리 만든 의미화 4단계. 재공고화 시 *남은 단계만* 재생성. |
| `EpisodicMemory.DecayStages` | 망각 단계 텍스트 | 망각 단계별 텍스트 — 단어 랜덤 삭제. *요지화와 독립 축*, 밝기와 함께 진행. |
| `Neuron` (`neurons`) | 뉴런 (요소) | 기억의 구성 요소. **타입 3종**(→ `NeuronType`). 여러 기억이 공유. `name` nullable(null = 잠재). 시적: *우주먼지*. |
| `NeuronType` | 뉴런 타입 | 3종 — **의미**(semantic, 주제·개념)/**공간**(spatial, 장소)/**개체**(entity, 사람·고유 대상). |
| `NeuronActivation` (`neuron_activations`) | 켜진 뉴런 (멤버십) | `EpisodicMemory`↔`Neuron` 조인(+가중치). |
| `Synapse` (`synapses`) | 시냅스 | **두 뉴런 사이** 가중 무방향 엣지(`a_id<b_id` 정규화). 헵: 강화(LTP)/약화(LTD). 기억↔기억 엣지 없음. 시적: *빛나는 선*(무명). |
| `Synapse.Strength` (0..1) | 시냅스 강도 | 두 뉴런이 얼마나 단단히 묶였는가. 시적: *선 굵기·밝기*. |
| `Embedding` (`embeddings`) | 임베딩 | 의미 최근접 탐색용 pgvector 벡터. |
| `Emotion` | 감정 | mood + valence + arousal + intensity 값 객체. `EpisodicMemory`마다 주 감정 1개. valence → 색, arousal → 강도·망각 변조. **위치 무관**([I3]). 시적: *별빛 색*. |
| `EffectiveBrightness` | 활성도 / 망각 (파생) | 지금의 접근성. read-time 계산, 저장 안 함. 어두워질 뿐 0 아님. 시적: *밝기*. |
| `EffectiveStrength` | 강도 / 크기 (파생) | 누적 회상 + arousal 초기값. **위치 무관**. 시적: *별 크기*. |
| `Twinkle` (`twinkle_ledger`) | 화폐 | 회상 화폐. **기본**(매일 리셋) / **추가**(영구·충전) 2층. append-only 원장에서 잔액 파생. 회고 = 망각 깊을수록 비쌈, 영혼 열람 = 요지화 깊을수록 쌈. 시적: *별가루*. |
| 변천사 (`EpisodicMemory` 텍스트 이력) | 변천사 | 생성 → 요지화 → 재공고화… 종류 라벨 + 출처 + 시간순. 왜곡 무알림. append-only. 시적: *별 변천사*. |
| `Job` (`jobs`) | 작업 (큐) | extract / embed / link / consolidate 큐. |
| `Hippocampus` / `Neocortex` | 2-저장 (좌표 규약) | 일화기억 생성지 / 요지 저장. 요지화 = 신피질 상승(x,y 복사·z만). **별도 엔티티 아님**. 시적: *얕은바다 / 중간바다*(심해 = 도식 v2). |
| *(창발 — 타입 없음)* | 기억 간 근접 | 뉴런 공유 + 시냅스 강함 → force-sim 출력. 시적: *별자리*. |
| *(렌더 배경 — 타입 없음)* | 잠재 뉴런 | 회색 점. 활성화 시 `Neuron` 행 생성(경쟁적 할당). DB 아님. 시적: *이름 없는 먼지*. |
| *(파생 — `Emotion` 블렌딩)* | 감정 색 (군집) | 강도 가중 감정 색의 창발적 혼합. 시적: *성운*. |

---

## 2. 동사 — 유스케이스 (application services)

| 단어 | 간단 | 세부 |
|---|---|---|
| `Encode` | 부호화 | 일기 → 일화기억 분할 + 이름 추천 + 감정 + 뉴런 추출/정규화(재사용·dedup) → 엔그램 + 활성 + 잡 적재. |
| `Link` | 연결 | 뉴런 공유 + 시간 근접으로 시냅스가 *창발*하게 함. 기억끼리 직접 잇지 않음, 감정 안 씀. |
| `Recall` | 회상 (재공고화) | 회고 시 밝기·망각·요지화 타이머 회복 + LTP. 예측 오류가 있을 때만 `Reconsolidate`. |
| `Reinforce` | 강화 | "회고하기" 한 번의 강화를 멱등(`batch_id`) 적용. 내부에서 `Potentiate`/`Depress` 호출. |
| `Reconsolidate` | 재공고화 | 예측 오류 게이트로 `CurrentText` 갱신 + `SemanticStages` *남은 단계* 재생성 + `Reshape`. `Diary` 불변. |
| `ViewSemantic` | 의미기억 열람 | 요지 별(신피질) *보기만*. 다시 쓰기 없음. 요지화 깊을수록 저렴. |
| `Consolidate` | 공고화 (수면) | 우주 시간 전진 순간 read-time 진행 — 재배치 · `Semanticize`(stage++) · `Downscale`. |
| `Forget` | 망각 | 밝기 감쇠 + 단어 삭제, 바닥 유지. read-time(우주 시간 기준). |
| `Release` | 놓아주기 / 삭제 | 사용자 명시적 삭제(전체 = 소프트 딜리트 30일 / 놓아주기 = 의미 뉴런 영구 봉인). |
| `Earn` | 별가루 적립 | 일기 작성 · 친구 초대 · 결제로 `Twinkle` 적립. |
| `Spend` | 별가루 소모 | 회고(재공고화) · 요지 열람에서 `Twinkle` 차감(기본 → 추가 순). |

---

## 3. 동사 — 도메인 순수 함수 (domain pure fns)

> IO 없음 — 서버와 FE 오프라인 데모가 동일 수식 공유(golden-parity).

| 단어 | 간단 | 세부 |
|---|---|---|
| `Potentiate` | 강화 (LTP) | 공동 점화 쌍 강화 — *남은 여지(1 − 현재강도)에 비례*해 1.0에 점근. `Reinforce`가 호출하는 원시 연산. ↔ `Depress`. |
| `Depress` | 약화 (LTD) | 연합적·시냅스 특이적 약화. 삭제 없음. ↔ `Potentiate`. |
| `Downscale` | 다운스케일링 (SHY) | 수면 중 전역 시냅스 재정규화. **LTD와 다른 기전**, 삭제 없음. `Consolidate`가 호출. |
| `Semanticize` | 요지화 | 일화기억 → 의미 압축 단계 산출. *망각과 독립 축*. |
| `Reshape` | 형태 재조형 | 재공고화 시 별 seed 변경 = 모양 변화(재구성성). 어긋남이 있을 때만. |
| `InitialStrength` | 초기 시냅스 강도 | 새 연결 초기값(낮게 시작; 같은 기억 내 > 공유 뉴런 > 시간 근접 차등). 감정 제외. |
| `Decay` | 망각 / 감쇠 | 밝기·망각 단계 감쇠. Δt = 우주 시간 경과분. arousal·연결강도 변조, 바닥 유지. |
| `EffectiveBrightness` | 유효 밝기 | 마지막 회상 시각 + `Decay`로부터 현재 밝기 도출. |
| `EffectiveStrength` | 유효 강도 | 누적 강화 + 각성 초기값으로부터 현재 별 크기 도출. |

---

## 4. 렌더링 어휘 (FE 전용)

> 시각화 레이어에서만 존재. Go 도메인·DB·proto·FE 도메인 미러는 절대 쓰지 않는다(anti-corruption 경계).

| 단어 | 간단 | 세부 |
|---|---|---|
| `star` | 큰 별 | 기억의 별 = `EpisodicMemory` / 영혼 = `SemanticMemory`. 크기 = 강도, 밝기 = 활성, 색 = `Emotion`, 모양 = seed. |
| `cell-star` | 작은 별 | 우주먼지 = `Neuron`. seed 없는 단순한 점. |
| `filament` | 선 | 빛나는 선 = `Synapse`. 굵기·밝기·맥동 = `Strength`. 별끼리 잇는 선은 없음. |
| `constellation` | 별자리 | 기억 군집 = 창발물, force-sim 출력. 도메인 타입 아님. |
| `nebula` | 성운 | 강도 가중 `Emotion` 블렌딩. 전역 색조가 로컬 색에서 창발. |
| `latent-star` | 회색 별 | 잠재 뉴런 배경 점. 켜지는 순간 `cell-star`로 깨어남. 렌더 전용·비-DB. |
| 깊이 층 | z축 2층 | 얕은/중간/심해 바다 = `Hippocampus`/`Neocortex`/도식. 신피질 버전은 해마 x,y를 복사하고 z만 고정 밴드로 상승(해마 z 0–10·신피질 z 15–25, [C6]); z 층은 요지화 진행도가 정함(`SemanticStages` 텍스트에서 좌표를 파생하지 않음). z 렌더 좌표는 저장 안 함([I5]). |

---

## 5. AI 포트 (supporting context `ai`)

| 단어 | 간단 | 세부 |
|---|---|---|
| `Extractor` | 추출기 | 일기 → 사건 분할 · 이름 추천 · 요소 정준화 · 감정. **출력 스키마 강제**(위치·색·강도·시간·삭제는 스키마에 없음). |
| `Embedder` | 임베더 | 요소 → 임베딩 벡터. |
| `Semanticizer` | 의미화 생성기 | 의미화 단계 텍스트 생성. `Diary` 원문은 **절대 불변**. |
