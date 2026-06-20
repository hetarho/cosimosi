# 우주 셸 + 오버레이 네비게이션 (overlay-shell)

> cosimosi의 **리스트/탐색 화면을 어떻게 띄우나**의 단일 출처(SSOT)다 — 별도 라우트가 아니라 영속 우주 캔버스 위의 비차단 오버레이(모바일=바텀시트 / 데스크톱=떠있는 카드)다. 진입은 우상단 컨트롤 스택(햄버거 사이드바·카메라 토글·망원경)이 맡고, 망원경이 여는 **우주 탐색기 시트**(일기·별 탭)가 잠든 별 탐색([plan/12](../plan/12.decay-dormant.md))·원본 일기 목록([plan/28](../plan/28.diary-wayfinding.md))을 한 표면으로 흡수했다. 변천사([plan/24](../plan/24.evolution-history-ui.md))는 같은 z-30 오버레이 레이어를 공유한다. 설계 배경은 [concept.md](../concept.md) §우주 탐험.

## 목적

리스트/탐색을 별도 라우트로 두면(`/dormant`) 진입 시 `/universe`의 WebGPU 우주 캔버스가 통째로 언마운트되고 "우주를 떠나는" 단절감과 재초기화 비용이 생긴다. concept §우주 탐험의 *"전환은 별개 화면이 아니라 같은 우주의 다른 시점"* 원칙을 리스트/탐색까지 확장한다: 우주 캔버스를 `/universe`에 한 번 마운트되는 영속 셸로 두고, 목록은 그 위에 비차단 오버레이(모바일=바텀시트 / 데스크톱=떠있는 카드)로 떠오르며, 항목을 고르면 시트가 핸들(peek)만 남기고 잦아들고 뒤 우주에서 카메라가 그 별로 fly-to한다. 탐색은 라우트가 아니라 셸 패널 상태이며 `?panel=`로만 딥링크/뒤로가기를 동기화한다.

## 현재 구현

### 오버레이 프리미티브 (`shared/ui`, 캔버스 밖 DOM)

플랫폼 분기는 ui 레이어가 맡는다(헌법4). 3D 씬 안 `<Html>`을 만들지 않는다(헌법8).

두 호스트가 한 비차단 idiom(coarse=바텀시트 / fine=떠있는 카드)을 공유한다 — `Surface`는 **결과/액션·탐색 표면**(peek 없음), `OverlayHost`는 옛 브라우즈 리스트(peek) 호스트로 이제 레거시(제품 진입점 없음)다. 진입은 우상단 컨트롤 스택(햄버거→`SideDrawer`, 카메라 토글, 망원경→탐색기 `Surface`)·상단 중앙 UI 숨기기 토글·하단 중앙 `새 별 띄우기` 버튼으로 분산되고, 탐색·결과·액션 표면은 모두 `Surface`다.

- `OverlayHost`(`shared/ui/OverlayHost.tsx`) — **레거시.** 옛 브라우즈 리스트(일기·잠든 별) peek 호스트. 탐색이 망원경 탐색기 `Surface`(아래)로 옮겨가며 제품 진입점이 사라졌고, 프리미티브 자체는 남아 있다. coarse pointer면 `BottomSheet`, fine이면 `FloatingCard`(place=top)를 렌더한다(`useCoarsePointer` 분기). peek 의미를 가진다 — 항목을 고르면 핸들/카드로 잦아들고 뒤 우주가 그 별로 fly-to한다.
  - props: `open`, `peek`, `title`(다이얼로그 접근명), `peekLabel`(핸들 라벨), `onClose`, `onExpand`(peek→펼침), `peekSlot?`(기본 핸들 pill 대체), `children`(콘텐츠).
  - 펼친 상태: `Backdrop`(z-20, 배경 탭=닫기)을 깐 위에 시트/카드. 목록 탐색 중엔 우주가 포커스가 아니므로 backdrop이 바깥 탭을 받아 닫는다.
  - peek 상태: `peekSlot`이 있으면 그것을, 없으면 좌하단 핸들 pill(z-30, "펼치기" + "✕")을 그린다. 이때는 차단 backdrop을 두지 않는다 — 뒤 별 탭(회상)을 막지 않기 위해(배경 딤은 페이지의 포커스 딤이 맡음).
  - Esc로 닫힌다. 포커스 트랩은 두지 않는다 — 캔버스 뒤가 계속 도달 가능해야 하므로(비차단 원칙).
- `Surface`(`shared/ui/Surface.tsx`) — 결과/액션 표면의 단일 비차단 호스트(회상·변천사·우주 공개·주고받은 별·별 보내기·작성). coarse면 `BottomSheet`, fine이면 `FloatingCard`(`useCoarsePointer` 분기). peek 없음, **차단 backdrop 없음** — 열려 있어도 뒤 우주가 보이고 별 탭/회전이 가능하다. `fixed inset-0` 차단 모달을 이 한 문법으로 흡수했다(공유/선물/보내기 모달 폐지). Esc·빈 곳 탭 닫기는 페이지(focusActor/페이지 상태)가 단일 라우팅한다(여기선 Esc 안 잡음).
  - props: `open`, `title`, `onClose`, `width?`(`sm`/`md`/`lg`), `place?`(`top`/`center`), `children`. coarse는 항상 풀폭 시트라 width/place는 fine에서만 쓴다.
- `BottomSheet`(`shared/ui/BottomSheet.tsx`) — coarse pointer 오버레이(OverlayHost·Surface 공용). `role="dialog" aria-modal="false"`. 스냅은 `half`(maxHeight 56dvh)·`full`(88dvh) 두 단계(peek는 한 단계 위 `OverlayHost`가 소유). 본문은 `overflow-y-auto`라 긴 결과(회상 등)가 시트 안에서 스크롤된다. 드래그는 그랩 핸들에서만 시작한다(`useDragControls` + `dragListener={false}`). 핸들 탭은 half↔full 토글, 아래로 충분히 끌면 full→half·half면 닫기(offset>120 또는 velocity>800), 위로 끌면 full. `prefers-reduced-motion`이면 슬라이드 스프링과 max-height transition을 즉시로 떨군다.
- `FloatingCard`(`shared/ui/FloatingCard.tsx`) — fine pointer 오버레이(OverlayHost·Surface 공용; 구 `SidePanel` 대체). `role="dialog" aria-modal="false"`. **코너 비의존 떠있는 카드** — `place=top`(상단 중앙) 또는 `center`(정중앙). −50% 중앙 이동은 motion transform(x/y)으로 줘 pop 스케일과 충돌하지 않게 한다(Tailwind `-translate-*`가 motion transform을 덮는 함정 회피). `width` sm(22rem)/md(24rem)/lg(40rem), max-w 92vw, max-h calc(100dvh-2rem)+스크롤. reduced-motion이면 즉시.
- `SideDrawer`(`shared/ui/SideDrawer.tsx`) — 우측에서 슬라이드인하는 **차단형 드로어**. 햄버거(Menu 아이콘)가 연다. 은은한 딤 backdrop(탭=닫기), Esc·✕로 닫힘, 열릴 때 첫 포커스 진입(focus-in), `prefers-reduced-motion`이면 슬라이드 즉시. 사이드바 항목은 절제된 텍스트 행이며 페이지가 콘텐츠를 합성한다. 탐색기·결과 `Surface`와 달리 이쪽은 차단형(메뉴 동선이라 뒤 우주 상호작용을 의도적으로 막는다).
  - props: `open`, `title`(다이얼로그 접근명), `onClose`, `children`.
- 진입 셸은 별도 프리미티브가 아니다 — 페이지가 우상단에 **세로 컨트롤 스택**을 둔다: ① 햄버거(Menu) → `SideDrawer`, ② 카메라 시점 토글(Orbit 아이콘, `TOGGLE_MODE`), ③ 망원경(Telescope) → 탐색기 `Surface`. 작성·소셜·테마는 더 이상 메뉴 목록이 아니라 각자의 진입점(하단 중앙 `새 별 띄우기`·사이드바·좌상단 테마 pill)으로 흩어졌다. (옛 "메뉴" 런처 `Surface`와 그 기능 목록은 폐기.)
- `Backdrop`(`shared/ui/Backdrop.tsx`) — 은은한 딤 레이어(`bg-black/30`). `onDismiss`가 있으면 탭을 받아 닫고(리스트 오버레이 뒤, 페이지가 z-20으로 사용), 없으면 `pointer-events-none` 시각 전용 딤(별 회상·일기 조망의 포커스 딤, 페이지가 z-10으로 사용 — 빈 곳 탭은 캔버스 `onPointerMissed`가 받음).
- `useCoarsePointer`(`shared/ui/use-coarse-pointer.ts`) — `(pointer: coarse)` 매치. 초기값을 `matchMedia`로 시드한다(false 시작이면 모바일 딥링크가 데스크톱 카드를 그렸다 바텀시트로 깜빡임). SSR/matchMedia 부재는 false(데스크톱 가정).
- 차단 모달 프리미티브는 `shared/ui`에 없다. 결과/액션은 전부 비차단 `Surface`로 띄운다(메인에 `fixed inset-0 bg-black/*` 차단 모달 없음). 차단형 확인이 꼭 필요한 곳은 각 feature가 자체 구현한다.

### 셸 패널 스토어 (`features/universe/model`) — 보존·미사용

- `useShellStore`(`features/universe/model/shell-store.ts`) — 옛 리스트/탐색 오버레이 레지스트리(panel + peek). 탐색이 망원경 탐색기 `Surface`로 옮겨가며 `HomePage`는 더 이상 이 스토어를 구독하지 않는다 — 모듈은 남아 있으나 미사용이다. 순수 zustand(three/React/DOM 미의존, 헌법4).
  - `panel: 'dormant' | 'diary' | 'evolution' | null` · `peek: boolean` · `openPanel`/`closePanel`/`setPeek`.
- 변천사 오버레이는 여전히 `features/evolution`의 자체 스토어(`useEvolutionStore`)가 구동한다(별 id로 회상 패널에서 열려 URL 딥링크 불가) — 같은 z-30 오버레이 레이어만 공유한다.

### 우주 셸 (페이지) — `pages/home/ui/HomePage.tsx`

루트 `/`가 영속 우주 셸이다. 한 페이지가 `UniverseCanvas`(한 번 마운트, 절대 언마운트 안 됨) + 우상단 컨트롤 스택 + 상단 중앙 UI 숨기기 토글 + 하단 중앙 `새 별 띄우기` + 좌상단 테마 pill + 결과·탐색 표면(`Surface`들) + 사이드바(`SideDrawer`)를 함께 든다. 어떤 진입/결과 전환에도 캔버스는 재init되지 않는다(HUD는 캔버스 밖 DOM이라 UI 숨기기도 캔버스를 언마운트하지 않는다).

**IA 큰 틀(universe-mode UX rework, change 09).** 화면을 비워 우주에 집중시킨다 — 진입을 가장자리로 분산한다:

- **우상단 세로 컨트롤 스택.** 위에서부터 ① 햄버거(Menu) → `SideDrawer`, ② 카메라 시점 토글(Orbit 아이콘, 성운↔회상 `TOGGLE_MODE`), ③ 망원경(Telescope) → 우주 탐색기 `Surface`.
- **사이드바(`SideDrawer`).** 우측 차단형 드로어. 항목 순서: 로그아웃(데모면 "체험 종료") · 마이페이지 · 구분선 · 우주 공개 · 주고받은 별 · 구분선 · 일기. 데모에선 마이페이지·우주 공개·주고받은 별이 숨고 작성 항목은 없다. 로그아웃 동선이 여기로 수렴한다(`SessionGate`의 우상단 로그아웃 pin은 우주 셸에서 억제).
- **우주 탐색기(`UniverseExplorerSheet`, `pages/home/ui`).** 망원경이 여는 비차단 `Surface`. 탭 둘: **일기**(`DiarySheet` — 검색·감정 facet·날짜 범위 필터) · **별**(`StarExplorerList` — AWAKE+DORMANT 별을 `lastRecalledAt` 오름차순 한 목록으로, 검색·감정·날짜·잠듦(전체/깨어있는/잠든 별) 필터 + "N일 전 회상"). 옛 잠든 별 전용 진입점은 사라지고 별 탭에 흡수됐다.
- **결과 — 통일 비차단 `Surface`.** 회상·변천사·우주 공개·주고받은 별·별 보내기·작성·테마가 전부 한 idiom(모바일 바텀시트 / 데스크톱 떠있는 카드)으로 열린다. 코너에 고정되지 않고, 열려 있어도 뒤 우주가 보이고 별 탭/회전이 된다(차단 모달 없음).
- **상단 중앙 UI 숨기기 토글(Eye/EyeOff).** "UI 숨기기"는 모든 표면을 닫고 포커스·변천사를 해제한 뒤, 토글 자신을 뺀 모든 HUD를 숨긴다(WebGPU 캔버스는 그대로 — HUD는 캔버스 밖 DOM). "UI 보이기"로 기본 HUD를 복구한다.
- **하단 중앙 `새 별 띄우기`(Plus).** 실계정은 작성 `MemoryForm` `Surface`를 열고, 데모 자유모드는 랜덤 별을 즉시 만든다(`demoAddRandomStars` — 표면 없음, plan 47).
- **좌상단 테마 pill.** 위치 불변. 꾸미기 표면(`AppearancePanel`, change 10)을 연다 — **전면 모달/비차단 `Surface`가 아니라 캔버스 sibling split panel**이다. 우주를 덮지 않고 레이아웃을 밀어내, `UniverseCanvas`는 언마운트되지 않고 컨테이너 폭/높이만 줄어든다(데스크톱 fine pointer=좌측 사이드바 + 우측 캔버스, 모바일 coarse=상단 캔버스 + 하단 패널). 스킨 4축만 다루고(감정 색은 `/my-page`), `ViewOffsetController`/`sheetOpen`을 쓰지 않는다 — 우주 이동은 projection offset이 아니라 캔버스 컨테이너 resize(기존 `ResizeObserver`)로만 일어난다. 패널이 열리면 페이지는 상단 토글·우상단 컨트롤·테마 pill 등 HUD를 숨긴다.
- **데모 자유모드 컨트롤(`DemoFreeModeControls`, `pages/home/ui`).** 데모에서만, 좌상단 테마 pill 아래 아이콘 버튼 두 개(페르소나·시간)가 각각 버튼 옆에 뜨는 작은 transient 팝오버(`PopoverButton`)를 연다 — 바텀시트가 아니다. 한 번에 하나만 열리고 사이드바·탐색기 등 다른 표면이 열리면 페이지가 닫는다(`closeSurfaces`). 진입 흐름(plan 47)이 `free`가 아니면 페이지가 `DemoOnboarding` 풀스크린 선택 오버레이(z-40)를 HUD 위에 띄우고 그동안 HUD 컨트롤은 마운트하지 않는다.
- **데모 튜토리얼 투어(`DemoGuidedTour`, `widgets/demo-tour`, plan 48).** 진입 흐름이 `tutorial`일 때만, 자유모드 HUD 위에 z-50 overlay를 얹는다 — 현재 target만 남기고 나머지를 어둡게 덮는 **딤(box-shadow spread, 둥근 구멍) + 투명 클릭 차단 패널 4개** + 구멍 둘레의 **빛나는 glow 테두리**(target rect를 `use-tour-target`가 rAF로 추적)와 coach card. 하이라이트된 버튼만 누를 수 있고 coach card만 입력을 받는다. **행동 안내형**: 단계는 phase로 나뉘어 UI 숨김 토글·팝오버 열림·페르소나 전환·시간 이동·사이드바/망원경 열림을 관찰해 진행하고(버튼을 누르면 하이라이트가 팝오버·시트·✕로 옮겨가거나 결과 안내를 띄움), `다음`으로 건너뛸 수 있다. 별 탭 단계만 페이지가 탐색 시트를 자동으로 연다. 단계 전환 시 페이지가 표면을 정리하고 UI 숨김도 복구한다. 투어 중에는 모달 백드롭의 바깥-탭-닫기를 끈다. 캔버스 안 별·시작/끝 단계는 DOM rect가 없어 딤이 클릭을 막지 않고 중앙 안내 카드만 띄운다(3D 씬 안 `<Html>` 없음 — 헌법8).
- **이동 `NavPad`.** 회상 모드 전용 비행 D-pad(상시 버튼이 아니라 모드별 컨트롤) — 화면 가장자리.

페이지 핸들:

- 표면·사이드바·탐색기는 페이지 로컬 상태가 단일 출처다(셸 스토어 미사용). `openCompose()`/`openShare()`/`openGifts()`/`openAppearance()`/탐색기 열기 등은 `prepareOpen()`(다른 표면·포커스 정리)로 **한 번에 하나의 표면**만 남기고 연다(모바일 바텀시트 중첩 방지). 변천사·별 보내기는 회상에서 파생되어 회상 위에 의도적으로 겹치므로 정리 대상이 아니다.
- 탐색기 일기 선택 → `focusActor.SELECT_DIARY`(frame-all) + 탐색기 닫기. 포커스 구동 `DiaryCard`(z-30 하단)가 뜨고, 그 "목록"이 탐색기를 일기 탭으로 다시 연다.
- 탐색기 별 선택 → `navigationActor.FLY_TO_STAR`. fly-to 도착 시 `FlyToController`가 `focusActor.SELECT_STAR`로 회상을 연다.
- 결과 표면 렌더(전부 `Surface`): 작성(`composeOpen`, 제목은 단계 반영, place top)·회상(`isStarFocus`, place top)·변천사(`evolutionOpen`, place center·width lg)·공유(`shareOpen`, center·sm)·선물(`giftsOpen`, center·sm)·보내기(`sendMemoryId`, center·sm)·탐색기(`explorerOpen`). 각 `open` 게이트와 콘텐츠의 자체 null-가드는 같은 store/actor를 읽어 빈 chrome이 뜨지 않는다.
- `NavPad`는 `suppressed` prop으로 숨긴다 — 사이드바·탐색기·임의 표면이 열렸거나 UI가 숨겨졌으면(`uiHidden`) true(옛 `panel != null` 기반 대체). 숨기는 순간 이동을 0으로 정지시킨다(pointerup 유실로 우주가 계속 전진/회전하는 것 방지).
- view-offset(`ViewOffsetController`)은 **꾸미기 패널에는 쓰이지 않는다**(change 10 — 꾸미기는 캔버스 컨테이너 resize로만 이동). 여전히 유지되는 사용처는 ① 작성 표면(`setSheetOpen(composeOpen)` — 모바일에서 작성 시트가 하단을 가릴 때 우주를 위로), ② 회상 포커스(컨트롤러가 `focusActor` 선택 별을 직접 구독), ③ 일기 조망 카드(`diaryFramed` — 모바일·데스크톱 공통 시선↑)다. 이 세 표면이 남아 있어 `ViewOffsetController`·`sheetOpen`은 제거하지 않는다.
- **레거시 딥링크.** `?panel=dormant|diary`는 일회성 소비다 — 진입 시 탐색기를 한 번 열고(dormant→별 탭, 그 외→일기 탭) param을 비운다(`replace`). 뒤로가기 동기화는 더 이상 하지 않는다.
- Esc 단일 라우팅: 사이드바·탐색기는 각 호스트가 닫고, 그 외엔 위에 뜬 표면을 위에서부터 닫은 뒤(보내기→변천사→테마→공유→선물→작성) 마지막으로 `focusActor.DISMISS`(포커스 복귀). 페이지 상태 표면은 effect deps, 변천사는 `getState()`로 읽어 최신.

### 우주 탐색기 시트 — 일기 · 별 탭 (콘텐츠 전용)

탐색기 `Surface`는 두 탭 콘텐츠를 합성한다. 각 시트/리스트는 호스트의 컨테이너/헤더만 가정하고 본문을 제공한다. feature는 widget/page를 import하지 않고, 페이지가 합성한다(FSD).

- `DiarySheet`(`features/diary-list/ui/DiarySheet.tsx`, 28) — 일기 탭. 검색·감정 facet·날짜 범위 필터 + 목록. `recordsQueryOptions`(`entities/memory` 소유 — DiarySheet 읽기 + record-memory 무효화 두 레이어 소비)로 조회. 항목은 `entryDate`·별 개수·본문 발췌(`bodyExcerpt`, `ph-no-capture`로 PostHog autocapture 차단). 클릭 → `onSelectDiary(recordId)`. 읽기 전용 — 원본 전문은 회상(11)에서 열린다(헌법1).
- `StarExplorerList`(`features/star-explorer`) — 별 탭. AWAKE+DORMANT 별을 `lastRecalledAt` 오름차순 한 목록으로 보여준다 + 검색·감정·날짜·잠듦(전체/깨어있는/잠든 별) 필터 + "N일 전 회상" 라벨. 별 밝기 dot은 클라 `starBrightness`(08, A_MIN 바닥), `daysAgo`는 가상 시계(`virtualNowMs`, 19) 기준. 항목 클릭 → `onSelect(memoryId)` → `FLY_TO_STAR`. 옛 잠든 별 전용 시트를 흡수했다.
- `DiaryCard`(`features/diary-list/ui/DiaryCard.tsx`) — 조망 중인 일기 카드(z-30 하단). 선택한 일기를 보여주고 "목록"(탐색기 일기 탭 재열기)·✕(닫기) 제공.
- `DormantSheet`(`features/dormant-search/ui/DormantSheet.tsx`) — **레거시(고아).** 별 탭이 잠든 별 탐색을 흡수하며 제품 진입점이 없어졌다. `dormantStarsQueryOptions`/`DormantStar`는 별 탐색기가 계속 쓴다.

### 변천사 (24) — 같은 레이어, 별도 스토어

- `EvolutionPanel`(`features/evolution/ui/EvolutionPanel.tsx`)은 body-only 콘텐츠로, 페이지가 통일 `Surface`(place center·width lg, 제목 "별 변천사 — 변한 것과 변하지 않은 것", `onClose`=store close) 안에 합성한다. 회상의 "변천사 보기"가 `useEvolutionStore.getState().open(id)`로 연다. 회상 표면 위에 의도적으로 겹친다.
- 변천사는 `useShellStore`의 `panel` 흐름이 아니라 `useEvolutionStore`(`openFor: string | null`)가 구동한다(별 id가 필요해 URL 딥링크 불가). 셸 스토어의 `Panel` 타입은 `'evolution'`을 레지스트리로 예약만 한다 — 변천사는 항목 id 키잉이라 셸의 URL 패널 모델에 맞지 않는다.

### 라우트 — `app/router.tsx`

- `/`(index): 보호 라우트(`SessionGate`, 우주 셸에서 `showChrome=false`로 우상단 로그아웃 pin 억제 — `/`·`/diary`·`/my-page`), `validateSearch`가 `panel`을 `'dormant' | 'diary'`로만 좁힌다(알 수 없는 값 무시). 같은 라우트가 `sim`(19)·`fly`(36) search param도 검증한다.
- 별도 `/dormant`·`/diary`·`/evolution` 라우트는 없다. 옛 `/dormant`·`/universe` 라우트는 제거됐다(change 01). `?panel=`은 레거시 일회성 딥링크로만 남아 진입 시 탐색기를 한 번 연다(아래 페이지 핸들).

### z-index 레이어 (셸 통일)

- z-10: 포커스 딤 `Backdrop`(pointer-events-none)·우주 로딩/빈 우주/에러 카드.
- z-20: `NavPad`.
- z-30: 결과·탐색 표면(`Surface` 시트/카드)·`DiaryCard`·우상단 컨트롤 스택(햄버거·카메라 토글·망원경)·상단 중앙 UI 토글·하단 중앙 `새 별 띄우기`·좌상단 테마 pill·(레거시 `OverlayHost` 시트/카드·peek 핸들).
- z-40: 사이드바 `SideDrawer`(차단형 딤 backdrop + 우측 드로어 — 메뉴 동선이라 뒤 우주를 의도적으로 막는다)·데모 온보딩 `DemoOnboarding`(자유모드 전 풀스크린 선택 오버레이 — 캔버스만 뒤에 두고 HUD는 미마운트).
- 데모 자유모드 컨트롤(`DemoFreeModeControls`)은 좌상단 HUD 레이어(버튼 z-20·팝오버 z-30)에 얹힌다.
- z-50: 데모 튜토리얼 투어(`DemoGuidedTour`) — 딤 + 구멍 + target glow 테두리 + coach card. 자유모드 HUD·표면 위에 떠 단계를 안내한다(딤 패널이 바깥 클릭을 막고 하이라이트된 버튼·coach card만 입력).
- z-50: 전역 chrome(랜딩 외형 스위처 FAB). 결과/액션 차단 모달 없음(모두 비차단 `Surface`); 사이드바만 차단형이다.

## Public Interfaces

- `frontend/src/shared/ui/index.ts`
  - `Surface`, `SurfaceProps`
  - `SideDrawer`, `SideDrawerProps`
  - `BottomSheet`, `BottomSheetProps`
  - `FloatingCard`, `FloatingCardProps`
  - `Backdrop`, `BackdropProps`
  - `useCoarsePointer`
  - `OverlayHost`, `OverlayHostProps` (레거시 — 제품 진입점 없음)
- `frontend/src/shared/ui/Surface.tsx`
  - `Surface({ open, title, onClose, width?, place?, children })` — 비차단 결과/탐색 호스트(coarse=BottomSheet / fine=FloatingCard)
- `frontend/src/shared/ui/SideDrawer.tsx`
  - `SideDrawer({ open, title, onClose, children })` — 우측 차단형 드로어(딤 backdrop·Esc·✕·focus-in·reduced-motion)
- `frontend/src/shared/ui/BottomSheet.tsx`
  - `BottomSheet({ title, onClose, children })` — 스냅 `half`/`full`, 본문 overflow 스크롤
- `frontend/src/shared/ui/FloatingCard.tsx`
  - `FloatingCard({ title, onClose, width?, place?, children })` — 코너 비의존 떠있는 카드(구 SidePanel 대체)
- `frontend/src/shared/ui/OverlayHost.tsx` (레거시)
  - `OverlayHost({ open, peek, title, peekLabel, onClose, onExpand, peekSlot?, children })` — coarse=BottomSheet / fine=FloatingCard
- `frontend/src/features/switch-appearance/index.ts`
  - `AppearanceControls`(홈은 `pages/home/ui/AppearancePanel`이 `draft` 모드로 호스팅 — 스킨 4축 split panel, change 10; 감정 색은 `/my-page`) · `AppearanceSwitcher`(랜딩/사인인/초대 FAB — `playground` 모드)
- `frontend/src/shared/ui/Backdrop.tsx`
  - `Backdrop({ onDismiss?, className? })`
- `frontend/src/shared/ui/use-coarse-pointer.ts`
  - `useCoarsePointer(): boolean`
- `frontend/src/features/universe/index.ts` / `model/shell-store.ts` (보존·미사용)
  - `useShellStore` — `{ panel, peek, openPanel, closePanel, setPeek }`
  - `type Panel = 'dormant' | 'diary' | 'evolution' | null`
- `frontend/src/features/star-explorer`
  - `StarExplorerList` (`onSelect(memoryId)`) — AWAKE+DORMANT 통합 목록·필터
- `frontend/src/features/dormant-search/index.ts`
  - `dormantStarsQueryOptions`, `type DormantStar` (별 탐색기가 소비)
  - `DormantSheet`, `DormantSheetProps` (레거시 — 진입점 없음)
- `frontend/src/features/diary-list/index.ts`
  - `DiarySheet`, `DiarySheetProps` (`onSelectDiary(recordId)` — 검색·감정·날짜 범위 필터)
  - `DiaryCard`, `DiaryCardProps`
- `frontend/src/pages/home/ui`
  - `UniverseExplorerSheet` — 망원경이 여는 탐색기 Surface(일기·별 탭)
- `frontend/src/app/router.tsx`
  - `/`(index) search 스키마: `{ sim?, panel?: 'dormant' | 'diary', fly? }`(`panel`은 레거시 일회성 딥링크)

## Flutter 동등성 기준

본 스펙은 순수 웹 셸이다(영속 WebGPU 캔버스 + DOM 오버레이 호스트·URL search param 동기화·motion/react·CSS z-레이어). BE 계약이나 공유 도메인 모델은 없다 — 별/일기 데이터는 12(`ListDormant`)·28(`ListRecords`)·11(`RecallMemory`)이 소유한다. Flutter가 포팅한다면:

- 우주 캔버스를 영속 셸로 두고, 리스트/탐색을 별도 화면이 아니라 그 위 비차단 오버레이(모바일=바텀시트 / 데스크톱=떠있는 카드)로 띄운다 — 진입은 우상단 컨트롤 스택(햄버거 사이드바·카메라 토글·망원경 탐색기)으로 모은다.
- 탐색기 별 항목 선택 시 뒤 우주가 그 별로 fly-to하고, 일기 항목 선택 시 탐색기를 닫고 그 일기 별들을 frame-all + 하단 카드를 띄운다(우주를 떠나지 않음).
- 어떤 표면이 열려 있는지는 페이지 로컬 상태가 단일 출처다(웹은 셸 스토어를 쓰지 않는다). UI 숨기기 토글은 HUD만 가리고 캔버스는 유지한다.
- 변천사처럼 항목 id가 필요한 오버레이는 같은 레이어를 쓰되 URL 딥링크 대상에서 제외한다.

## 수용 기준

1. 망원경 탐색기(일기·별 탭)를 열면 우주 캔버스가 언마운트되지 않고 그 위에 비차단 `Surface`로 뜬다.
2. coarse pointer면 바텀시트, fine pointer면 코너 비의존 떠있는 카드를 쓴다(분기는 ui 레이어). 진입은 우상단 컨트롤 스택(햄버거→사이드바·카메라 토글·망원경→탐색기)·상단 중앙 UI 토글·하단 중앙 새 별 띄우기로 분산된다.
3. 탐색기·결과 표면이 열려 있어도 뒤 우주가 보이고 별 탭·회전 등 상호작용이 가능하다(차단 backdrop 없음); 사이드바만 차단형이다.
4. 별 탭 항목을 고르면 뒤 우주에서 카메라가 그 별로 fly-to하고, 일기 탭 항목을 고르면 탐색기가 닫히며 그 일기 별들을 frame-all + 하단 `DiaryCard`가 뜬다.
5. 탐색을 여러 번 열고 닫아도, UI 숨기기를 토글해도 WebGPU 캔버스가 재초기화되지 않는다(영속 셸, 한 번만 마운트).
6. 별 탭은 AWAKE+DORMANT 별을 `lastRecalledAt` 오름차순 한 목록으로 보여주고 검색·감정·날짜·잠듦 필터를 제공한다(잠든 별 전용 진입점 없음).
7. 옛 `/dormant`·`/universe` 경로로 진입하면 NotFound(404)다(change 01 — redirect 제거).
8. `?panel=dormant|diary` 레거시 딥링크는 진입 시 탐색기를 한 번 열고(dormant→별 탭) param을 비운다; 알 수 없는 값은 무시된다.
9. `prefers-reduced-motion`이면 시트·드로어 슬라이드/스프링과 max-height 전환이 즉시로 떨어진다.
10. Esc로 사이드바·탐색기·표면이 닫히고, 그 외엔 Esc가 포커스(별 회상·일기 조망)를 해제한다.
11. 24(변천사)·28(일기 목록/카드)은 별도 풀페이지 라우트가 아니라 이 셸의 같은 z-30 오버레이 레이어를 따른다.
12. UI 숨기기는 모든 표면·포커스·변천사를 닫고 토글 자신을 뺀 HUD를 숨기되 캔버스는 언마운트하지 않는다.
13. `shared/ui` 오버레이 프리미티브는 3D 씬 안 `<Html>`을 만들지 않는다(헌법8 — steiger·lint·build 통과).
