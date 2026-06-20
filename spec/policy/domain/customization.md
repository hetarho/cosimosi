# 커스터마이즈 (customization) 도메인 정책 (policy/domain/customization)

> 현재 구현된 4축 외형 커스터마이즈 + 소유권·별가루(화폐) 모델의 사실 정의. spec 44.

## 정의

우주의 외형은 **4개의 독립 축**으로 커스터마이즈한다. 각 축은 같은 *아이템/소유권/선택* 모델을 따른다:

| 축(axis) | 영문 식별자 | 판매 대상 | 색의 출처 | 무료 1종(기본) |
|---|---|---|---|---|
| 배경 | `background` | **효과/질감 번들** | 요즘 mood/감정색 **파생**(고정 hue 없음·검은 우주, change 11; 별색 불간섭) | `vast` |
| 별 | `star` | **모양(form)** | mood(13감정) — **불변** | `deepfield` |
| 나 | `self` | **모양(form)** | ambient mood(요즘 감정) **파생** | `mirrorball` |
| 시냅스 | `synapse` | **스타일(style)** | 양끝 별 mood 블렌드 — **불변** | `filament` |

- **아이템 = (축, 종류 kind).** 안정 식별자 `"<axis>:<kind>"`(예 `star:aurora`·`background:aurora-veil`). id는 소유권·proto·values 키이므로 재명명/재배치 금지(별 시드 재현성과 동급 규율).
- **축마다 정확히 1종 무료**(묵시 소유 — 소유 행 없이 누구나 선택). 나머지는 유료(별가루 구매로 unlock 전엔 선택 불가). 무료 1종 매핑은 `spec/values.yaml`의 `customization.free`가 단일 출처다.
- **별가루(Stardust)** = 유일한 화폐. 시작 잔액 100. 증가 경로는 **시작 잔액 시드 + 관리자 보정 지급(spec 46)** 뿐 — 사용자 직접 충전·결제·환불은 없다. 구매로는 **차감만**(음수 불가). 배경 점구름 "별먼지"(cosmic dust)는 화폐가 아니다(별개 개념).
- **"모양/스타일만 판매."** 색은 의미(감정)라 팔지 않는다 — 별·시냅스 색은 mood 불변, 나는 ambient 파생(자동), 배경 색은 요즘 mood/감정색 파생(고정 hue 없음, change 11).

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
| 홈 드래프트·저장 | 홈(우주 메인) 외형 편집은 좌상단 별가루·테마 알약이 여는 **실제 우주 옆 split panel**(`AppearancePanel`, change 10)이며 **스킨 4축만** 다룬다(감정 색은 `/my-page`로 이관). 패널이 열려도 `UniverseCanvas`는 언마운트되지 않고(데스크톱=좌측 사이드바·모바일=하단 패널로 캔버스 폭/높이만 줄인다, `ViewOffsetController` 미사용), 상단 고정 프리뷰/샘플 씬 없이 선택을 **옆의 실제 우주에서 라이브로** 본다. 항목은 가벼운 swatch 토큰(공용 `AppearanceControls` `draft` 모드)이다 — 항목마다 라이브 3D 우주를 띄우지 않는다. 스킨(내부 식별자 `background`/`star`/`self`/`synapse` 그대로)은 **드래프트(라이브 미리보기)** 다 — 잠긴 유료 아이템도 골라 우주에 즉시 미리보고, 자동 저장하지 않는다. 라이브 선택이 마지막 저장(`savedSelection`)과 다르면 저장 바가 한 번에 커밋: 미구매 유료가 있으면 라벨 `저장 · N 별가루`(합계가)·없으면 `저장`, 저장 시 그 아이템들을 먼저 구매(원자)한 뒤 4축 선택을 `UpdateSettings`로 영속한다. 잔액 < N이면 막힌다. 뒤로(미저장 경고 후 나가기)는 드래프트를 버리고 마지막 저장으로 되돌린다(`revertSelection`, 구매/별가루/저장 규칙 무변) |
| 감정 색 편집 위치 | 13감정 색 편집은 `/my-page`의 `감정 색` 섹션이 `EmotionColorEditor`(spec 45)로 호스팅하고 `UpdateSettings.emotion_colors` 풀세트로 저장한다(change 10 — 우주 꾸미기 패널과 분리). 최초 온보딩 게이트 `/emotion-colors`(`EmotionColorPage`)는 그대로다 |
| 체험(데모) 홈 | **같은 드래프트·저장 경험**을 주되 전부 잠금 해제·무상이다 — 구매 대상이 없어 저장 바 라벨은 항상 `저장`이고, 저장은 로컬 확정만(서버·차감 없음). 좌상단 알약은 잔액 없이 팔레트만. (랜딩/사인인 플레이그라운드 FAB는 저장 바 없이 로컬 즉시 확정 — 별개) |
| 플레이그라운드(미인증·체험) | 4축 전부 **잠금 해제·선택 자유**, 별가루/구매 UI 억제, 서버 쓰기·차감 0(로컬 미리보기만). **사인인·초대(+우하단 외형 스위처)** 가 미니 코스모스로 4축(배경+별+나 앵커+시냅스 표본)을 라이브 미리보인다. **랜딩은 배경 + 별(히어로 엠블럼)만** 띄운다 — 나·시냅스 표본은 제외(순수 마케팅 백드롭, 완성도) |

### 색 규율(축별)

- **별**: 색 = mood(13감정) 팔레트. 어떤 모양을 골라도 색은 감정을 따른다(모양만 바뀐다).
- **시냅스**: 색 = 양끝 별 mood 블렌드. 스타일은 선의 *생김새*(지오메트리 + 셰이더 표현)를 바꾼다(change 11) — `filament`=꼬인 가닥 다발 · `particle`=가는 점선 · `dendrite`=작은 가지가 갈라지는 신경 돌기형(레거시 `beam`·`flow` 제거·`filament` 정규화). `weight`→밝기/alpha/펄스 시각·삭제금지(헌법2; 점선도 비드 사이 바닥 불투명 유지) 불변식·Line2 전역 스칼라 한계(per-edge 셰이더 두께 없음·스타일당 단일 머지 드로우·정점 attribute ≤8·수동 uniform time)는 유지.
- **나**: 몸체 색 = **요즘 감정(ambient mood)** 파생(테마/배경 귀속 없음). 데이터 없음·미인증·빈 우주면 중립/배경 accent 폴백. **자아 별이 다른 별에 던지는 빛(self-light 반사 채널)은 중립 유지**(spec 03 — mood 색 소유권은 AmbientNebula 풀, 이중 주입 금지). 몸체 색만 ambient. 형태는 축별로 실루엣이 갈린다(change 11 — `mirrorball`=각진 반사구 · `prism-cube`=굴절 큐브 · `neuron-bloom`=soma 덩어리; 레거시 nebula-heart/core/well은 mirrorball 정규화. 세밀한 반사/굴절/dendrite 셰이더는 후속 비주얼 폴리시).
- **배경(change 11)**: 고정 hue를 소유하지 않는다 — 모든 스킨이 **중립 딥스페이스 팔레트**를 공유하고 보이는 색은 항상 요즘 mood/감정색 파생(검은 우주). 스킨이 정하는 건 **효과(`effect`)·무늬(`pattern`)·`emotionSlots`**다. `UniverseNebula`가 `effect`로 서로 다른 절차적 셰이더 경로(`haze`=검정+mood 안개 · `nebula`=격동 워시 · `waves`=느린 파동 · `aurora`=가끔 지나가는 mood 커튼 선 · `static`=강한 쿨 그레인+지지직 글리치 · `caustics`=심해 물빛 · `ridges`=성운 절벽 능선)를 고르고, 그 위에 상위 `emotionSlots`개 감정(Bjork R 순위·`resolveMoodRgb`, 45)을 R-비중으로 칠한다. `arousal`(Σ R)이 전역 생동을 정한다. 배경 변경은 **별의 mood 색을 바꾸지 않고**(StarField는 emotionColors/mood만 읽음), presence=0(빈 우주·미인증·로딩)이면 거의 검정 = 안전한 중립 fallback(별색·자아 반사 중립 불변, spec 25·03·07). `emotionSlots`(vast·calm·abyssal-sea `1`·lively·signal-noise·cosmic-cliffs `3`·aurora-veil `13`)·`effect`·패턴은 **코드 카탈로그 시각 정의**(가격은 values). (신규 폼의 세밀한 셰이더 폴리시는 후속.)

## RPC 계약 (SettingsService, 전부 인증·unary — 헌법6)

| RPC | 멱등 | 동작 |
|---|---|---|
| `GetSettings` / `UpdateSettings` | Get만 NO_SIDE_EFFECTS | 4축 선택 read/부분 upsert. Update는 선택-소유권 강제(ErrNotOwned) |
| `GetInventory` | NO_SIDE_EFFECTS(HTTP GET) | 지갑 없으면 `starting_stardust` 시드 후 `{stardust, owned_item_ids}` 반환. 무료 종은 owned에 없다(묵시) |
| `PurchaseItem` | (쓰기) | `item_id`(유료) → 원자 차감+부여 → 새 인벤토리. 위 구매 검증 |

## 데이터 모델 (마이그레이션 00010)

- `user_wallet(user_id PK, stardust INT NOT NULL, …)` — 잔액. 시작 100은 시드 시 값으로 채움(DB 기본값 아님).
- `user_owned_items(user_id, item_id, …, PK(user_id,item_id))` — 유료 소유분만.
- `user_settings`에 `self_object TEXT`·`synapse_style TEXT` 추가(nullable=클라 기본). 기존 `theme`·`star_object` 유지.

## 가격 (values.yaml `customization`)

가격·무료·시작 잔액은 `spec/values.yaml`이 단일 출처다(FE/BE 생성 상수, 코드 하드코딩 금지). 현재 균형: 시작 100으로 가장 싼 조합 2~3개 구매 가능. 유료 아이템 = `customization.price` 키 전체(change 11 기준 — 배경 `lively`·`calm`·`aurora-veil`·`signal-noise`·`abyssal-sea`·`cosmic-cliffs`, 별 `aurora`·`liquid`·`ember`·`pulsar`, 나 `prism-cube`·`neuron-bloom`, 시냅스 `particle`·`dendrite`). 무료 1종은 `customization.free`(배경 `vast`·별 `deepfield`·나 `mirrorball`·시냅스 `filament`). change 11에서 제거된 `self:core`·`self:well`·`synapse:beam`·`synapse:flow`는 더 이상 가격표에 없어 신규 구매/선택이 거부되고(레거시 선택은 축 기본값으로 정규화), 데이터 행은 삭제하지 않는다.

## 비목표(현재 미구현)

사용자 직접 충전(top-up)·결제(PG/인앱)·환불·정산(관리자 보정 지급 spec 46은 별개 — 사용자 비노출 운영 경로). 별·시냅스 "색" 판매. 감정색(`MOOD_PALETTE`) 자체 판매/커스텀. 관리자 콘솔 아이템/가격 편집(가격은 values.yaml 단일 출처). 공유/선물 우주에서 타인 커스텀 적용 변경(공유 우주는 소유자 Settings 스냅샷 — 축만 4개로 늘었다).
