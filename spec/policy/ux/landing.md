# 랜딩 (policy/ux/landing)

> 현재 구현된 랜딩 페이지(`/landing`)의 사실 정의 — 테마·시각화·진입의 규칙·정전 파라미터·불변식.

## 정의

랜딩(`/landing`)은 cosimosi가 무엇을 지향하는지 한 화면으로 보여주는 비전 showcase다. 방문자는 Lenis 관성 스크롤을 따라 히어로 → 8개 장(章)을 내려가며, 각 장의 이론 카드가 2D SVG 프리미티브 `VizStar`/`VizSynapse`로 별·시냅스 메타포를 시연한다. 카드는 `useAppearance((s) => s.object)`(전역 별 형태)를 구독해 3D 우주와 같은 시각 언어를 쓴다.

시각 설정은 두 독립 축이다 — **테마**(색·분위기, 3종)와 **오브제**(별 형태, 4종). 둘 다 플로팅 `AppearanceSwitcher`로 고르며 `localStorage`에 지속된다. 카드가 시연하는 일부 메커니즘(요즘 상태·재공고화·야간 공고화·공명 등)의 백엔드 동작은 plan 20–30에서 다룬다(아직 정책 아님 — 카드의 🚧 배지가 이를 표기). 랜딩은 그 비전을 SVG로 보여줄 뿐, 카드가 곧 그 기능의 정책은 아니다.

## 규칙 · 파라미터

### 테마 · 오브제 (두 축, `entities/appearance`)

| 축 | 값 | 기본 | 역할 |
|---|---|---|---|
| 테마(Theme) | `vast` · `lively` · `calm` | `vast` | 배경 atmosphere·글래스 크롬·accent 색·우주 배경색 |
| 오브제(StarObject) | `deepfield` · `aurora` · `liquid` · `ember` | `deepfield` | 별·시냅스의 형태(재질) |

- 테마를 바꾸면 배경(`VastBackground`/`LivelyBackground`/`CalmBackground`)·`.glass` 크롬·히어로 그라디언트·accent가 함께 전환된다.
- 오브제를 바꾸면 `VizStar`/`VizSynapse`가 그 형태로 다시 그려진다(`ember`=mood색 코어, `deepfield`=점선 별자리 선, 그 외=차가운 백색 코어).
- 두 선택 모두 `localStorage` 키 `cosimosi.appearance`에 지속 — 새로고침해도 마지막 테마·형태 유지. 손상값은 각 축 기본값으로 폴백.
- 스위처(`AppearanceSwitcher`)는 우하단 고정 FAB로 접혀 있다가 펼치면 테마(3칩)·오브제(4칩) 두 라디오그룹을 띄운다. 랜딩·우주 양쪽에서 공유한다.

### 이론 카드 (JourneyAct 챕터 순서)

| 챕터 | 컴포넌트 | 지금 시연하는 것 |
|---|---|---|
| I 여는 이야기 | `ConceptSection` | 별 7개 + 곡선 시냅스 성단, 호버/포커스/클릭 시 이웃이 함께 밝아짐 |
| II 엔그램 | `EngramCard` | 뉴런 다발 → 시냅스 → 별 매핑, in-view/hover 시 함께 pulse |
| III 헵·시간 창 | `HebbianCard` | "두 별, 함께 떠올리기" 버튼 — 누를 때마다 실제 규칙(+`CO_RECALL_DELTA`=0.05·상한 1.0)으로 **단조** 강화. 약화(LTD)는 plan 23 비전이라 시연하지 않음 |
| III 헵·시간 창 | `TimeWindowCard` | 간격 슬라이더(약 10분~1주) — 실제 규칙대로 의미 base(예시 0.45)에 **같은 날(24h 창) +0.3 보너스**가 더해지고, 창이 닫혀도 의미 연결은 남음 |
| IV 재공고화 | `ReconsolidationCard` | 불변 원본 문장 + "다시 떠올리기"마다 밝기 ±·hue 좁게 드리프트되는 별 + 변천사 스트립 |
| V 침묵 엔그램 | `SilentEngramCard` | 일수 슬라이더(0~180일) — 실제 망각 모델(`A_MIN`=0.05·`HALF_LIFE_DAYS`=30, entities/memory 정전 상수 import) 별 vs plan 26 비전(고립 별 더 빠름, 🚧 표기) 별, "다시 비추기" |
| VI 요즘의 나 | `PresentSelfCard` | 마음 칩 선택 시 앰비언트 글로우 전환, 새 별이 그 별무리 곁으로 끌려가 연결 |
| VII 야간 공고화 | `NightlyConsolidationCard` | "밤 보내기" → 재활성화·재분배·요지·가지치기 4단계 애니메이션 |
| VIII 공명 | `ResonanceSection` | 두 미니 우주의 두 별 — 토글 시 가운데 곡선 시냅스로 이어짐 |

- 챕터 순서는 뇌과학 이론 흐름(plan 19–27: 엔그램→연결·강화→재공고화→망각→요즘 상태→야간)과 정합한다. 조각화(plan 21) 카드 자리는 II와 III 사이로 예약(21의 T-landing이 신설).
- **상태 배지(`TheoryBadge`)** — 각 이론 카드는 ✅(지금 우주에서 동작 + plan NN) 또는 🚧(계획된 비전 + plan NN)을 표기한다: Concept/Engram/Hebbian/TimeWindow/SilentEngram = ✅(08·09/08·11/11/05/12), PresentSelf = 🚧22·25, Reconsolidation = 🚧23·24, Nightly = 🚧27, Resonance = 🚧30.
- **"이 카드 체험하기"(`TryInUniverse`)** — 구현된 이론 카드 5개(Concept·Engram·Hebbian·TimeWindow·SilentEngram)는 `enterDemoMode()` 후 `/?sim=<id>`로 진입해 시뮬레이션 패널([interaction](interaction.md) §체험)이 그 이론을 펼친 채 맞이한다. 계획 카드에는 체험 버튼이 없다(아직 체험할 동작이 없음 — 각 스펙 T-landing이 단다).
- 각 카드는 `useAppearance((s) => s.object)`를 구독해 별·시냅스를 같은 4 형태로 그리고, 버튼·슬라이더·hover·토글 등 인터랙션을 유지한다.
- 구현된 이론 카드의 시연 수치는 정전 상수를 import해 표류를 막는다(`A_MIN`·`HALF_LIFE_DAYS` ← entities/memory, `CO_RECALL_DELTA` ← features/recall). `TimeWindowCard`의 의미 base 0.45는 예시 값(백엔드 임베딩 유사도는 FE 정전 상수가 없음 — 카드가 근사임을 문구로 밝힘).

### 진입 (데모)

- 히어로 1차 CTA("우주 만들어보기")·CtaFooter("가입 없이 들어가 보기")는 `enterDemoMode()` 후 `/`로 이동 — 로그인/DB 없이 더미 우주를 본다.
- 이론 카드의 "이 카드 체험하기"는 같은 경로에 `?sim=<id>`를 더해 **엔그램 이론 모달이 그 이론 페이지로 열린 채** 시작한다(레지스트리에 없는 id는 무시). 이미 데모 중이던 탭에서는 진행 상태(가상 시계·추가 별)가 유지된다 — 초기화는 컨트롤러 "처음으로" 또는 "체험 종료"가 담당.
- 히어로 "천천히 둘러보기"·스크롤 힌트는 `useScrollToSection('concept')`로 `concept` 섹션에 안착(Lenis 우선, 없으면 네이티브 폴백).
- 히어로 엠블럼은 3D `ThemedStar`(오브제 형태 + 테마 accent 색). 이론 카드 본문 시각화는 2D SVG다.

### 비주얼 · 모션 가드레일

- 트렌디한 SVG/CSS 그라디언트로 우주감을 낸다(랜딩 본문에 WebGL/three 신규 도입 없음 — 히어로 엠블럼만 3D).
- 항상-온 미세 모션 — 완전 정적이 아니다(다가가면 깨어나는 pulse 등).
- coarse pointer/모바일에서 hover 없이도 in-view로 트리거된다.
- glow/bloom이 잘리지 않게 박스를 넉넉히 잡는다(히어로 엠블럼 320px 등).
- 시냅스는 항상 곡선이다(`synapseCurve` 2차 베지어, 직선 금지).
- 의미 색(hue)은 mood 팔레트(violet/teal/coral/pink/amber 등) 기준으로 테마·형태와 무관하게 보존된다.
- `prefers-reduced-motion: reduce`이면 무한 애니메이션이 정지하고 정적 프레임만 보인다.

## 불변식 (invariants)

- **밝기만, 삭제 없음**(헌법2): 랜딩 시각화에서도 별·시냅스는 어두워질 뿐 사라지지 않는다.
- **원본 불변**(헌법1): `ReconsolidationCard`는 별이 회상마다 변해도 원본 문장은 그대로임을 한 화면에서 보여준다.
- **의미 색 보존**: 테마(색)·오브제(형태)를 바꿔도 hue는 개념을 운반하므로 바뀌지 않는다.
- **시냅스 곡선 전용**(헌법8 Line2 메타포): 직선 시냅스 금지.
- **3D 씬 안 DOM 금지**(헌법4·Architecture §3.1): 컨트롤·HUD는 R3F 캔버스 밖 2D DOM으로만 마운트.

## 구현 근거

- 3 테마·SVG 배경·`VizStar`/`VizSynapse`·곡선 시냅스·Lenis 스크롤·reduced-motion: 구현 plan 15 · `pages/landing/ui/{LandingPage,section/*}.tsx` · `pages/landing/lib/scroll.ts`.
- 테마(3)·오브제(4) 2축 분리·`AppearanceSwitcher`·`localStorage` 지속: 구현 plan 15(이후 FSD 정리로 이전) · `entities/appearance/model/{types,themes,store}.ts` · `features/switch-appearance/ui/AppearanceSwitcher.tsx`.
- `VizStar`/`VizSynapse` 프리미티브·곡선 헬퍼: 구현 plan 15 · `entities/star/ui/VizStar.tsx` · `entities/synapse/ui/VizSynapse.tsx` · `entities/synapse/lib/curve.ts`.
- 데모 진입: 구현 plan 15 · `pages/landing/ui/section/{HeroSection,CtaFooterSection}.tsx` · `shared/lib/demo`.
- 상태 배지·"이 카드 체험하기"·정확성 정합(헵 단조·시간창 보너스·바닥 5%)·챕터 순서: 구현 plan 19 · `pages/landing/ui/section/{TheoryBadge,TryInUniverse}.tsx` · 카드별 수정 · `LandingPage.tsx`.
- 히어로 3D 엠블럼: 구현 plan 15 · `pages/landing/ui/star3d/ThemedStar.tsx`.
