# 랜딩 (policy/ux/landing)

> 현재 구현된 랜딩 페이지(`/landing`)의 사실 정의 — 테마·시각화·진입의 규칙·정전 파라미터·불변식.

## 정의

랜딩(`/landing`)은 cosimosi가 무엇을 지향하는지 보여주는 비전 showcase다. 인터랙션 모델은 **상단 고정 "무대(stage)" 1개 + 그 아래로 흐르는 스크롤 콘텐츠**다(change 31). 방문자는 Lenis 관성 스크롤을 따라 히어로 → 장(章)을 내려가고, 각 장은 카피와 트리거(버튼/일기 UI)만 담는다. 트리거가 일으킨 변화는 화면 상단의 투명 무대에서 **진짜 3D 별 오브제**(배경 `CosmosScene`의 `StarMesh`/`SampleStrand` — 현재 룩, 예: 20면체)로 펼쳐진다 — 무대는 스크롤해도 사라지지 않으므로 결과가 늘 보인다(`LandingPage`가 무대 상태를 CosmosScene `stars`/`synapses`로 주입). 별 형태는 `useAppearance((s) => s.object)`(전역 별 형태)를 따르고 우주와 같은 시각 언어를 쓴다.

시각 설정은 두 독립 축이다 — **테마**(색·분위기, 3종)와 **오브제**(별 형태, 4종). 둘 다 플로팅 `AppearanceSwitcher`로 고르며 `localStorage`에 지속된다. 장이 시연하는 일부 메커니즘의 백엔드 동작은 plan 20–30에서 다룬다 — 장의 🚧/✅ 배지가 무엇이 이미 동작하는지 표기한다. 랜딩은 그 비전을 SVG로 보여줄 뿐, 장이 곧 그 기능의 정책은 아니다.

## 규칙 · 파라미터

### 테마 · 오브제 (두 축, `entities/appearance`)

| 축 | 값 | 기본 | 역할 |
|---|---|---|---|
| 테마(Theme) | `vast` · `lively` · `calm` | `vast` | 배경 atmosphere·글래스 크롬·accent 색·우주 배경색 |
| 오브제(StarObject) | `deepfield` · `aurora` · `liquid` · `ember` | `deepfield` | 별·시냅스의 형태(재질) |

- 테마를 바꾸면 배경(`CosmosScene` 팔레트, 43)·`.glass` 크롬·히어로 그라디언트·accent가 함께 전환된다.
- 오브제를 바꾸면 `VizStar`/`VizSynapse`가 그 형태로 다시 그려진다(`ember`=mood색 코어, `deepfield`=점선 별자리 선, 그 외=차가운 백색 코어).
- 두 선택 모두 `localStorage` 키 `cosimosi.appearance`에 지속 — 새로고침해도 마지막 테마·형태 유지. 손상값은 각 축 기본값으로 폴백.
- 스위처(`AppearanceSwitcher`)는 우하단 고정 FAB로 접혀 있다가 펼치면 테마(3칩)·오브제(4칩) 두 라디오그룹을 띄운다. 랜딩·우주 양쪽에서 공유한다.

### 무대 인터랙션 모델 (장별 트리거 → 상단 무대, change 31)

상단 고정 무대(`StageLayer`)는 zustand 상태(`pages/landing/model/stage.ts`)가 구동한다 — `activeAct`(현재 장)·`scene`({stars, synapses})·`bgMood`(전역 물듦)·`onStarClick`(망각 재점화). 각 장이 화면 중앙 띠를 지나면 무대가 그 장으로 전환되고(직전 장 잔상·물듦·핸들러는 비워진다), 콘텐츠 트리거가 그 장면을 갱신한다. 장 순서 = 전체 뇌과학 아크:

| 챕터 | 컴포넌트(id) | 콘텐츠 트리거 → 무대에서 일어나는 일 |
|---|---|---|
| I 엔그램 | `ConceptSection`(`concept`) | 스크롤 진입(+"다시 이어보기") → 무대에 별 1개 추가 + 곡선 시냅스로 연결 |
| II 부호화·사건 분할 | `FragmentationCard`(`diary`) | 일기(불변) + "별 나누기→별 띄우기" → 일내 결속된 N조각 별로 분할(21) |
| III 헵·시간 창 | `HebbianCard`(`hebbian`) | "함께 떠올리기" → 시냅스 +`CO_RECALL_DELTA`=0.05·상한 1.0·**단조** + "같은 날" 토글 시간 보너스(무대 로컬 시연 값) |
| IV 재공고화 | `ReconsolidationCard`(`reconsolidation`) | "다시 떠올리기" → 무대 별 밝기±·hue 드리프트(PE 게이트). 형태 변화는 change 29/job 45 seam. 원본 문장 불변 병치(54) |
| V 망각·침묵 엔그램 | `SilentEngramCard`(`forgetting`) | "시간 흐르기" → 무대 별 `A_MIN`=0.05 바닥까지 감쇠(`HALF_LIFE_DAYS`=30) / 어두운 별 클릭 → 재점화 |
| VI 요즘의 나 | `PresentSelfCard`(`present`) | 마음 선택 → **랜딩 전역 배경 물듦** + 새 별이 그 별무리로 끌려가 연결(22·25) |
| VII 야간 공고화 | `NightlyConsolidationCard`(`nightly`) | "밤 보내기" → 재활성화·재분배·요지·가지치기 단계(약한 선 밝기↓·삭제 없음, change 20·27) |
| VIII 공명 | `ResonanceSection`(`resonance`) | 토글 → 무대 두 별을 공명 곡선으로 연결(🚧 소셜) |

- **카드 안 자족 인터랙션은 없다**(change 31): 모든 트리거는 콘텐츠 영역 버튼/일기 UI이고, 시각 시연은 모두 상단 무대에서 일어난다.
- 내부 스펙 번호를 노출하던 상태 배지(구 `TheoryBadge`, "✅ 지금 우주에서 동작해요 · plan NN")는 **제거**했다 — 공개 랜딩에 plan 번호가 새어 나오면 안 된다. 무엇이 구현됐는지/계획인지는 카피와 (체험 가능한 장만 다는) 체험 버튼이 자연히 전한다.
- **"체험 우주에서 해보기"(`TryInUniverse`)** — 체험 가능한 장(Concept·Diary·Hebbian·Forgetting)은 `startDemoSession()` 후 `/?sim=<id>`로 체험 우주에 진입한다(자유모드 셸은 이론 모달을 자동으로 열지 않음 — 후속 튜토리얼 plan 소관). 레지스트리에 없는 id는 무시.
- 무대 별은 `useAppearance((s) => s.object)`로 같은 4 형태로 그려진다. 시연 수치는 정전 상수를 import해 표류를 막는다(`A_MIN`·`HALF_LIFE_DAYS` ← entities/memory, `CO_RECALL_DELTA` ← features/recall). 헵의 같은-날 시간 보너스는 FE 도메인 상수가 없어 무대 로컬 시연 값이다.

### 진입 (체험 우주)

- 히어로 1차 CTA("체험 우주 시작하기")·CtaFooter("체험 우주 시작하기")는 `startDemoSession()` 후 `/`로 이동 — 로그인/DB 없이 체험 우주를 본다.
- 장의 "체험 우주에서 해보기"는 같은 경로에 `?sim=<id>`를 더해 진입한다. 이미 체험 우주에 있던 탭에서는 진행 상태(가상 시계·추가 별)가 유지된다.
- 히어로 "천천히 둘러보기"·스크롤 힌트는 `useScrollToSection('concept')`로 `concept` 섹션에 안착(Lenis 우선, 없으면 네이티브 폴백).
- 히어로 엠블럼 별은 `CosmosScene` 안에서 스크롤 진행도로 떠오른다 — 중앙 큰 별에서 상단 무대로 떠올라 고정되고, 무대 별이 그 자리를 잇는다(히어로·무대 별 모두 진짜 3D `StarMesh`).

### 비주얼 · 모션 가드레일

- 배경 우주 + 무대 별·시냅스 모두 `CosmosScene`(R3F, 43 소유)이 그린다 — 무대는 2D 근사가 아니라 진짜 3D 별 오브제(`StarMesh`)다. 장 시연은 무대 상태를 CosmosScene `stars`/`synapses`로 주입해 펼친다.
- 무대 별은 화면 상단 띠에 떠 있고, 클릭 오버레이(`StageLayer`)가 클릭 가능한 별(망각 재점화) 위에만 투명 버튼을 겹쳐 깐다 — 그 외 클릭은 콘텐츠로 통과한다.
- 콘텐츠가 상단 무대 띠로 스크롤되어 들어가면 **위에서부터 조금씩 마스킹**돼 부드럽게 사라진다(`useScrollMask` — 투명 무대라 배경/그림자로 덮을 수 없어 콘텐츠 자체를 그라디언트로 가린다). 상단 무대만 늘 또렷하게 남는다.
- 무대 별은 메인 우주와 같은 진짜 별 셰이더(`buildStarBody`)에 자가발광 약하게·외부 광원 강하게(극적 명암). 히어로/seed 별은 연보라 계열, 장별 기억 별은 mood 의미색 유지(헌법 의미색 보존). (추후 랜딩 개정에서 우주 `StarField`+`SynapseFilaments` 풀 재사용·인터랙션 모델 재검토 예정.)
- glow/bloom이 잘리지 않게 박스를 넉넉히 잡는다.
- 시냅스는 항상 곡선이다(`synapseCurve` 2차 베지어, 직선 금지).
- 의미 색(hue)은 mood 팔레트(violet/teal/coral/pink/amber 등) 기준으로 테마·형태와 무관하게 보존된다.
- `prefers-reduced-motion: reduce`이면 무대 전환(히어로 엠블럼)·장 진입·물들임이 정적 프레임으로 안착한다([motion-accessibility](motion-accessibility.md)).

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
- "체험 우주에서 해보기"·정확성 정합(헵 단조·시간창 보너스·바닥 5%)·챕터 순서: 구현 plan 19 · `pages/landing/ui/section/TryInUniverse.tsx` · 카드별 수정 · `LandingPage.tsx`. (내부 plan 번호를 노출하던 상태 배지는 제거 — 공개 표면.)
- 히어로 3D 엠블럼: 구현 plan 15 · `pages/landing/ui/star3d/ThemedStar.tsx`.
