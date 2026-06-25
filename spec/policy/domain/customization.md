# 커스터마이즈 (customization) 도메인 정책 (policy/domain/customization)

> 현재 구현된 4축 외형 커스터마이즈 + 소유권·별가루(화폐) 모델의 사실 정의. spec 44.

## 정의

우주의 외형은 **4개의 독립 축**으로 커스터마이즈한다. 각 축은 같은 *아이템/소유권/선택* 모델을 따른다:

| 축(axis) | 영문 식별자 | 판매 대상 | 색의 출처 | 무료 1종(기본) |
|---|---|---|---|---|
| 배경 | `background` | **효과/질감 번들**(단일 effect) | 요즘 mood/감정색 **파생**(고정 hue 없음·검은 우주, change 11; 별색 불간섭) | `galaxy` |
| 별 | `star` | **단일 룩(look)** (1 아이템, change 29) — 룩이 모양+질감+추상화 단계 변형을 묶는다. **전역 기본 + 감정(13 mood)별 오버라이드**(change 30) | mood(13감정) — **불변** | `polyhedron` |
| 나 | `self` | **형태(form)×표면(surface)** (2 아이템, spec 52) | ambient mood(요즘 감정) **파생** | `orb`+`mirror` |
| 시냅스 | `synapse` | **형태(form)×표면(surface)** | 양끝 별 mood 블렌드 — **불변** | `strands`+`flow` |

- **아이템 = (축, 종류 kind).** 안정 식별자 `"<axis>:<kind>"`(예 `background:vortex`). id는 소유권·proto·values 키이므로 재명명/재배치 금지(별 시드 재현성과 동급 규율).
- **별은 단일 축 룩(change 29) + 감정별 오버라이드(change 30), 나·시냅스는 form×surface 2축 분리(spec 52).** 별은 룩 3종(`polyhedron`·`liquid`·`spiky`) 중 하나를 고르며 아이템 = `"star:look:<id>"`(무료 1+유료 N), 선택 wire(`star_object`)는 **전역 기본** 룩 id 하나(레거시 합성·프리셋 폐기, 미지는 디폴트 룩 폴백). 그 위에 **감정(13 mood)별 룩 오버라이드**(`Settings.emotion_forms` 부분 맵, 색 오버라이드와 평행)를 얹어, 별 렌더 룩 = 그 별 mood의 오버라이드 ?? 전역 기본이다. 오버라이드 룩도 같은 `star:look:<id>` 소유 검증을 받고(미소유 배정 거부), 룩은 한 번 사면 어느 감정에든 자유 배정된다(감정별 별도 구매 아님). **나·시냅스**는 형태(form)와 표면(surface)을 독립 선택·독립 판매한다 — sub-item id `"<axis>:form:<id>"`·`"<axis>:surface:<id>"`, 선택은 합성 wire id `"<form>+<surface>"`로 *기존* 필드(`self_object`·`synapse_style`)에 직렬화 → **proto/DB 스키마 무변경**. 미지/레거시는 축 기본으로 폴백(크래시 없음). 배경은 단일 effect 그대로.
- **축마다(형태 축은 슬롯마다) 정확히 1종 무료**(묵시 소유 — 소유 행 없이 누구나 선택). 나머지는 유료(별가루 구매로 unlock 전엔 선택 불가). 무료 매핑은 `spec/values.yaml`의 `customization.free`(키 `background`·`<axis>:form`·`<axis>:surface`)가 단일 출처다.
- **합성 선택의 소유 = 양쪽 sub-item 소유(또는 무료).** BE가 합성을 디코드해 양쪽을 검증하고, 한쪽이라도 미소유면 거부한다. **레거시 소유 호환:** 분리 전 단일 paid id(`star:ember` 등) 구매는 BE가 읽기 시(`GetInventory`·선택 검증) 그 form/surface sub-item으로 확장(`settings.expandLegacyOwned`)해 재구매 없이 같은 스킨을 계속 해금한다(DB 마이그레이션 없음).
- **별가루(Stardust)** = 유일한 화폐. 시작 잔액 100. 증가 경로는 **시작 잔액 시드 + 관리자 보정 지급(spec 46)** 뿐 — 사용자 직접 충전·결제·환불은 없다. 구매로는 **차감만**(음수 불가). 배경 점구름 "별먼지"(cosmic dust)는 화폐가 아니다(별개 개념).
- **"모양/질감만 판매."** 색은 의미(감정)라 팔지 않는다 — 별·시냅스 색은 mood 불변, 나는 ambient 파생(자동), 배경 색은 요즘 mood/감정색 파생(고정 hue 없음, change 11). form/surface는 형태·질감만 바꾼다.

## 권위 분리

| 무엇 | 권위 | 어디 |
|---|---|---|
| 별가루 잔액·소유권·선택(4축) | **서버**(클라가 못 속인다) | `user_wallet`·`user_owned_items`·`user_settings`(DB) |
| 각 아이템의 시각 정의(셰이더·형태·스타일·swatch·이름·태그라인) | **코드 카탈로그**(id로 키잉) | FE `entities/{appearance,star,synapse}` |
| 가격·무료여부·시작 잔액 | **values.yaml**(FE/BE 생성) | `spec/values.yaml` `customization` |

아이템 *종류의 enumeration*은 코드 카탈로그가 가지며, BE는 "유효 id 화이트리스트"만 미러한다 — 그 화이트리스트 = `customization.price` 키 ∪ `customization.free`의 `axis:kind`(생성 상수에서 파생, 손코딩 금지).

## 규칙 · 파라미터

### 별가루·소유권·구매

| 규칙 | 값 / 조건 |
|---|---|
| 시작 잔액 | `customization.starting_stardust = 100`. 인증 사용자가 **인벤토리를 처음 조회**할 때(또는 첫 구매 시) 지갑 행이 없으면 1회 멱등 시드(없을 때만 INSERT; 기존 잔액 불변) |
| 잔액 변화 | **구매 차감**(`stardust >= price`일 때만, 가드 WHERE → 음수 불가) + **관리자 보정 지급**(spec 46, `GrantUserStardust` — 서버 권위 지갑에 한 트랜잭션으로 증가 + 감사). 사용자 직접 충전·결제·환불은 비목표 |
| 소유 집합 | **구매한 유료 아이템 id만** `user_owned_items`에 1행. 무료 종은 행 없음(묵시 소유) |
| 구매 검증(한 트랜잭션, 부분 적용 금지) | (a) 알 수 없거나 무료인 id → `InvalidArgument`. (b) 이미 소유 → `FailedPrecondition`(이중 차감 금지). (c) 잔액 < 가격 → `FailedPrecondition`. 통과 시 `stardust -= price` + 소유 부여, 새 인벤토리 반환. 실패 시 어떤 행도 안 바뀐다(차감 후 grant 실패면 rollback이 차감을 되돌림) |
| 선택(UpdateSettings) | 선택하려는 아이템이 **소유(또는 무료)** 가 아니면 `FailedPrecondition`(ErrNotOwned)로 거부 — 잠긴 아이템을 API로 우회 선택 못 한다. 알 수 없는 id는 `InvalidArgument`. **거부 시 어떤 행도 안 바뀐다**(소유 조회는 지갑을 시드하지 않는 read-only) |

### 선택(4축)·영속

| 규칙 | 값 / 조건 |
|---|---|
| 선택 저장 | 4축 전부 `user_settings`에 영속(`theme`=배경·`star_object`·`self_object`·`synapse_style`). null = 클라 기본(축별 무료 종). 새로고침·타 기기에서 같은 선택 로드 |
| 클라 영속 규율 | **선택(기기 선호)** 은 localStorage 유지. **별가루·소유권은 메모리 전용**(공용 PC에 개인 자산 영속 금지) — 시드는 GetInventory. 출처 경계 리셋(로그아웃·계정 전환·체험 enter/exit)에서 지갑·소유·감정색 초기화 |
| 렌더 폴백 | 선택값을 **그대로 렌더**하되 카탈로그에 없는(알 수 없는·손상) id는 **축 기본값**으로 폴백(렌더 안 깨짐). 소유권은 **저장 시점(드래프트 저장 = 미구매분 일괄 구매)과 서버(UpdateSettings)** 에서 강제하고 렌더에서 다시 폴백하지 않는다 — 그래야 공유 우주(방문)가 *소유자* 선택을 방문자 소유로 가리지 않는다 |
| 홈 드래프트·저장 | 홈(우주 메인) 외형 편집은 좌상단 별가루·테마 알약이 여는 **실제 우주 옆 split panel**(`AppearancePanel`, change 10)이며 **전역 4축만** 다룬다 — 별 형태 피커는 전역 기본 룩만 고치고(감정별 룩 드롭다운은 스튜디오로 이전, change 33), `감정별 별 커스텀하기` 버튼이 `/emotion-stars`로 보낸다. 감정 색·형태는 거기서. 패널이 열려도 `UniverseCanvas`는 언마운트되지 않고(데스크톱=좌측 사이드바·모바일=하단 패널로 캔버스 폭/높이만 줄인다, `ViewOffsetController` 미사용), 상단 고정 프리뷰/샘플 씬 없이 선택을 **옆의 실제 우주에서 라이브로** 본다. 항목은 가벼운 swatch 토큰(공용 `AppearanceControls` `draft` 모드)이다 — 항목마다 라이브 3D 우주를 띄우지 않는다. 스킨(내부 식별자 `background`/`star`/`self`/`synapse` 그대로)은 **드래프트(라이브 미리보기)** 다 — 잠긴 유료 아이템도 골라 우주에 즉시 미리보고, 자동 저장하지 않는다. 라이브 선택이 마지막 저장(`savedSelection`)과 다르면 저장 바가 한 번에 커밋: 미구매 유료가 있으면 라벨 `저장 · N 별가루`(합계가)·없으면 `저장`, 저장 시 그 아이템들을 먼저 구매(원자)한 뒤 4축 선택을 `UpdateSettings`로 영속한다. 잔액 < N이면 막힌다. 뒤로(미저장 경고 후 나가기)는 드래프트를 버리고 마지막 저장으로 되돌린다(`revertSelection`, 구매/별가루/저장 규칙 무변) |
| 감정별 색·형태 편집 위치 | 13감정 색 **+ 별 형태 룩** 편집은 **감정별 별 스튜디오 `/emotion-stars`**(보호 라우트, change 33)가 단일 표면으로 호스팅한다 — 색은 `saveEmotionColors`(emotion_colors full-set), 형태는 `pushSettings`의 emotion_forms 부분 업서트(+미소유 룩 `purchaseItem`)로 단일 저장이 함께 커밋. 13감정 미니 캔버스 미리보기 + 추상화 단계 스크럽(미리보기 전용). 마이페이지 `감정 색` 섹션은 제거(진입 링크만). 최초 온보딩 게이트 `/emotion-colors`(`EmotionColorPage`)는 색만 다루는 표면으로 그대로다 |
| 체험(데모) 홈 | **같은 드래프트·저장 경험**을 주되 전부 잠금 해제·무상이다 — 구매 대상이 없어 저장 바 라벨은 항상 `저장`이고, 저장은 로컬 확정만(서버·차감 없음). 좌상단 알약은 잔액 없이 팔레트만. (랜딩/사인인 플레이그라운드 FAB는 저장 바 없이 로컬 즉시 확정 — 별개) |
| 플레이그라운드(미인증·체험) | 4축 전부 **잠금 해제·선택 자유**, 별가루/구매 UI 억제, 서버 쓰기·차감 0(로컬 미리보기만). **사인인·초대(+우하단 외형 스위처)** 가 미니 코스모스로 4축(배경+별+나 앵커+시냅스 표본)을 라이브 미리보인다. **랜딩은 배경 + 별(히어로 엠블럼)만** 띄운다 — 나·시냅스 표본은 제외(순수 마케팅 백드롭, 완성도) |

### 색 규율(축별)

- **별(change 29)**: 색 = mood(13감정) 팔레트. 어떤 룩을 골라도 색은 감정을 따른다. 룩 3종 = `polyhedron`(다면체)·`liquid`(액체→구름)·`spiky`(고슴도치); 각 룩이 toolkit(plan 50) geometry 생성기로 모양+질감+추상화 단계 변형을 묶는다(`buildStarBody(look, stage)`, plan 53). 무료 `polyhedron`. form×surface 2축·레거시 프리셋은 폐기.
- **시냅스**: 색 = 양끝 별 mood 블렌드. form=선 구조(`strands`=꼬인 다발 · `branched`=가지 다발 · `dotted`=가는 한 줄), surface=움직임/질감(`flow`=빛 패킷 · `beads`=점점이 비드 · `steady`=잔잔 발광)을 따로 고른다(spec 52). filament=strands+flow·dendrite=branched+flow·particle=dotted+beads로 보존. `weight`→밝기/alpha/펄스 시각·삭제금지(헌법2; 모든 surface가 비드/잔잔 포함 0이 아닌 바닥 유지) 불변식·Line2 전역 스칼라 한계(per-edge 셰이더 두께 없음·선택당 단일 머지 드로우·정점 attribute ≤8·수동 uniform time)는 유지.
- **나**: 몸체 색 = **요즘 감정(ambient mood)** 파생(테마/배경 귀속 없음). 데이터 없음·미인증·빈 우주면 중립/배경 accent 폴백. **자아 별이 다른 별에 던지는 빛(self-light 반사 채널)은 중립 유지**(spec 03 — mood 색 소유권은 AmbientNebula 풀, 이중 주입 금지). 몸체 색만 ambient. form=실루엣(`orb`=반사구 · `cube`=큐브 · `bloom`=변위 덩어리), surface=질감(`mirror`=격자 케이지+글린트 · `prism`=프레임+색분산 · `neuron`=돌기 셸+핵광)을 따로 고른다(spec 52). mirrorball=orb+mirror·prism-cube=cube+prism·neuron-bloom=bloom+neuron로 보존.
- **배경(change 11)**: 고정 hue를 소유하지 않는다 — 모든 스킨이 **중립 딥스페이스 팔레트**를 공유하고 보이는 색은 항상 요즘 mood/감정색 파생(검은 우주). 스킨이 정하는 건 **효과(`effect`)·무늬(`pattern`)·`emotionSlots`**다. `UniverseNebula`가 `effect`로 서로 다른 절차적 셰이더 경로(`haze`=검정+mood 안개 · `nebula`=격동 워시 · `waves`=느린 파동 · `aurora`=가끔 지나가는 mood 커튼 선 · `static`=강한 쿨 그레인+지지직 글리치 · `caustics`=심해 물빛 · `ridges`=성운 절벽 능선)를 고르고, 그 위에 상위 `emotionSlots`개 감정(Bjork R 순위·`resolveMoodRgb`, 45)을 R-비중으로 칠한다. `arousal`(Σ R)이 전역 생동을 정한다. 배경 변경은 **별의 mood 색을 바꾸지 않고**(StarField는 emotionColors/mood만 읽음), presence=0(빈 우주·미인증·로딩)이면 거의 검정 = 안전한 중립 fallback(별색·자아 반사 중립 불변, spec 25·03·07). `emotionSlots`(vast·calm·abyssal-sea `1`·lively·signal-noise·cosmic-cliffs `3`·aurora-veil `13`)·`effect`·패턴은 **코드 카탈로그 시각 정의**(가격은 values). (신규 폼의 세밀한 셰이더 폴리시는 후속.)

## RPC 계약 (SettingsService, 전부 인증·unary — 헌법6)

| RPC | 멱등 | 동작 |
|---|---|---|
| `GetSettings` / `UpdateSettings` | Get만 NO_SIDE_EFFECTS | 4축 선택 + 감정별 색(`emotion_colors`)·형태(`emotion_forms`, change 30) read/부분 upsert(바꾼 mood만). Update는 선택·오버라이드 룩 소유권 강제(ErrNotOwned) |
| `GetInventory` | NO_SIDE_EFFECTS(HTTP GET) | 지갑 없으면 `starting_stardust` 시드 후 `{stardust, owned_item_ids}` 반환. 무료 종은 owned에 없다(묵시) |
| `PurchaseItem` | (쓰기) | `item_id`(유료) → 원자 차감+부여 → 새 인벤토리. 위 구매 검증 |

## 데이터 모델 (마이그레이션 00010·00015)

- `user_wallet(user_id PK, stardust INT NOT NULL, …)` — 잔액. 시작 100은 시드 시 값으로 채움(DB 기본값 아님).
- `user_owned_items(user_id, item_id, …, PK(user_id,item_id))` — 유료 소유분만.
- `user_settings`에 `self_object TEXT`·`synapse_style TEXT` 추가(nullable=클라 기본). 기존 `theme`·`star_object` 유지.
- `user_emotion_forms(user_id, mood, look, PK(user_id,mood))` — 감정별 별 형태 오버라이드(00015, change 30). 색의 `user_emotion_colors`(00002) 평행물, 바꾼 mood만 1행씩. 빈 행 = 전부 전역 기본 룩.

## 가격 (values.yaml `customization`)

가격·무료·시작 잔액은 `spec/values.yaml`이 단일 출처다(FE/BE 생성 상수, 코드 하드코딩 금지). 유료 아이템 = `customization.price` 키 전체. 배경은 단일 id(`background:vortex`·`background:crystal`·`background:mandala`); **별은 단일 룩 아이템**(`star:look:liquid`·`star:look:spiky` 유료, change 29); 나·시냅스는 form/surface sub-item으로 판다(spec 52) — 나 form `cube`·`bloom` + surface `prism`·`neuron`, 시냅스 form `branched`·`dotted` + surface `beads`·`steady`. 무료는 `customization.free`(키 `background`=`galaxy`·`star:look`=`polyhedron`·`self:form`=`orb`·`self:surface`=`mirror`·`synapse:form`=`strands`·`synapse:surface`=`flow`). 카탈로그에 없는 레거시/미지 id는 가격표에 없어 신규 구매/선택이 거부되고(선택은 축 기본으로 정규화), 데이터 행은 삭제하지 않는다. 나·시냅스의 분리 전 단일 paid id 구매는 `expandLegacyOwned`로 sub-item에 매핑돼 호환된다(별은 정식 출시 전 단일 룩 전환이라 레거시 호환 불필요).

## 비목표(현재 미구현)

사용자 직접 충전(top-up)·결제(PG/인앱)·환불·정산(관리자 보정 지급 spec 46은 별개 — 사용자 비노출 운영 경로). 별·시냅스 "색" 판매. 감정색(`MOOD_PALETTE`) 자체 판매/커스텀. 관리자 콘솔 아이템/가격 편집(가격은 values.yaml 단일 출처). 공유/선물 우주에서 타인 커스텀 적용 변경(공유 우주는 소유자 Settings 스냅샷 — 축만 4개로 늘었다).
