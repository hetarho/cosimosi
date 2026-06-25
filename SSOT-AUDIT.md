# cosimosi SSOT 정비 체크리스트 — 구현 ↔ 개념·spec·policy 대조

> **목적.** SSOT(개념·spec·policy)로 구현하는 과정에서 **놓치거나 어긋난 것**을 모은 작업용 기록이다.
> 기능 구현을 다 끝낸 뒤 이 문서를 들고 한 번에 문서를 정비한다. **임시 문서** — 정비가 끝나면 지워도 된다.
>
> **판정 기준.** 코드가 진실이다. policy는 "코드의 거울(SSOT)"을 자처하지만 실제로 드리프트한다([A](#a-확정-드리프트--policy가-코드와-어긋남) 참고). 학습용 지도는 [`NEUROSCIENCE.md`](spec/tech/neuroscience.md).
>
> **검증 시점·범위.** 2026-06-14, 단일 사용자 뇌과학 트랙(spec 19–29, 38) 중심으로 실제 소스(.ts/.go)·커밋 diff에 대조했다. 아직 전수하지 않은 영역은 [F](#f-아직-전수-안-한-영역-다음-감사-권장)에 적었다.

---

## A. 확정 드리프트 — policy가 코드와 어긋남 (policy를 코드에 맞춰 수정)

> 코드가 진실. 아래는 **policy 문서가 틀린** 경우다.

- [ ] **A1 — `domain/universe.md` 자아 반지름.** 문서 `R_MIN 8 / R_MAX 60`(line 18) ↔ 코드 `R_MIN 6 / R_MAX 40`(`apps/web/src/shared/lib/layout.ts`). grep으로 8/60 변종이 코드에 없음 확인 → **문서를 6/40으로 수정.**
- [ ] **A2 — `domain/star.md` 별 카디널리티.** 문서 "일기 1편 = memory 1개 (1:1)"(line 7·19) ↔ 실제 **1 record → N memories**(spec 21 fan-out, `UNIQUE(record_id, fragment_index)`). memory.md는 1:N으로 갱신됐으나 star.md는 안 됨.
- [ ] **A3 — `domain/star.md` 감정 출처.** 문서 "감정·강도는 사용자가 기록 폼에서 직접 고른다(**AI 감정 감지가 아니다**)"(line 9·27) ↔ 실제 **AI가 조각마다 감지**(spec 20/21), 수동은 선택적 힌트. memory.md와 모순.
- [ ] **A4 — `domain/star.md` mood 개수.** 문서 "7 moods: JOY/CALM/SAD/ANGER/FEAR/LOVE/NEUTRAL"(line 28) ↔ 실제 **13종**(spec 29, `mood.ts`·proto enum 1–13). memory.md·proto와 단일 출처 불일치.
- [ ] **A5 — `domain/star.md` RecordMemory 트랜잭션.** 문서 "RecordMemory가 record·memory·embed job을 한 트랜잭션으로 생성"(line 19) ↔ 실제 **record + extract job**만 생성, 별·embed는 extract 워커가 fan-out(memory.md 기준).

> ⚠️ **star.md는 부분만 stale.** §정의·§genesis·§감정 입력(상단)은 spec 20/21/29 *이전* 상태이고, §재공고화 재성형·§요지화·§변조 감쇠(하단, spec 23/26/27)는 갱신돼 코드와 일치한다. **상단만 post-21 현실로 재조정**하면 된다. (star.md line 11이 "분할·AI 감정은 plan 20·21에서 다룬다"고 미래형으로 가리키는데, 그 plan이 이미 done.)

---

## B. 의도했으나 비활성/미배선 — "구현은 했는데 실제론 안 도는 것" (결정 필요)

> spec/policy엔 있고 코드 골격도 있으나, 런타임에서 **실제로 작동하지 않는** 것들. 기능을 마저 배선할지, 아니면 문서를 "비활성(seam)"으로 정직하게 적을지 결정해야 한다.

- [x] **B1 — 흥분성 게인 배선 완료.** `g = 1 + 0.3·arousal`(spec 25)이 worker 경쟁 할당에 `wExc·ExcitabilityGain(arousal)`로 배선됐다. arousal은 서버 ambient summary 없이 사용자 전체 별의 Bjork R envelope(`ListArousalInputs` → `ArousalFromSamples`)에서 재도출한다.
- [x] **B2 — 회상 재성형 활성.** `GetReshapeContext`가 `RecallEmbedding`을 co-recall 이웃 centroid로, `ConsolidatedEmbedding`을 회상 별 자기 임베딩으로 반환한다. co-recall 맥락이 있으면 pe>0이 가능하고, 맥락이 없으면 자기 임베딩 fallback으로 pe=0 단순 재점화다.
- [ ] **B3 — 개체(entity) 기반 연결·도식 보너스 없음.** concept 결정2는 "공유 개체(같은 인물·장소·주제) 겹치면 연결 보너스 + 도식 적합 통합"을 명시하나, 실제 시냅스 생성은 **의미(semantic)+시간+흥분성**뿐이다. `link_type`의 `'entity'`·`'temporal'`은 **타입에만 정의, 생성 경로 없음**(synapse.md). 개체는 추출기(spec 20 `Entities{people,places,topics}`)가 뽑지만 **연결 가중에 미사용**(저장 여부도 확인 필요). 도식 보너스는 genesis가 아니라 야간 재분배(spec 27)에만 있음.

---

## C. concept.md (헌법) 정비 — 이미 구현돼 거짓이 된 "v1+ 연기" 문구

> concept.md는 MVP 시점에 쓰여, 여러 곳에 "(MVP는 X만; v1+ #N으로 연기)"라는 괄호가 달려 있다. 그 기능들이 **지금은 구현돼** 그 괄호가 거짓이 됐다. (concept의 `#20~#25`는 구 번호 — overview의 재배치 매핑으로 읽는다: 구#20=신23, 구#21=신24, 구#22=신27, 구#23=신26 등.)

- [ ] **C1 — 결정3(line 85).** "*v1+ #20·#21로 연기 — MVP에서 별은 시드 기반 1회 생성, 회상은 last_recalled_at만*" → 재성형(23)·변천사 UI(24) 구현됨. 회상 재성형도 [B2](#b-의도했으나-비활성미배선--구현은-했는데-실제론-안-도는-것-결정-필요) 배선으로 co-recall 맥락에서 활성화됨.
- [ ] **C2 — 망각 모델(line 134).** "*MVP는 순수 시간 감쇠(반감기 30일)만; 관련성/감정 가중은 v1+ #23으로 연기*" → `λ_eff`(spec 26) 구현됨.
- [ ] **C3 — 요지화(line 135).** "*MVP는 밝기 감쇠만; 형태 추상화/요지화는 v1+로 연기, 별 형태는 f(intensity) 고정*" → 야간 요지화(spec 27, `form_seed_delta`) 구현됨.
- [ ] **C4 — 야간 공고화(line 144).** "## 야간 공고화 *(전체 v1+ #22 — MVP 비목표)*" → spec 27 4패스 구현됨.
- [ ] **C5 — 별 변천사(line 167).** "*v1+ #21로 연기 — 변천사 UI는 MVP 범위 밖*" → spec 24 구현됨.
- [ ] **C6 — 회상 재성형(line 214·215).** "*v1+ #20으로 연기*"·"MVP 회상은 last_recalled_at만" → 23 구현 및 [B2](#b-의도했으나-비활성미배선--구현은-했는데-실제론-안-도는-것-결정-필요) 배선으로 co-recall 맥락에서 회상 재성형이 활성화됨.
- [ ] **C7 — 의사결정 로그(line 322–328).** "중심 거리 = 망각 축" 결정이 "구현 plan 신설 대기"로 남아 있으나 **spec 38로 구현됨**. → 로그에서 본문(결정1·망각 모델)으로 승격하고 "각도=안정·반지름=강함"으로 개정.
- [ ] **C8 — 구 번호 표기 일괄 정리.** overview line 228이 이미 명시: "concept.md·Architecture.md·specs 04·05·07·10·11·12의 'v1 #20–#25' 표기는 추후 일괄 정리 대상." `Architecture.md`도 같은 정리 필요(이번에 미확인).

---

## D. 미구현 백로그 (정상 — spec은 있고 코드는 없음)

> 드리프트가 아니라 **계획대로 아직 안 한 것**. 참고용.

- [ ] **소셜 레이어** — 35 universe-sharing / 36 shared-memory-resonance / 37 universe-overlay. concept §우주 공유·함께한 기억, [NEUROSCIENCE §7](NEUROSCIENCE.md#7-두-사람의-기억--소셜-아직-spec만). 다중 사용자 전제라 단일 사용자 트랙 이후.
- [ ] **인프라** — 32 staging-isolation, 33 observability-activation(실 키 연결·베타 직전 맨 마지막).
- [ ] (소소) spec 30 개인화의 "온보딩 피커·집계"는 미래로 명시됨.

---

## E. 이번에 코드로 검증해 **일치 확인**된 것 (재작업 불필요)

> 아래는 policy·문서와 실제 코드가 정확히 맞아떨어진 것들. 정비 때 건드릴 필요 없다.

- **감쇠/망각:** `HALF_LIFE_DAYS=30`·`A_MIN=0.05`·dormant `2·A_MIN`·`λ_eff` 계수 `0.6/0.5/0.7/0.4`·`modulatedBrightness` (`activation.ts`, 주석이 "floor stays A_MIN(단일 헌법§2 바닥)"이라 명시 → 랜딩의 0.12는 시연용 확정).
- **헵·간격:** `DWELL_MS=2000`·`CO_RECALL_DELTA=0.05`·`DEBOUNCE 5s`·`SPACING_GAIN=1.0`·`SPACING_REF_DAYS=1` (`co-recall.ts`).
- **경쟁 할당:** `tauExc=6h`·`wExc=0.25`·`biasedK=5`·`candidateK=knnK*2=16`·`inhibitDecay=0.5` (`worker.go`).
- **재공고화:** `peThreshold=0.15`·`baseStep=0.22`·`maxBrightStep=0.22`·`neighborFactor=0.4`·`strengthRecallGain=0.15`·`ageGain=0.30`·`ageRefDays=90` (`service.go`).
- **야간 4패스:** `redistributeLerp=0.6`·`schemaBonus=0.15`(max 0.95)·gist `30/14/0.4`·prune `0.2/14/0.05`·`consolidateHourUTC=18` (`consolidate.go`).
- **시냅스 생성:** `τ=0.75`(`embedding.sql`)·`knnK=8`·시간창 `7일·+0.3`·일내결속 `0.8`·`semanticWeightCap=0.79` (`worker.go`/`link.sql`).
- **ambient(25):** `TAU_MOOD_DAYS=7`·`AROUSAL_GAIN=0.3`·`ExcitabilityGain=1+0.3·arousal` (FE `ambient.ts`/BE `memory.go`) — [B1](#b-의도했으나-비활성미배선--구현은-했는데-실제론-안-도는-것-결정-필요) 배선으로 worker 할당 점수의 흥분성 항을 스케일.
- **감정(29):** mood 13종·4사분면(HAP/LAP/HAN/LAN) 메타·proto enum `JOY=1…EMPTINESS=13` (`mood.ts`/`memory.proto`).
- **분할(20/21):** `maxSegments=5`·하드캡 8 (`extractor.go`).
- **시냅스 시각:** `ALPHA_MIN=0.15`·`THICK_THRESHOLD=0.5`·`vitality=0.12·min(1,log2(1+n)/4)` (`synapse mapping.ts`).
- **커밋→코드 매핑:** spec 03/05/11/12/19/20/21/22/23/24/25/26/27/28/29/38 커밋이 각각 주장한 파일(마이그레이션·worker/service/consolidate.go·mood/layout/reshape.ts·proto)을 실제로 건드림 확인.

---

## F. 아직 전수 안 한 영역 (다음 감사 권장)

> 이번 검토는 뇌과학 트랙 중심이었다. 아래는 코드 대조를 못 한 곳 — 정비 전 한 번 더 훑을 것.

- [ ] **`domain/navigation.md` 카메라 상수** — `BASE_SPEED 16`·`OBSERVE_MIN_DIST 58`·`SHIP_BOUNDARY≈39`·fly-to 감쇠 `exp(-dt·3)` 등 (UniverseCanvas/use-camera-mode에 분산, 위치만 미확인).
- [ ] **`domain/universe.md` 시각 상수** — 별 먼지 count 1500·반지름 35~145, ambient scatter 120~200, 서버 force-sim 힘 모델(−30/30/0.6).
- [ ] **`domain/data-sync.md`·`domain/admin.md`** — 캐시 무효화·병합·LLM 키 봉투 암호화 등(뇌과학 무관이나 SSOT).
- [ ] **각 spec의 수용 기준(EARS)·완료 정의(DoD)** — 체크박스는 done이나 수용 기준 문장 단위로 코드에 다 반영됐는지.
- [ ] **`Architecture.md`** — 구 번호 표기([C8](#c-conceptmd-헌법-정비--이미-구현돼-거짓이-된-v1-연기-문구)) + FSD/데이터모델 서술이 현재 코드와 일치하는지.
- [ ] **랜딩·데모 카피** — 이론 카드 문구가 실제 정전 값과 맞는지(예: SilentEngramCard `0.12` 표기 vs 실제 `A_MIN 0.05`).

---

> **정비 순서 제안.** 기능 완성 후: **B(배선 결정) → A(policy 드리프트 수정) → C(concept 정비) → F(잔여 감사)**. B를 먼저 정하는 이유 — B1/B2를 *배선*하기로 하면 C1·C6·B 항목이 "거짓"이 아니게 되어 정비 내용이 달라진다.
