# 상호작용 (policy/ux/interaction)

> 현재 구현된 사용자-우주 상호작용(회상·공동 회상·기록·체험)의 사실 정의.

## 정의

cosimosi의 상호작용은 **의도적 인출(deliberate retrieval)**을 중심으로 동작한다. 별을 클릭해 **둘러보는** 것만으로는 아무 것도 바뀌지 않고(읽기 전용 열람), 사용자가 명시적으로 **회상하기**를 누른 순간에만 회상·공동 회상이 일어난다 — 우주를 훑어보는 행위가 모든 별을 재점화·재성형해 자연 망각·요지화를 무너뜨리던 문제를 막는다(change 35). 현재 구현된 갈래는 네 가지다: (1) **회상** — 별 클릭 → 읽기 전용 열람, `이 별 자세히 보고 회상하기` 버튼 → 재점화·재성형(재회상 쿨다운 게이트), (2) **공동 회상** — 직전 회상 별과의 페어 연결 강화, (3) **기록** — 본문+감정+강도+날짜 폼 제출 → 단일 별 낙관적 등장, (4) **체험(demo)** — 비로그인 더미 우주. 온보딩(페르소나 → 모드 선택)을 거쳐 자유모드로 들어가고(plan 47), 자유모드는 우주 셸 HUD에 데모 페르소나/시간 버튼·가상 시계·프리셋 작성 흐름(change 25)을 얹는다(기능 안내 투어는 plan 48). AI 감정 감지·기억 조각화는 plan 20·21에서 다룬다(아직 정책 아님).

## 규칙 · 파라미터

### 1. 회상 (recall)

| 규칙 | 값 |
| --- | --- |
| **클릭 = 부작용 없는 열람, 본문은 가림** — 별을 클릭하면 패널이 `PeekMemory`로 즉시 열리되(재점화·재성형·공동 회상·AI 재작성 잡 **모두 미발생**, change 35) **본문은 글자 위 블러로 가려진 채** 뜬다(포트레이트·메타만 보임). 둘러보기는 별을 절대 안 바꾸고, 본문은 떠올려야 읽힌다 | `PeekMemory`(NO_SIDE_EFFECTS) |
| **회상 = 명시적 버튼(블러 해제)** — 패널의 `이 별 자세히 보고 회상하기` 버튼만이 `RecallMemory`(부작용)를 발화하고 본문 블러가 걷힌다 → 재점화(`last_recalled_at=now`·`recall_count++`)·PE 게이트 재성형(23)·공동 회상 강화·(단계≥2) AI 재작성 잡. 회상 직후(쿨다운 중)인 별은 다시 열어도 또렷(방금 떠올린 기억); 쿨다운이 지나 또렷함이 사라지면 다시 가려진다 | 버튼 트리거 |
| **재회상 쿨다운** — 같은 별은 마지막 회상 후 `recall_cooldown_ms` 경과해야 다시 회상 가능. 미경과면 **서버가 부작용을 전부 거부**(`recalled=false`+잔여 반환, BE 권위)하고 버튼이 비활성·안내를 보인다. 첫 회상(`recall_count ≤ 1`)은 항상 가능, 야간 공고화 1회면 쿨다운보다 길어 자연 해제 | `recall.recall_cooldown_ms = 3600000` (1시간) |
| 회상 패널은 **읽기 전용 원본 `Record`** — 본문·`entry_date`·`mood`·`intensity` 표시, 편집·삭제 컨트롤 없음 | read-only |
| **재열람** — 원본이 캐시에 있으면(불변, [data-sync](../domain/data-sync.md)) 본문을 **즉시 표시**(스피너 없음); peek는 최신 `derived_text`를 채운다(부작용 없음) | 캐시 우선 |
| 이웃 항해 — 선택 별 시냅스 이웃을 `neighborsOf(edges, selectedId)`로 weight 내림차순 렌더, 최대 표시 수 | `MAX_NEIGHBORS = 8` |
| 이웃 클릭 = 선택 전환만(`focusActor.send({type:'SELECT_STAR', id})` — 39) — 패널이 새 별을 읽기 전용 열람. **카메라 fly-to 아님**(NeighborNav는 카메라 타깃을 만들지 않는다) | 선택 전환 |
| **포커스 해제(배경 탭)** — 별을 고르면 은은한 딤(`Backdrop`)으로 집중을 알리고, 회상 패널 ✕ **또는 빈 우주 탭**(캔버스 `onPointerMissed`→`focusActor.send({type:'DISMISS'})` — 39)으로 해제·복귀. 별 탭(선택 전환)·드래그(회전)는 통과(해제 아님 — R3F가 클릭 delta로 구분). **change 08(A11):** 캔버스 제스처(드래그·두 손가락 pan/thrust·double-tap-hold zoom scrub)가 active면 dismiss하지 않는다(`navigation-input.gestureActive` 가드). 짧은 탭만 별 선택/dismiss를 발생시킨다 | 배경 탭=복귀 |

### 2. 공동 회상 (co-recall)

| 규칙 | 값 |
| --- | --- |
| 직전 **회상**(회상하기 버튼 성사) 별과 다른 별을 회상하면 그 페어에 증분(트리거가 dwell→버튼, change 35) | `CO_RECALL_DELTA = +0.05`/이벤트 |
| 같은 id 재회상은 페어 미생성(`lastViewedId`만 갱신) | no-op |
| weight 상한(서버 업서트) | `LEAST(1.0, weight + delta)` |
| 강화 시 부가 효과(서버) | `co_activation_count++`, `last_activated_at = now` |
| 페어 정규화 — 무방향 키 `a < b`, 같은 윈도 내 같은 페어는 합산 | `pairKey` |
| 디바운스 flush — 마지막 회상 후 유휴 시간 경과 시 1회 배치 전송 | `DEBOUNCE_IDLE_MS = 5000` (~5s) |
| 추가 flush 시점 — 탭 숨김/종료(`beforeunload`·`visibilitychange=hidden`), keepalive 전송 | flush 호출 |
| 멱등 — 같은 `batch_id` 재전송은 서버 `processed_batches`로 skip(이중 가산 금지) | `batch_id` |
| 실패 시 — drain한 증분을 같은 `batch_id`로 재병합해 재시도(유실 방지), 동시 1배치만 in-flight | 재시도 |
| 생성 경로 `link_type` | `co_recall` |

### 3. 기록 (record)

| 규칙 | 값 |
| --- | --- |
| 입력 항목 — 본문 textarea + **감정 `Dropdown`(13종, spec 29 — Russell 4사분면 순서)** + 강도 슬라이더 + 날짜(`YYYY-MM-DD`, 기본 오늘 로컬) | 4개 입력 |
| 제출 → 임시 별(`temp-` id, `seed = seedFromId(tempId)`) 낙관적 `addStar` → `RecordMemory` 호출 | 단일 별 즉시 등장 |
| 성공 → `memory_id`+폼 값으로 확정 별 `replaceStar(tempId, …)`(`seed = seedFromId(memory_id)`) | 서버 id 교체 |
| 실패 → `removeStar(tempId)`(임시 별만), 한국어 에러 카피 노출 | 임시 별만 롤백 |
| 공백 본문 제출 차단 | RPC 미호출 |
| 감정·강도 값 출처 | 사용자가 폼에서 직접 선택(AI 감지 아님) |

### 4. 체험 (demo)

| 규칙 | 값 |
| --- | --- |
| 진입 — 랜딩의 "체험 우주 시작하기" 또는 카드 "체험 우주에서 해보기" → `startDemoSession()`(더미 우주·진입 흐름 리셋 + `enterDemoMode()`) → `sessionStorage('cosimosi:demo'='1')` → `/`. 매 진입은 온보딩부터 시작한다(아래) | 세션 플래그 |
| **온보딩 → 자유모드(plan 47)** — `/` 진입이 데모이고 진입 흐름(`cosimosi:demo-flow`)이 `free`가 아니면 우주 HUD 대신 선택 화면을 먼저 띄운다: ① "누구의 우주를 탐험해볼까요?" 세 페르소나, ② "기능 하나하나 알아보기"(plan 48 튜토리얼) / "자유롭게 탐험해보기"(`free` → 아래 30일 genesis). 흐름은 데모 세션에만 저장되고 새로고침에도 `free`는 유지된다(온보딩으로 다시 안 튕김). 캔버스는 뒤에서 계속 돈다 | `cosimosi:demo-flow` |
| **자유모드 = 30일 genesis(change 28)** — 자유모드 진입은 정적 코퍼스를 일괄 시드하지 않는다. 우주가 **빈 상태**에서 출발해 배속(`demo_genesis.hours_per_second`, 예 24=하루≈1초)으로 30 simulated days를 산다. 매일 페르소나별 `demo_genesis.daily_write_prob`(순서=`PERSONA_ORDER` student·worker·homemaker)로 일기 작성 여부(하루 최대 1편)·`daily_recall_prob`로 회상 여부를 굴리고, 쓰는 날엔 per-persona 프리셋 풀(`pickGenesisDiary` — 자유 작성 `pickDiaryPreset`과 같은 콘텐츠 출처)에서 토픽 분포(weight)대로 한 편을 뽑아 change 25 fan-out + change 27 엔진으로 별·연결을 빚는다. 매 밤 04:00 야간 공고화가 발화한다. **난수는 genesis 입력(작성·템플릿·회상 대상)에만**(세션마다 다른 시드 — 데모마다 다른 우주), 엔진은 결정론(change 27 골든 parity 유지). genesis 동안 `새 별 띄우기`·배속 셀렉터는 **잠기고**(카메라/줌/별 클릭=읽기·회상 허용), 30일을 마치면 시계가 멈추고 **환영 안내**("30일을 함께 보냈어요") 뒤 `새 별 띄우기`·배속이 열린다. 페르소나 전환·`처음으로`는 genesis를 빈 우주에서 다시 돌린다(새 난수). 데이터 시드는 `getDemoFlow()==='free'`에서만 genesis 분기를 타고, **첫 별 튜토리얼(change 34·plan 48)도 빈 우주에서 출발**(genesis·정적 코퍼스 둘 다 아님 — 첫 별은 사용자가 안내대로 띄우는 고정 fixture)하며, **온보딩 배경 캔버스·겹쳐보기(spec 37)만 정적 코퍼스**를 시드한다(자유→튜토리얼 진입 시 빈 우주 재시드·genesis 정지) | `genesis.ts`·`advanceDemoGenesis` |
| 데이터 출처 — `isDemoMode()`이면 API 래퍼가 백엔드 대신 더미데이터로 분기(`demoStars`/`demoSynapses`/`demoRecall`/`demoAddRecord`) | 체험 우주 |
| **가상 시계 — 배속 연속(change 24)** — 체험 우주의 밝기·잠듦·반지름 파생 "현재 시각"은 `virtualNowMs() = Date.now() + offset`(offset은 demo에서만 ≠0). 자유모드 시간 팝오버는 배속 셀렉터(`1·2·4시간` = 실제 1초당 흐르는 가상 시간 / `정지`)다 — 이산 점프 버튼 대체. 정지가 아니면 rAF 드라이버가 배속만큼 offset을 누적해 별이 *실시간으로* 멀어지고 어두워지고(throttle `demo_clock.refresh_throttle_ms`로 재파생, 매 프레임 setStars 금지 — 헌법8), simulated 04:00 KST(=`consolidation.hour_utc`) 경계를 지날 때마다 야간 공고화(`demoConsolidate()`)를 1회씩 발화한다(빠른 배속 다중 경계도 각 1회). 실제 감쇠 수식([star](../domain/star.md) 반감기 30일·바닥 5%)이 그대로 돈다. 비demo·실계정 우주엔 배속 시계·자동 야간·배속 컨트롤이 나타나지 않는다(`Date.now()` 그대로) | `tickDemoClock`·`advanceDemoClock` |
| **체험 재점화** — 체험 우주 회상(회상하기 버튼)도 그 별의 `lastRecalledAt`을 가상 now로 전진(`demoMarkRecalled`) + universe 쿼리 무효화 → 잠든 별이 다시 밝아지는 루프가 체험 우주에서 완결. 재회상 쿨다운도 가상 시계(`virtualNowMs`)로 동일 판정(하룻밤 빨리감기로 해제, change 35) | 서버 대칭 |
| **체험 별 띄우기(change 25)** — 자유모드 하단 중앙 `새 별 띄우기`는 production 작성 폼(`MemoryForm`)을 **read-only 프리셋 일기**로 연다(`beginDemoCompose`로 본문/날짜 주입). `별 나누기`→프리셋 사전분절 조각(`SegmentMemory` 대체 `demoComposeSegments`)→검토→`별 띄우기`(`RecordMemory` 대체 `demoRecordMemory`)가 production과 같은 흐름·표현으로 돈다. 조각 별 연결은 production 식·정전 값(`connection.*`: 일내 결속·의미 KNN 근사·감정 유사도·캡 0.79). 데모 전용 가중치·키워드 추정·`DEMO_MAX_FRAGMENTS`·랜덤 별(`demoAddRandomStars`)은 폐기. 데모는 서버 미호출. genesis 30일 관전 중에는 이 버튼이 잠긴다(change 28) | production 흐름 재사용 |
| **헵 로컬 미리보기** — 체험 우주에서 공동 회상 페어가 확정되는 즉시 그 엣지 weight를 로컬 +0.05(상한 1.0, 없던 페어는 `co_recall` 로컬 생성) → 굵어짐이 바로 보인다. `reinforceLinks`는 여전히 no-op, 서버/proto 미기록 | no server write |
| **자유모드 컨트롤(plan 47)** — 좌상단 테마 pill 아래 데모 전용 아이콘 버튼 두 개: ① 페르소나 팝오버(세 페르소나 — 고르면 `switchDemoPersona`로 그 우주 재시드, 가상 시계·추가 별 0, 자유모드 유지), ② 시간 팝오버(배속 셀렉터 `1·2·4시간`/`정지` + "처음으로", change 24). "처음으로"는 현재 페르소나·자유모드를 유지한 채 시계·추가 별 0으로 복귀(온보딩으로 안 돌아감). 한 번에 하나만 열리고 다른 표면이 열리면 닫힌다. 좌하단 `기억 실험실`/`뇌과학 이론` 칩·컨트롤러는 자유모드에 없다(이론·기능 안내는 plan 48 튜토리얼) | `DemoFreeModeControls` |
| **첫 별 튜토리얼(plan 48·change 12·34)** — 데모 모드 선택 `기능 하나하나 알아보기`(flow=`tutorial`, **빈 우주**)와 **실계정 최초 빈 우주 진입**(인증·멤버십·감정색 게이트 통과 후 `/`에 별이 없고 per-user 완료 상태 없음 → 자동 시작)이 **같은 투어 머신**(`tour.machine`)을 공유한다. 맥락은 `tourContext`(demo/account)로 갈라 단계를 거른다 — 데모 페르소나/시간 단계는 account에 안 나온다. **순서는 첫 별 중심**: ① 빈 우주 안내 + `새 별 띄우기`(행동) → ② 작성 폼(정보)·`별 나누기`(행동)·조각 확인(정보)·`별 띄우기`(행동) → ③ 생성된 별 하이라이트 + 별 클릭(행동) → ④ 회상 패널 설명(정보, job 47 포트레이트·메타·조각/원본) → ⑤ 망원경: 일기 패널(정보)·`별` 탭(행동)·별 패널(정보) → ⑥ 시점 전환·항해 실습(change 12) → ⑦ 테마·페르소나/시간(데모만)·UI 숨김·완료. **데모는 고정 fixture 별/id, 실계정은 실제 작성 결과 별**을 추적해(`compose` 머신 `submitted` payload `{recordId,memoryIds}`) 카메라가 그 별을 frame-all 프레이밍하고 spotlight가 하이라이트한다(서버 좌표 영속 없음 — force-sim 결과 위 투영, 헌법3). **카메라 lock**: 튜토리얼 시작부터 첫 별 클릭/회상 설명 전까지 마우스·터치·키보드 카메라 조작이 잠긴다(`navigation-input` `setTourCameraLocked` — 별 클릭·폼 버튼·HUD는 불간섭); 회상 설명이 끝나면 풀리고 그 뒤 항해 실습이 온다. **행동/정보 phase 분리**(change 34): phase에 `kind: action/info`를 명시해 **행동 phase는 그 행동으로만 진행하고 `다음`이 없으며**(머신이 `NEXT`를 안 받아 `can('NEXT')=false`), 정보 phase만 `다음`으로 넘긴다 — 이미 열린 표면(작성 폼 전체·조각 확인·망원경 일기 패널·회상 패널)은 버튼이 아니라 표면/패널 전체를 정보 하이라이트한다. 시점 전환 항해 실습은 임계값(`spec/values.yaml` `demo_tour`)을 넘기면 자동 진행(rAF 샘플링, 헌법4). 강조는 **딤 + 구멍** + 둘레 **glow 테두리**. target은 `data-tour-id`(HUD·폼·패널)로 찾고, **캔버스 안 생성/fixture 별은 universe-canvas가 live 좌표를 화면 rect로 투영해**(`shared/lib/tour-target` 레지스트리, 씬 안 `<Html>` 없이 — 헌법8) spotlight를 친다. 완료/건너뛰기 → **데모는 `free`로 수렴**, **실계정은 per-user localStorage(`cosimosi:first-star-tour:{userId}`)에 완료 저장**해 자동 재시작 안 함. 사이드바 `둘러보기 다시 보기`로 재진입(데모=고정 fixture 다시, 실계정=현재 우주 비파괴 둘러보기). step은 데모 세션에 저장(새로고침 이어감) | `DemoGuidedTour`·`tour.machine`·`first-star.ts` |
| 새로고침 시 모듈 리로드 → 체험 중 추가한 별·연결·가상 시계 offset·genesis 진행 소멸(진입 흐름·튜토리얼 step은 sessionStorage라 유지). 자유모드면 빈 우주에서 genesis가 처음부터 다시 재생되고(genesis 상태는 휘발성 — 새 세션=새 genesis), 그 외면 정적 base 재생성 | 세션 한정 |
| 화면 코드 동일 — 회상·이웃·잠든 별 동선은 메인 우주와 같은 컴포넌트(데이터 출처는 쿼리 queryFn 안에서 분기). 차이: 하단 `새 별 띄우기`는 실계정·데모 모두 작성 폼이되 데모는 read-only 프리셋 일기·서버 미호출로 분기(change 25) | 기록만 분기 |
| 모드 전환(enter/exit) = 데이터 출처 전환 → 쿼리 캐시·렌더 스토어 전체 리셋([data-sync](../domain/data-sync.md) 출처 경계) — 체험 별이 실계정 우주에 섞이지 않는다 | 경계 리셋 |

### 5. 변천사 보기 (evolution timelapse, 24)

회상 패널(`phase==='shown'`)의 **"변천사 보기"** 진입점으로 그 별이 변해 온 길을 연다 — 우주 캔버스 위 오버레이(별도 라우트 없음, 우주는 뒤에 영속; overlay 셸(tech/overlay-shell.md) 도입 전까지 페이지가 합성). 23이 쌓은 `evolution_history`를 **읽기 전용**으로 스크럽하는 타임랩스다.

| 규칙 | 값 / 조건 |
|---|---|
| 진입점 | 회상 패널 read-only 원본 아래 "변천사 보기" 버튼 → `useEvolutionStore.open(memory_id)`(페이지가 recall→evolution을 콜백으로 배선; 두 feature는 서로 import하지 않음) |
| 데이터 | `GetEvolutionHistory(memory_id)` unary read(헌법6) → `version` 오름차순 스냅샷. 빈 목록=정상("아직 변천사가 없어요 — 최초 모습 그대로") |
| 버전 재현 | 같은 `VizStar`(시그니처 불변): `seed = baseSeed + form_seed_delta·k`(형태 변주)·`brightness`·래퍼 `hue-rotate(hue_shift°)`. `concept`(StarObject)·감정색은 별 전 생애 고정(회상은 색을 통째로 바꾸지 않음) |
| 계기 라벨 | `recall`→"회상" · `new_neighbor`→"새 이웃" · `nightly_gist`→"야간 요지", `dir`로 강화↑/약화↓ 보조 |
| 불변 원본 병치 | 화면 한편에 11의 `RecallMemory` `Record`(body·entry_date·mood)를 읽기 전용 고정 — 슬라이더를 어디로 옮겨도 원본 텍스트는 그대로(헌법1). 캐시(`recordQueryKey`)에서 재사용(새 RPC 없음) |
| 체험(demo) | `demoEvolution(memory_id)`가 ≥3 버전을 결정론적으로 합성(trigger 섞음) → 백엔드 호출 없이 스크럽·재현·원본 병치 |

### 6. 원본 일기·엔그램·별 길찾기 (wayfinding, 28)

원본 일기 ↔ 엔그램(조각) ↔ 현재 별의 **3겹 연결**을 길찾기로 잇는다. 같은 일기의 조각은 태어날 땐 근처에 모이지만 회상·재공고화·재배치로 어디로 흩어졌을지 알 수 없어, 원본 일기로 찾으면 **그 일기의 모든 별을 한눈에 담는 조망 위치를 매번 새로 계산**해 보여준다. 찾기·강조는 모두 **시각 전용** — `records`/`memories`/`memory_links`를 수정·삭제하지 않는다(헌법1·2).

| 갈래 | 동선 |
|---|---|
| **원본 일기로 별 찾기** (조망·하이라이팅) | 우주 탐색기(망원경) **일기 탭**으로 원본 일기 목록(`ListRecords` — 작성일 내림차순·일기별 별 개수·본문 발췌)·검색·감정·날짜 필터 → 일기 하나 선택 → 탐색기 닫힘 + 그 일기(`record_id`)의 **모든 별**을 담는 far 조망으로 fly-to([navigation](../domain/navigation.md) frame-all) + 그 별·일내 시냅스 강조·나머지 dim |
| **엔그램으로 별 찾기** (근접 단일) | 조각(엔그램) 하나 → 그 **단일 별**로 근접 fly-to(`focusStar` 재사용). 근접(`recall`)에서는 단일 엔그램 단위만 — 일기 전체 조망은 far 전환 후([navigation](../domain/navigation.md) near/far 가드) |
| **별 → 조각 → 원본** (3겹 연결) | 별 클릭 회상 패널에 그 별의 **조각 텍스트(`fragment_text`)** 를 기본 표시 + **"원본 일기 전체 보기"**(불변 `Record` body 펼침) + **"이 일기의 다른 별들 보기"**(같은 `record_id` 조망 프레이밍). 편집·삭제 없음(헌법1) |

| 규칙 | 값 / 조건 |
|---|---|
| 강조(하이라이팅) | 선택 일기 별 `aBrightness` 부스트(`FOCUS_BOOST=1.3`)·비강조 별·먼지 dim(`FOCUS_DIM=0.12`, 잠든 별 dust dimming 재사용)·그 일기의 일내(intra) 시냅스만 또렷·나머지 웹 dim. 선택 변경 시에만 재기록(매 프레임 React state 금지) |
| 단일 선택 우선 | 단일 별 포커스(`select`)가 있으면 일기 강조는 적용하지 않는다(근접 포커스 우선); 강조는 far 조망의 상태 |
| 조각 텍스트 캐시 | `fragment_text`도 원본과 같은 불변·영구 캐시(`['record', id, 'fragment']`)에 시드 → 재열람 즉시 표시. 단일 조각/구 데이터는 `""` → 본문으로 폴백(토글 숨김) |
| 딥링크 | `?panel=diary`(레거시 일회성)로 진입하면 우주 탐색기가 일기 탭으로 한 번 열리고 param이 비워진다(`dormant`→별 탭). 별도 `/diary` 라우트 없음 — 우주 셸 위 표면 |
| 일기 카드(선택 후) | 일기를 고르면 탐색기가 닫히고 **그 일기 카드**(날짜·발췌·별 개수·"목록"/닫기)를 하단에 띄운다. "목록"은 탐색기 일기 탭을 다시 연다. 카메라는 그 일기 별들을 화면 위쪽으로(view offset, frame-all 위에 시선만↑) 올려 카드에 가리지 않게 한다 |
| 해제(배경 탭) | 별·일기 조망은 은은한 딤(`Backdrop`)으로 집중을 알린다. **빈 우주를 탭하면**(캔버스 `onPointerMissed`) 강조 해제 + 일기 패널까지 닫혀 우주로 **완전 복귀**; 별을 탭하면 그 조각 회상으로 전환(near/far 가드) |
| 체험(demo) | `demoListRecords`가 더미 별을 `record_id`로 묶어 목록을 만들고, 다조각 일기(흩어진 `demo-rec-scatter` 포함)로 조망+강조를 네트워크 없이 체험 |

### 7. 우주 셸 내비게이션 크롬 (universe-mode UX rework, change 09)

우주 셸(루트 `/`)의 HUD 진입점을 화면 가장자리로 분산해 우주에 집중시킨다. 상세 합성은 [tech/overlay-shell](../tech/overlay-shell.md). 모든 HUD는 캔버스 밖 2D DOM이라 어떤 토글/표면도 WebGPU 캔버스를 언마운트하지 않는다(헌법8).

| 갈래 | 규칙 / 동선 |
|---|---|
| **우상단 세로 컨트롤 스택** | 위에서부터 ① 햄버거(Menu)→사이드바, ② 카메라 시점 토글(Orbit — 멀리서 내 우주 보기↔별들 가까이서 탐험하기, `TOGGLE_MODE` change 08), ③ 망원경(Telescope)→우주 탐색기. 표면이 아니라 상시 노출 버튼 |
| **사이드바 (햄버거)** | 우측에서 슬라이드인하는 **차단형** 드로어(`SideDrawer`) — 딤 backdrop·탭/Esc/✕로 닫힘·열릴 때 포커스 진입·reduced-motion. 항목 순서: 로그아웃(데모면 "체험 종료") · 마이페이지 · 구분선 · 우주 공개 · 주고받은 별 · 구분선 · 일기. 데모는 마이페이지·우주 공개·주고받은 별을 숨긴다. **작성 항목 없음**(작성은 하단 중앙 버튼). 로그아웃이 여기로 수렴하므로 우주 셸에선 `SessionGate` 우상단 로그아웃 pin을 억제한다 |
| **우주 탐색기 (망원경)** | 비차단 표면(모바일 바텀시트/데스크톱 떠있는 카드). 탭 둘 — **일기**(원본 일기 목록 + 검색·감정·날짜 범위 필터; 선택 → 일기 조망 §6) · **별**(AWAKE+DORMANT 별을 `lastRecalledAt` 오름차순 한 목록으로 + 검색·감정·날짜·잠듦(전체/깨어있는/잠든 별) 필터 + "N일 전 회상"; 선택 → 그 별로 fly-to). **잠든 별 전용 진입점은 폐기**되어 별 탭에 흡수됐다 |
| **UI 숨기기 토글 (상단 중앙)** | Eye/EyeOff. "UI 숨기기"는 모든 표면을 닫고 포커스·변천사를 해제한 뒤, 토글 자신을 뺀 모든 HUD를 숨긴다(캔버스는 그대로 — 우주만 남김). "UI 보이기"로 기본 HUD 복구 |
| **새 별 띄우기 (하단 중앙)** | 떠있는 Plus 버튼. 실계정·데모 모두 작성 `MemoryForm` 표면을 연다 — 실계정은 빈 자유 입력, **데모는 read-only 프리셋 일기**(change 25 — §4). UI 숨김 시 함께 숨는다 |
| **테마 pill (좌상단)** | 위치 불변. 꾸미기 표면(`AppearancePanel`, change 10)을 연다 — **스킨 4축만**, 실제 우주 옆 split panel(데스크톱=좌측 사이드바·모바일=하단 패널, 캔버스를 덮지 않고 폭/높이만 줄인다). 감정 색 편집은 `/my-page`로 이동(스킨과 분리) |
| **NavPad 억제** | 근접 모드 비행 D-pad는 `suppressed`면 숨긴다 — 사이드바·탐색기·임의 표면이 열렸거나 UI가 숨겨졌을 때. 숨기는 순간 이동을 0으로 정지(pointerup 유실로 우주가 계속 전진/회전 방지) |
| 체험(demo) | 사이드바·탐색기·뷰 컨트롤은 동일하되, 사이드바에서 마이페이지·소셜이 빠지고 로그아웃이 "체험 종료"로, 하단 중앙 버튼이 read-only 프리셋 작성 폼으로 분기한다(change 25). 좌상단 테마 아래에 데모 페르소나/시간 버튼이 더해진다(plan 47). 자유모드(free) 전에는 온보딩 오버레이가 HUD를 가린다 |

## 불변식 (invariants)

- **원본 편집·삭제 UI 없음 (헌법1).** 회상 패널·변천사 화면 모두 read-only `Record`만 보여준다. 변천사 슬라이더를 어디로 옮겨도 원본은 불변이며, 어떤 상호작용도 `records`를 UPDATE/DELETE하지 않는다. 변천사 조회(`GetEvolutionHistory`)는 read-only(INSERT/UPDATE/DELETE·`RETURNING *` 없음).
- **별·시냅스 삭제 금지 (헌법2).** 낙관적 롤백은 `temp-` 접두 임시 별만 제거하며, 서버에서 온 별·엣지는 절대 제거하지 않는다.
- **능동 인출이 강화의 유일한 트리거.** `<DWELL_MS` 스침·단순 전환은 회상·공동 회상으로 카운트되지 않는다.
- **공동 회상은 멱등하게 영속.** 같은 `batch_id` 재전송은 두 번 가산되지 않는다.
- **unary 전용 (헌법6).** 회상·강화·기록·잠든 별 조회는 모두 unary 호출이며 스트리밍·폴링이 없다. 신규 별의 시냅스는 다음 `GetUniverse` refetch에서 받는다.
- **좌표는 서버에 쓰지 않음 (헌법3).** 어떤 상호작용도 좌표를 영속하지 않는다(서버는 가중치 그래프만).
- **HUD는 캔버스 밖 2D DOM (헌법8).** 폼·회상 패널·이웃 항해는 R3F 씬 안 `<Html>`로 넣지 않는다.

## 구현 근거

- **회상:** 구현: plan 11 · `frontend/src/features/recall/ui/MemoryPanel.tsx`(dwell 타이머·read-only 패널)·`ui/NeighborNav.tsx`(이웃 항해, 선택 전환만)·`api/recall.ts`(`RecallMemory`).
- **공동 회상:** 구현: plan 11 · `frontend/src/features/recall/model/co-recall.ts`(`CO_RECALL_DELTA`·`DWELL_MS`·`DEBOUNCE_IDLE_MS`·`pairKey`·`spacingBoost`)·`model/recall-flush.machine.ts`(XState — 디바운스·재시도·flush 직렬화 — tech/state-machines.md)·`pages/home/ui/HomePage.tsx`(`beforeunload`/`visibilitychange` flush)·`shared/api/transport.ts`(keepalive).
- **기록:** 구현: plan 10 · `frontend/src/features/record-memory/ui/MemoryForm.tsx`(본문+감정 `Dropdown`+강도+날짜)·`model/draft-store.ts`(기본 오늘·13종 mood, spec 29)·`model/use-record-memory.ts`(낙관적 add/replace/remove).
- **잠든 별 재점화 동선:** 구현: plan 12 + overlay 셸(tech/overlay-shell.md) · `frontend/src/features/star-explorer`(`StarExplorerList`)·`entities/memory/model/activation.ts`(`isDormant`)·`entities/memory/api/dormant-query.ts`(`dormantInvalidateKey`). 잠든 별 탐색은 별도 진입점이 아니라 우주 탐색기(망원경) **별 탭**에 흡수됐다 — AWAKE+DORMANT 별을 `lastRecalledAt` 오름차순 한 목록으로 보여주고 잠듦(전체/깨어있는/잠든 별)·감정·날짜·검색 필터를 제공한다. 별 선택 시 뒤 우주 fly-to([navigation](../domain/navigation.md) 우주 셸 영속).
- **변천사 보기:** 구현: plan 24 · `frontend/src/features/evolution/{api/evolution.ts,model/{history.ts,store.ts},ui/EvolutionPanel.tsx}`(unary read·순수 model·스크럽 타임랩스+불변 원본 병치)·`features/recall/ui/MemoryPanel.tsx`("변천사 보기" 진입점)·`pages/home/ui/HomePage.tsx`(오버레이 합성·콜백 배선)·`shared/lib/demo/data.ts`(`demoEvolution`). BE read RPC는 plan 23(`GetEvolutionHistory`).
- **길찾기(원본 일기·엔그램·별):** 구현: plan 28 · `frontend/src/features/diary-list/ui/DiarySheet.tsx`(우주 탐색기 일기 탭·검색·감정·날짜 필터)·`entities/memory/api/records-query.ts`(`recordsQueryOptions`/`recordsInvalidateKey` — 소비처가 두 레이어라 dormant/universe처럼 entity 소유; record 성공 시 무효화)·`features/wayfinding/{model/frame.ts,model/store.ts}`(순수 frame-all·강조/프레임 상태)·`features/recall/ui/MemoryPanel.tsx`(조각 텍스트+원본 전체+다른 별 동선)·`entities/star/ui/StarField.tsx`·`entities/synapse/model/store.ts`(`edgesWithin`)·`widgets/universe-canvas/ui/UniverseCanvas.tsx`(`FrameAllController`/`NearFarHighlightGuard`·강조 렌더)·`pages/home/ui/HomePage.tsx`(오버레이 합성·콜백 배선·`?panel=diary`). BE는 `ListRecords` rpc + `Star.record_id`/`fragment_index` + `RecallMemoryResponse.fragment_text`.
- **체험:** 구현: plan 11·12 데모 분기 + plan 19 시뮬레이션 + plan 47 자유모드 온보딩 + plan 48 스포트라이트 투어 · `frontend/src/shared/lib/demo/flag.ts`(`enterDemoMode`/`isDemoMode`·진입 흐름 `getDemoFlow`/`setDemoFlow`/`resetDemoFlow`·튜토리얼 `getTutorialStep`/`setTutorialStep`/`enterTutorialMode`/`completeTutorial`/`restartTutorial`)·`shared/lib/demo/session.ts`(`startDemoSession`)·`widgets/demo-tour`(`DemoGuidedTour`·`tour.machine`·순수 `TOUR_STEPS`·`use-tour-target`)·`shared/lib/demo/data.ts`(더미 우주·`demoMarkRecalled`·프리셋 작성 `beginDemoCompose`/`demoComposeSegments`/`demoRecordMemory`·production 식 연결 생성·`demoConsolidate` change 20 포트·30일 genesis `ensureSeeded` 분기/`advanceDemoGenesis`/`ensureDemoGenesisArmed` change 28)·`shared/lib/demo/genesis.ts`(genesis 입력 난수·`startGenesis`/`planNextGenesisDay`/`isGenesisActive` change 28)·`shared/lib/{memory-physics.ts,demo/diary-presets.ts}`(공유 순수 물리·프리셋 풀 `pickDiaryPreset`/`pickGenesisDiary`)·`shared/lib/demo/clock.ts`(`virtualNowMs`·배속 연속 시계 `advanceDemoClock`/`getDemoClockSpeed`/`setDemoClockSpeed`/`consolidationBoundariesCrossed`)·`features/recall/api/recall.ts`(demo no-op/recall)·`features/recall/model/recall-flush.machine.ts`(accumulate에서 데모 헵 로컬 bump)·`entities/synapse/model/store.ts`(`bumpEdgeWeight`)·`entities/memory/api/universe-query.ts`(`refreshActivation`)·`widgets/demo-sim`(`tickDemoClock`·`switchDemoPersona`·`resetDemoExperience`)·`pages/home/model/use-demo-flow.ts`(배속 흐름 rAF 드라이버·시계 상태)·`pages/home/ui/{HomePage,DemoOnboarding,DemoFreeModeControls,tour-actor}.ts(x)`(데모 흐름 게이트·자유모드 컨트롤·배속 셀렉터·투어 actor·랜덤 별).
- **불변식:** 헌법 1·2·3·6·8(`spec/plan/00.overview.md`).
