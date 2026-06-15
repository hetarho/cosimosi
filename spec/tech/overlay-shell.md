# 우주 셸 + 오버레이 네비게이션 (overlay-shell)

> cosimosi의 **리스트/탐색 화면을 어떻게 띄우나**의 단일 출처(SSOT)다 — 별도 라우트가 아니라 영속 우주 캔버스 위의 비차단 오버레이(모바일=바텀시트 / 데스크톱=사이드 패널)로, `?panel=`이 무엇이 열려 있는지의 단일 출처. 잠든 별 탐색([plan/12](../plan/12.decay-dormant.md))·원본 일기 목록([plan/28](../plan/28.diary-wayfinding.md))·변천사([plan/24](../plan/24.evolution-history-ui.md))가 이 셸 레이어를 공유한다. 설계 배경은 [concept.md](../concept.md) §우주 탐험.

## 목적

리스트/탐색을 별도 라우트로 두면(`/dormant`) 진입 시 `/universe`의 WebGPU 우주 캔버스가 통째로 언마운트되고 "우주를 떠나는" 단절감과 재초기화 비용이 생긴다. concept §우주 탐험의 *"전환은 별개 화면이 아니라 같은 우주의 다른 시점"* 원칙을 리스트/탐색까지 확장한다: 우주 캔버스를 `/universe`에 한 번 마운트되는 영속 셸로 두고, 목록은 그 위에 비차단 오버레이(모바일=바텀시트 / 데스크톱=사이드 패널)로 떠오르며, 항목을 고르면 시트가 핸들(peek)만 남기고 잦아들고 뒤 우주에서 카메라가 그 별로 fly-to한다. 탐색은 라우트가 아니라 셸 패널 상태이며 `?panel=`로만 딥링크/뒤로가기를 동기화한다.

## 현재 구현

### 오버레이 프리미티브 (`shared/ui`, 캔버스 밖 DOM)

플랫폼 분기는 ui 레이어가 맡는다(헌법4). 3D 씬 안 `<Html>`을 만들지 않는다(헌법8).

- `OverlayHost`(`shared/ui/OverlayHost.tsx`) — 리스트/탐색 오버레이의 단일 호스트. coarse pointer면 `BottomSheet`, fine이면 `SidePanel`을 렌더한다(`useCoarsePointer` 분기). 비차단: 열려 있어도 우주가 뒤에 보이고 별 탭/회전이 가능하다.
  - props: `open`, `peek`, `title`(다이얼로그 접근명), `peekLabel`(핸들 라벨), `onClose`, `onExpand`(peek→펼침), `peekSlot?`(기본 핸들 pill 대체), `children`(콘텐츠).
  - 펼친 상태: `Backdrop`(z-20, 배경 탭=닫기)을 깐 위에 시트/패널. 목록 탐색 중엔 우주가 포커스가 아니므로 backdrop이 바깥 탭을 받아 닫는다.
  - peek 상태: `peekSlot`이 있으면 그것을, 없으면 좌하단 핸들 pill(z-30, "펼치기" + "✕")을 그린다. 이때는 차단 backdrop을 두지 않는다 — 뒤 별 탭(회상)을 막지 않기 위해(배경 딤은 페이지의 포커스 딤이 맡음).
  - Esc로 닫힌다. 포커스 트랩은 두지 않는다 — 캔버스 뒤가 계속 도달 가능해야 하므로(비차단 원칙).
- `BottomSheet`(`shared/ui/BottomSheet.tsx`) — coarse pointer 오버레이. `role="dialog" aria-modal="false"`. 스냅은 `half`(maxHeight 56dvh)·`full`(88dvh) 두 단계다(peek는 한 단계 위 `OverlayHost`가 소유 — 이 컴포넌트는 펼친 시트만 그린다). 드래그는 그랩 핸들에서만 시작한다(`useDragControls` + `dragListener={false}`)— 본문 리스트의 세로 스와이프가 스크롤로 동작하고 시트가 끌려 닫히지 않게. 핸들 탭은 half↔full 토글, 아래로 충분히 끌면 full→half 한 단계·half면 닫기(offset>120 또는 velocity>800), 위로 끌면 full. `prefers-reduced-motion`이면 슬라이드 스프링과 max-height transition을 둘 다 즉시로 떨군다.
- `SidePanel`(`shared/ui/SidePanel.tsx`) — fine pointer 오버레이. `role="dialog" aria-modal="false"`. 좌상단 비차단 패널(w-80, max-h calc(100dvh-2rem)). 우측이 아니라 좌측인 이유: 우측 HUD 스택(카메라/외형 컨트롤 + 하단 우측 회상 패널)과 겹치지 않고 일기 패널의 데스크톱 배치(28)와 맞추기 위해. 왼쪽에서 슬라이드 인, reduced-motion이면 즉시.
- `Backdrop`(`shared/ui/Backdrop.tsx`) — 은은한 딤 레이어(`bg-black/30`). `onDismiss`가 있으면 탭을 받아 닫고(리스트 오버레이 뒤, 페이지가 z-20으로 사용), 없으면 `pointer-events-none` 시각 전용 딤(별 회상·일기 조망의 포커스 딤, 페이지가 z-10으로 사용 — 빈 곳 탭은 캔버스 `onPointerMissed`가 받음).
- `useCoarsePointer`(`shared/ui/use-coarse-pointer.tsx`) — `(pointer: coarse)` 매치. 초기값을 `matchMedia`로 시드한다(false 시작이면 모바일 딥링크가 데스크톱 패널을 그렸다 바텀시트로 깜빡임). SSR/matchMedia 부재는 false(데스크톱 가정).
- `Modal` 차단 프리미티브는 `shared/ui`에 없다. 차단형 확인 모달은 각 feature가 자체 구현한다(예: `features/send-star`의 `SendStarModal`이 `fixed inset-0 z-50 ... bg-black/60`).

### 셸 패널 스토어 (`features/universe/model`)

- `useShellStore`(`features/universe/model/shell-store.ts`) — 어떤 리스트/탐색 오버레이가 떠 있는지 + peek 여부의 단일 레지스트리. 순수 zustand(three/React/DOM 미의존, 헌법4).
  - `panel: 'dormant' | 'diary' | 'evolution' | null`.
  - `peek: boolean` — 항목 선택 후 핸들로 잦아든 상태(뒤 우주가 그 별로 fly-to). `setPeek(false)`면 목록이 돌아온다.
  - `openPanel(panel)`은 `peek`를 false로 리셋한다(새로 연 목록은 펼친 채 시작). `closePanel()`은 둘 다 리셋.
- `dormant`/`diary`만 `?panel=` 딥링크 대상이다. `evolution`은 레지스트리 값으로 예약돼 있을 뿐, 실제 변천사 오버레이는 별 id로 회상 패널에서 열려 URL 딥링크가 불가하므로 `features/evolution`의 자체 스토어(`useEvolutionStore`)가 구동한다 — 같은 z-30 오버레이 레이어만 공유한다.

### 우주 셸 (페이지) — `pages/home/ui/HomePage.tsx`

`/universe`가 영속 셸이다. 한 페이지가 `UniverseCanvas`(한 번 마운트, 절대 언마운트 안 됨) + HUD(작성 폼·NavPad·회상 패널·외형 스위처·일기/잠든 별 버튼·공유/선물) + 셸 오버레이 호스트를 함께 든다. 오버레이를 열고 닫아도 캔버스는 재init되지 않는다.

- URL이 딥링크 가능한 패널(`dormant`/`diary`)의 단일 출처다. 하나의 거울 이펙트만 `useSearch`의 `panel`을 셸 스토어에 반영한다(가드는 `useShellStore.getState().panel`로 현재값 비교 — 두 이펙트가 stale 스냅샷으로 레이스하지 않게, 그리고 항목 선택 시 `setPeek(true)` 보존). UI의 열기/닫기는 `navigate`만 한다.
- `showPanel(p)` — 열기. 직전 포커스 해제(`focusActor.DISMISS`) + `setPeek(false)` + `navigate({ search: { panel: p } })`(history push → 뒤로가기로 닫힘).
- `closeShellPanel()` — 닫기. `focusActor.DISMISS` + `navigate({ panel: undefined }, { replace: true })`(replace로 history를 더럽히지 않아 닫기 직후 뒤로가기가 패널을 되살리지 않음 → 거울 이펙트가 스토어를 닫음).
- `focusDormant(memoryId)` — 잠든 별 선택. `navigationActor.FLY_TO_STAR` + `setPeek(true)`. fly-to 도착 시 `FlyToController`가 `focusActor.SELECT_STAR`로 회상 패널을 연다.
- `frameDiary(recordId)` — 일기 선택. `focusActor.SELECT_DIARY` + `setPeek(true)`. 뒤 우주에서 그 일기 별들을 frame-all + 강조(28·39).
- 패널 렌더:
  - `panel === 'dormant'`: `OverlayHost`(peekLabel "🌙 잠든 별 목록 펼치기") > `DormantSheet onSelect={focusDormant}`. peek면 호스트가 핸들 pill로 줄어든다.
  - `panel === 'diary' && !peek`: `OverlayHost`(peekLabel "📖 일기 목록 펼치기") > `DiarySheet onSelectDiary={frameDiary}`. 일기를 고르면 `peek=true`가 되어 목록 호스트가 사라지고, 포커스 구동 `DiaryCard`(z-30 하단)가 그 자리를 대신한다(목록≠조망 — orthogonal — state-machines.md).
  - `highlightedRecordId && (panel !== 'diary' || peek)`: `DiaryCard` — 어느 경로(목록 선택·회상 패널의 "이 일기의 다른 별들")로든 포커스=일기면 하단에 뜬다. 목록이 펼쳐져 있을 땐 가드로 숨긴다(겹침 방지).
- `NavPad`는 셸 패널이 열리면(`panel != null`) 완전히 숨긴다(시트/패널에 묻히지 않게). 숨기는 순간 이동을 0으로 정지시킨다(pointerup이 영영 안 와 우주가 계속 전진/회전하는 것 방지).
- 모바일 작성 폼은 `panel == null`일 때만 렌더한다(같은 하단 모서리의 peek 손잡이와 충돌 방지). view-offset도 `composeOpen && panel == null`을 따른다(패널 연 채 우주가 위로 밀린 채 남지 않게).
- Esc 라우팅: 목록이 펼쳐져 있으면(`panel != null && !peek`) `OverlayHost`의 Esc가 목록 닫기를 맡으므로 페이지는 양보하고, 그 외엔 페이지가 `focusActor.DISMISS`(포커스 복귀)를 맡는다.

### 잠든 별 / 일기 목록 시트 (콘텐츠 전용)

각 시트는 호스트의 컨테이너/헤더/핸들/스냅을 가정하고 본문만 제공한다. feature는 widget/page를 import하지 않고, 페이지가 합성한다(FSD).

- `DormantSheet`(`features/dormant-search/ui/DormantSheet.tsx`, 12·셸 전환 31) — 안내문 + 감정 검색 입력 + 목록. `dormantStarsQueryOptions`(`ListDormant`, staleTime 5m, 회상 성공 시 무효화)로 조회하고 감정 라벨/mood/memoryId로 클라 필터. 별 밝기 dot은 클라 `starBrightness`(08, A_MIN 바닥). `daysAgo`는 가상 시계(`virtualNowMs`, 19) 기준. 첫 도착 시 `dormant_visit`(18) 1회. 항목 클릭 → `onSelect(memoryId)`. 데이터 출처만 데모/서버로 분기(queryFn 안), 셸은 동일.
- `DiarySheet`(`features/diary-list/ui/DiarySheet.tsx`, 28·셸 31) — 안내문 + 날짜/내용 검색 + 목록. `recordsQueryOptions`(`entities/memory` 소유 — DiarySheet 읽기 + record-memory 무효화 두 레이어 소비)로 조회. 항목은 `entryDate`·별 개수·본문 발췌(`bodyExcerpt`, `ph-no-capture`로 PostHog autocapture 차단). 클릭 → `onSelectDiary(recordId)`. 읽기 전용 — 원본 전문은 회상(11)에서 열린다(헌법1).
- `DiaryCard`(`features/diary-list/ui/DiaryCard.tsx`) — 조망 중인 일기 카드(z-30 하단). 목록 peek 상태를 대신해 선택한 일기를 보여주고 "목록"(펼치기)·✕(닫기) 제공.

### 변천사 (24) — 같은 레이어, 별도 스토어

- `EvolutionPanel`(`features/evolution/ui/EvolutionPanel.tsx`)은 페이지가 `pointer-events-none absolute inset-0 z-30` 래퍼 안에 합성한다 — 셸 오버레이와 같은 z-30 레이어. 회상 패널의 "변천사 보기"가 `useEvolutionStore.getState().open(id)`로 연다.
- 변천사는 `useShellStore`의 `panel` 흐름이 아니라 `useEvolutionStore`(`openFor: string | null`)가 구동한다(별 id가 필요해 URL 딥링크 불가). 셸 스토어의 `Panel` 타입은 `'evolution'`을 레지스트리로 예약만 한다. (24 시점 주석은 "31이 오면 shell-store로 합쳐진다"고 적혀 있으나 현재 코드는 별도 스토어로 유지 — 변천사는 항목 id 키잉이라 셸의 URL 패널 모델에 맞지 않음.)

### 라우트 — `app/router.tsx`

- `/universe`: 보호 라우트(`SessionGate`), `validateSearch`가 `panel`을 `'dormant' | 'diary'`로만 좁힌다(알 수 없는 값 무시). 같은 라우트가 `sim`(19)·`fly`(36) search param도 검증한다.
- `/dormant`: 별도 페이지가 아니라 `/universe?panel=dormant`로 영구 redirect(`beforeLoad`에서 `throw redirect`). 옛 링크/북마크 보존, 라우트 비증가. 인증 게이트는 목적지의 `SessionGate`가 건다.
- 별도 `/diary`·`/evolution` 라우트는 없다.

### z-index 레이어 (셸 통일)

- z-10: 포커스 딤 `Backdrop`(pointer-events-none)·우주 로딩/빈 우주/에러 카드.
- z-20: 펼친 오버레이 뒤 닫기용 `Backdrop`·작성 폼(데스크톱 패널)·`NavPad`.
- z-30: 셸 오버레이(`OverlayHost` 시트/패널·peek 핸들)·`DiaryCard`·`EvolutionPanel` 래퍼·우상단 컨트롤(일기/잠든 별/공유/선물/카메라).
- z-50: 전역 chrome(외형 스위처 FAB)·차단 모달(`SendStarModal`). (z-40 전용 차단 모달 프리미티브는 빌드돼 있지 않다.)

## Public Interfaces

- `frontend/src/shared/ui/index.ts`
  - `OverlayHost`, `OverlayHostProps`
  - `BottomSheet`, `BottomSheetProps`
  - `SidePanel`, `SidePanelProps`
  - `Backdrop`, `BackdropProps`
  - `useCoarsePointer`
- `frontend/src/shared/ui/OverlayHost.tsx`
  - `OverlayHost({ open, peek, title, peekLabel, onClose, onExpand, peekSlot?, children })`
- `frontend/src/shared/ui/BottomSheet.tsx`
  - `BottomSheet({ title, onClose, children })` — 스냅 `half`/`full`
- `frontend/src/shared/ui/SidePanel.tsx`
  - `SidePanel({ title, onClose, children })`
- `frontend/src/shared/ui/Backdrop.tsx`
  - `Backdrop({ onDismiss?, className? })`
- `frontend/src/shared/ui/use-coarse-pointer.tsx`
  - `useCoarsePointer(): boolean`
- `frontend/src/features/universe/index.ts` / `model/shell-store.ts`
  - `useShellStore` — `{ panel, peek, openPanel, closePanel, setPeek }`
  - `type Panel = 'dormant' | 'diary' | 'evolution' | null`
- `frontend/src/features/dormant-search/index.ts`
  - `DormantSheet`, `DormantSheetProps` (`onSelect(memoryId)`)
  - `dormantStarsQueryOptions`, `type DormantStar`
- `frontend/src/features/diary-list/index.ts`
  - `DiarySheet`, `DiarySheetProps` (`onSelectDiary(recordId)`)
  - `DiaryCard`, `DiaryCardProps`
- `frontend/src/app/router.tsx`
  - `/universe` search 스키마: `{ sim?, panel?: 'dormant' | 'diary', fly? }`
  - `/dormant` → `/universe?panel=dormant` redirect

## Flutter 동등성 기준

본 스펙은 순수 웹 셸이다(영속 WebGPU 캔버스 + DOM 오버레이 호스트·URL search param 동기화·motion/react·CSS z-레이어). BE 계약이나 공유 도메인 모델은 없다 — 별/일기 데이터는 12(`ListDormant`)·28(`ListRecords`)·11(`RecallMemory`)이 소유한다. Flutter가 포팅한다면:

- 우주 캔버스를 영속 셸로 두고, 리스트/탐색을 별도 화면이 아니라 그 위 비차단 오버레이(모바일=바텀시트 / 데스크톱=사이드 패널)로 띄운다.
- 항목 선택 시 오버레이를 핸들(peek)로 잦아들게 하고 뒤에서 카메라가 그 별로 fly-to한다(우주를 떠나지 않음).
- 어떤 오버레이가 열려 있는지를 단일 출처(웹은 `?panel=`)로 두고 딥링크/뒤로가기를 동기화한다.
- 변천사처럼 항목 id가 필요한 오버레이는 같은 레이어를 쓰되 URL 딥링크 대상에서 제외한다.

## 수용 기준

1. 잠든 별/일기 목록 탐색을 열면 우주 캔버스가 언마운트되지 않고 그 위에 비차단 오버레이로 목록이 뜬다.
2. coarse pointer면 바텀시트, fine pointer면 좌측 사이드 패널을 쓴다(분기는 ui 레이어).
3. 오버레이가 열려 있어도(peek 또는 펼침) 뒤 우주가 보이고 별 탭·회전 등 상호작용이 가능하다(차단 backdrop 없음).
4. 목록 항목을 고르면 오버레이가 peek(핸들/카드)로 낮아지고 뒤 우주에서 카메라가 그 별로 fly-to한다.
5. 탐색을 여러 번 열고 닫아도 WebGPU 캔버스가 재초기화되지 않는다(영속 셸, 한 번만 마운트).
6. `/universe?panel=dormant`(또는 `=diary`)로 진입하면 캔버스 위에 그 오버레이가 열린 채 렌더되고, 뒤로가기로 닫힌다(라우트 증가 없이 `?panel=` 동기화).
7. `/dormant`로 진입하면 `/universe?panel=dormant`로 영구 redirect된다.
8. `?panel=`의 알 수 없는 값은 무시되어 어떤 오버레이도 열리지 않는다.
9. `prefers-reduced-motion`이면 시트 슬라이드/스프링과 max-height 전환이 즉시로 떨어진다.
10. Esc로 펼친 오버레이가 닫히고, 오버레이가 열려 있지 않으면 Esc가 포커스(별 회상·일기 조망)를 해제한다.
11. 24(변천사)·28(일기 목록/카드)은 별도 풀페이지 라우트가 아니라 이 셸의 같은 z-30 오버레이 레이어를 따른다.
12. `shared/ui` 오버레이 프리미티브는 3D 씬 안 `<Html>`을 만들지 않고, `features/universe/model`은 three/React/DOM을 import하지 않는다(헌법4·8 — steiger·lint·build 통과).
