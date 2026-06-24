# cosimosi Architecture

이 문서는 cosimosi 프로젝트의 코드 구조와 그 결정 근거를 정리한다.
[concept.md](../concept.md)가 "무엇을 만드는가(엔그램 우주)"라면, 이 문서는 **"어떻게 만드는가"**다. 작업 진행 상태와 단계별 체크리스트는 [plan/](../plan/)의 번호별 스펙.

요지는 세 줄이다.

- **프론트엔드**: [Feature-Sliced Design (FSD)](https://feature-sliced.design/) — 공식 사양 v2. 렌더링은 **React Three Fiber 9 + three.js `WebGPURenderer` + TSL**(WebGL2 자동 폴백).
- **백엔드**: Go의 **package-by-feature + 헥사고날 규율**. 데이터는 **sqlc + pgvector + 가중치 그래프(memory_links)**, API는 **Connect RPC + Protobuf**, AI는 **공급자 추상화 + 비동기 워커**.
- **모바일**: **React Native** 트랙(deferred). 웹과 도메인·상태·시뮬레이션·셰이더·API 클라이언트를 공유하도록 지금부터 구조를 격리한다.

> 이 문서는 **결정 사항의 기록**이다. 실제 인프라 구성·마이그레이션·코드 작성은 [plan/](../plan/)의 번호별 스펙(체크박스)을 따라 진행한다.

---

## 1. 한눈에

```
cosimosi/
├── spec/                      ← 기획·아키텍처·작업 스펙
│   ├── concept.md             ← 비전(엔그램 우주) — 무엇을/왜
│   ├── Architecture.md        ← 이 문서 — 어떻게
│   └── plan/                  ← 번호별 작업 스펙(체크박스). 00.overview.md가 색인
├── proto/                     ← .proto 단일 계약 (Connect RPC) — 신설 예정
├── frontend/                  ← React 19 + Vite 8 + R3F 9 (WebGPU+TSL) + Zustand (FSD)
│   └── src/
│       ├── app/               ← 진입점·프로바이더·전역 스타일
│       ├── pages/             ← 라우트 단위 화면
│       ├── widgets/           ← 자족적 큰 UI 블록 (예: universe-canvas)
│       ├── features/          ← 사용자 행동 (예: record-memory, recall)
│       ├── entities/          ← 도메인 객체 (memory, star, synapse)
│       └── shared/            ← 도메인 무관 공용 (ui, lib/force-sim, lib/shaders, lib/r3f, api, config)
└── backend/                   ← Go 1.26 + connect-go + pgx + sqlc + pgvector (package-by-feature)
    ├── cmd/api/               ← 컴포지션 루트 (HTTP/RPC 서버)
    ├── cmd/worker/            ← 비동기 AI 파이프라인 워커 — 신설 예정
    └── internal/
        ├── memory/            ← 기능: 기억(별) — 일기 원본·분류·비주얼
        ├── link/              ← 기능: 시냅스(가중치 그래프)
        ├── ai/                ← 공급자 추상화 (Embedder, Extractor 포트 + 어댑터)
        ├── job/               ← 비동기 작업 큐
        ├── platform/          ← config, postgres, rpcserver (인프라)
        └── db/                ← sqlc 입력(queries, migrations) + 출력(gen)
```

**의존 방향은 양쪽 모두 한쪽으로만 흐른다.** 프론트는 `app → pages → widgets → features → entities → shared`, 백엔드는 `RPC 핸들러 → service → repository(인터페이스) → 도메인`으로 안쪽으로만.

> `proto/`, `cmd/worker/`, `internal/{link,ai,job}`은 **신설 예정**이다(상세는 plan/ 스펙).

---

## 2. 프론트엔드: Feature-Sliced Design

### 2.1 왜 FSD인가

- **명시적 사양이 있다.** 공식 사이트가 레이어·임포트 규칙·세그먼트 이름을 못 박는다. 검증 가능한 구조.
- **R3F·Zustand·feature-rich SPA와 잘 맞는다.** 자족적 큰 UI 블록(`<Canvas>`)이 `widgets`에 정확히 들어간다.
- **확장이 선형적이다.** 별·시냅스·뷰·상호작용이 늘어도 슬라이스/세그먼트를 더하며 평탄하게 자란다.

### 2.2 6 레이어 (위 → 아래)

| 레이어 | 한 줄 정의 | 엔그램 예시 |
|---|---|---|
| **`app`** | 라우팅·진입점·프로바이더·전역 스타일 | `App.tsx`, `styles/index.css` |
| **`pages`** | 라우트 단위 화면 | `home`(우주), `dormant`(잠든 별 탐색) |
| **`widgets`** | 자족적 큰 UI 블록 | `universe-canvas` (R3F `<Canvas>` + WebGPU 렌더러 + 씬 셸) |
| **`features`** | 사용자에게 가치를 주는 행동 | `record-memory`(일기 작성), `recall`(별 회상·강화) |
| **`entities`** | 도메인 객체 | `memory`(기억), `star`(별 시각), `synapse`(시냅스 시각) |
| **`shared`** | 도메인 무관 재사용 | `ui`, `lib/force-sim`, `lib/shaders`, `lib/r3f`, `api`, `config` |

> `processes`는 deprecated — 쓰지 않는다. 모든 레이어를 다 쓸 필요는 없다(필요할 때만 추가).

#### 2.2.1 공유는 미리 짓지 않는다 — promote-on-reuse

공유 레이어(`entities`/`shared`)는 **미리 설계하지 않는다**. 개발 중 **실제 재사용이 드러날 때** 비로소 위쪽 레이어(`pages`/`widgets`/`features`)에서 아래 레이어로 **추출(promote)**한다. 처음엔 한 슬라이스 안에 두고, 두 번째 소비자가 생기는 순간 끌어내린다 — 추상화는 사용처가 증명한다.

- **`entities`는 도메인 타입·로직만.** UI 컴포넌트의 상태나 feature 고유 상태는 올리지 않는다(상위 레이어에 둔다).
- **`shared`는 도메인 무관 재사용만.** 도메인 어휘가 묻은 것은 `entities`로.
- 근거: FSD 공식 가이드의 "needs-driven / 미리 추상화하지 말 것" 원칙. (모바일 승격 §3.4과도 정합 — `model`은 순수 유지, 추출 시 import 방향 보존.)

### 2.3 임포트 방향 규칙

```
app  ──►  pages  ──►  widgets  ──►  features  ──►  entities  ──►  shared
```

- 화살표는 임포트 방향. 위에서 아래로만 — 한 슬라이스는 **자기보다 아래 레이어**의 슬라이스만 import한다(공식 "import rule on layers").
- **같은 레이어의 다른 슬라이스끼리 직접 import 금지.** 유일한 예외: **`entities` 간 교차 참조는 `@x` 공개 API로만**(공식 cross-import 규약, entities 레이어 한정).
  - 제공자 entity `A`가 소비자 `B` 전용 공개 API를 둔다: `entities/A/@x/B.ts` (일반 공개 API는 `entities/A/index.ts`).
  - 소비자 `B`의 코드는 **그 교차 API에서만** 가져온다: `import type { Foo } from '@/entities/A/@x/B'` (`A/@x/B` = "A를 B에 맞춰 교차 노출"). `entities/A/index.ts`를 직접 import하지 않는다.
  - 공식 권고: 교차 참조는 **최소화**하고 "제거가 비합리적일 때만" 쓴다. 가능하면 공유 조각을 `shared`로 내리거나 상위(`widgets`/`pages`)에서 조합해 교차 참조 자체를 없앤다.
- `app`·`shared`는 슬라이스 구분 없이 어디서든 참조 가능.
- 추후 `eslint-plugin-boundaries`/`@feature-sliced/steiger`로 강제.

> **현재 entities 간 교차는 모두 `@x` 적용 완료:**
> - `entities/memory/@x/star.ts` → star의 `StarField`가 구독하는 `useMemoryStore`·`starBrightness`
> - `entities/synapse/@x/memory.ts` → memory의 `getUniverse`가 동기화하는 `useSynapseStore`·`toSynapseEdge`
> - `entities/star/@x/appearance.ts` → appearance store가 참조하는 `StarLook`·`STAR_LOOKS`·`parseStarLook`(change 29)
> - `entities/star/@x/synapse.ts` → `VizSynapse`의 `concept`(`StarLook`) 타입
>
> 새 교차 참조가 필요하면 같은 식으로 제공자에 `@x/{소비자}.ts`를 두고 거기서만 가져온다. (widgets·features·pages가 entities를 쓰는 건 하위 레이어 import라 일반 `index.ts`를 쓴다 — `@x`는 entities 간에만.)

### 2.4 슬라이스 + 세그먼트

- **슬라이스**: 도메인 어휘 폴더(`star`, `universe-canvas`, `record-memory`).
- **세그먼트**: 기술적 성격 폴더 — `ui`(컴포넌트·셰이더 바인딩), `model`(타입·스토어·로직, **Zustand는 여기**), `api`(백엔드 호출·매퍼), `lib`(슬라이스 내부 전용), `config`.
- `components/`·`hooks/`·`types/` 같은 일반 이름 금지(공식 안티패턴).

### 2.5 Public API 규칙

슬라이스는 자신의 `index.ts`로만 외부 노출. 슬라이스 내부 파일을 외부에서 직접 임포트 금지. **와일드카드 배럴(`export *`) 금지** — 노출 심볼만 명시.

### 2.6 네이밍

- 슬라이스/폴더: `kebab-case`, **단수** 기본 (`star`, not `stars`).
- **컴포넌트 파일: `PascalCase`** (`HeroSection.tsx`, `GlassCard.tsx`) — 기존 `App.tsx`·`HomePage.tsx`와 일관.
- 비컴포넌트 모듈(훅·스토어·유틸·설정·`index.ts`): `kebab-case`/`camelCase` (`use-record-mood.ts`, `query-client.ts`).
- React 컴포넌트 export 이름: `PascalCase`, 가능한 한 named export.

### 2.7 Zustand 스토어 위치

- 비즈니스 객체 **데이터**(별 목록, 그래프, ambient) → `entities/<entity>/model/`
- 사용자 행동 **데이터**(작성 드래프트 텍스트, 개인 설정) → `features/<feature>/model/` 또는 widget의 `model`
- 진짜 글로벌 데이터(테마) → `app/`
- **스토어를 `lib`/`api`에 넣지 말 것.** 단, force-sim 결과 좌표 버퍼처럼 고빈도 데이터는 스토어 대신 ref/worker 메시지로(리렌더 회피).
- ⚠️ **제어 상태(control state)는 zustand가 아니라 상태 머신(§2.8)** — mode·phase·lifecycle·배타 selection(카메라 모드, 포커스 대상, 작성 단계, 세션)은 XState로. zustand는 **값·컬렉션(데이터)** 만 든다.

### 2.8 상태 머신 (XState)

cosimosi는 일기 앱이 아니라 **우주를 항해하는 게임**이다 — 카메라가 성운/회상/비행/조망을 오가고, "무엇에 집중하나"가 배타 모드로 갈린다. 이런 **제어 상태(mode·phase·lifecycle·배타 selection)** 는 nullable 필드 + 동기화 이펙트로 흩뜨리면 같은 논리 상태를 두 곳이 다르게 표현해 불일치가 난다. 그래서 제어 상태는 **XState v5 상태 머신**으로 단일화하고, **데이터는 zustand/Query**로 분리한다(§2.7).

- **제어 상태 vs 데이터:** "N개 배타 상황 중 하나" → 머신. 값·컬렉션(별 배열·그래프·캐시·좌표 버퍼) → zustand/Query/ref. **데이터를 머신 context로 옮기지 않는다**(id 참조만). 고빈도 연속값(매 프레임 lerp·`move`·drag)은 머신 이벤트로 흘리지 않는다.
- **배치(FSD):** 머신은 소유 레이어의 `model/<name>.machine.ts`(순수 TS — 헌법4 충족). React 바인딩(`@xstate/react`)·R3F 연동(`useFrame`+`getSnapshot`)은 `ui`에서만. 엔티티는 머신 스냅샷 파생 props로 렌더만.
- **R3F per-frame:** WebGPU 루프는 React 렌더가 아니라 `actorRef.getSnapshot()`로 매 프레임 읽고, 임계 도달 시 `send`. 컨트롤러에서 `useMachine` 금지(§3.2 "60fps에 React state 금지"와 정합).
- **핵심 머신:** 항행(camera, widget) · 포커스(interaction, feature) 두 Core + 세션(app)·작성(record-memory)·회상 flush(recall) lifecycle.

> 상세 — 전체 카탈로그·두 Core 상태도·나브↔포커스 계약은 **[state-machines.md](state-machines.md)**, 작성 규약·v5 API·테스트·안티패턴은 **[xstate-guide.md](xstate-guide.md)**.

---

## 3. 엔그램 렌더링

### 3.1 렌더링 스택 — R3F 9 + WebGPURenderer + TSL

엔그램 우주는 본질이 **force-directed 그래프 시각화**(수천 별 인스턴싱 + 수천 fat-line 시냅스 + 매 프레임 갱신)다. 이 워크로드의 사실상 표준 생태계(`d3-force-3d` → `three-forcegraph` → `r3f-forcegraph`)는 전부 React 1차 타깃이라 **R3F 9를 유지**한다.

렌더러는 **three.js `WebGPURenderer`** 를 채택한다.

- **이유:** 드로우콜 오버헤드가 작아 대규모 그래프에 유리하고, compute 셰이더로 시뮬레이션 오프로딩 여지가 있으며, **모바일(react-native-webgpu)이 같은 WebGPU**라 웹/모바일이 한 미래로 수렴한다.
- **안전망:** `WebGPURenderer`는 WebGPU 미지원 환경에서 **WebGL2로 자동 폴백**한다. 2026년 기준 주요 브라우저가 WebGPU 정식 지원.
- **셰이더는 TSL(Three Shading Language)로 작성한다.** TSL은 한 번 작성하면 WebGPU(WGSL)·WebGL2(GLSL) 양쪽으로 자동 컴파일 → **웹↔모바일 셰이더 공유**, GLSL→TSL 재작업 없음.
- **포스트프로세싱(Bloom):** WebGL 전용인 `@react-three/postprocessing` 대신 **three.js 노드 기반 후처리(WebGPU 진입점)** 를 쓴다. ⚠️ **버전 고정:** 채택 three **0.184** 기준. 후처리 클래스명은 three 최신(r183+)에서 **`PostProcessing` → `RenderPipeline`로 리네임 진행 중**이라, plan/ 스펙은 핀 버전(0.184)의 정확한 명칭을 확인해 고정한다(버전 변동 시 명칭 바뀔 수 있음). `bloom` 노드 import 경로 = **`three/addons/tsl/display/BloomNode.js`**, 렌더러/클래스는 `three/webgpu`. (`@react-three/postprocessing`은 WebGL 전용이라 의존성에서 제거 대상 — plan/ 스펙에서 처리)
- **R3F 연결:** `<Canvas>`의 `gl`에 비동기로 `WebGPURenderer`를 생성·`await renderer.init()` 후 반환한다.
- **TSL/R3F 타입 경계:** three/R3F의 런타임 그래프 API가 공개 TS 오버로드보다 넓은 곳은 `shared/lib/r3f`가 경계를 소유한다. `createRendererFactory`·`asWebGPURenderer`·`useWebGPURenderer`·`useOrbitControls`가 renderer/controls narrowing을, `asFloatNode`·`asVec3Node`·`uniformColorNode`·`attribute*Node`가 TSL node conversion을 담당한다. 호출부에는 `as never`나 반복 `as unknown as GLProps`를 두지 않는다.
- **셰이더 아트 툴킷(plan 50):** 도메인 무관 절차적 셰이더/지오메트리 **기법**은 `shared/lib/r3f/shader-art`가 소유한다 — 이펙트 패밀리(`noise`·`field`·`pattern`·`finish` → 색/마스크 노드)와 오브젝트 패밀리(`sdf`·`geometry` → 형태). 전부 순수(노드/지오메트리 in/out, material·uniform·store·도메인 미의존, 시간은 파라미터 노드로 — frozen-time). **스킨(도메인)** 은 `entities/*/ui`가 이 툴킷을 조립해 만들고(배경=`entities/appearance/ui`, 별=`entities/star/ui`, 시냅스=`entities/synapse/ui`), **widget** 은 스킨 수와 무관하게 N-제네릭(registry/`for`)으로 분기만 한다(plan 51·52). `entities/model`·순수 `shared/lib`은 툴킷·`three`를 import하지 않는다.
- **코드 주석 정책:** 렌더링 코드는 현재 invariant, 플랫폼 제약, FSD 경계, 보안/세션/연기 게이트처럼 유지보수자가 즉시 알아야 할 사실만 남긴다. 변경 번호·과거 수치 조정·구현 일지는 `spec/changes`·`spec/jobs`에 둔다.
- **drei 갭:** 일부 WebGL 전제 헬퍼·`Html`/`Loader`는 WebGPU/모바일에서 제약이 있다. **씬 안에 DOM `Html`을 넣지 않는다** — 라벨/HUD는 three 오브젝트(Sprite/Troika 텍스트) 또는 별도 2D HUD widget으로 분리(모바일 이식성).

### 3.2 성능 아키텍처 — 시뮬레이션 분리 · 렌더러 격리 · 인스턴싱

> **연구 핵심 인사이트:** "렌더러 0.x% 차이보다 **force-directed 시뮬레이션 오프로딩**과 **InstancedMesh 배칭**이 체감 성능을 훨씬 좌우한다." 따라서 다음을 처음부터 구조에 박는다.

1. **시뮬레이션을 렌더에서 분리.** `shared/lib/force-sim`에 **순수 `tick(dt)` 모듈**로 둔다. 입력=노드/엣지 배열, 출력=좌표 `Float32Array`. 내부에 `requestAnimationFrame`/`useFrame`을 넣지 않는다. 수천 노드는 O(N²)을 피해 **Barnes-Hut quadtree** 사용. 웹은 **Web Worker**, 추후 모바일은 worklet/WebGPU compute로 호출만 바꾼다.
2. **렌더는 좌표를 받아 그리기만.** `useFrame`에서 `InstancedMesh.matrix`/셰이더 uniform만 갱신한다. **React state로 60fps 구동 금지**(리렌더 폭발).
3. **인스턴싱·배칭 우선.** 별 = `InstancedMesh`(수천 노드를 소수 draw call), 시냅스 = `Line2`/배칭(가변 두께 fat-line). 처음부터 이 전제로 설계.
4. **렌더러 경계.** 도메인 그래프 타입은 각 entity(`entities/memory`, `entities/synapse`)가 소유하고, R3F 구현은 `widgets/universe-canvas`·`entities/*/ui`에만 가둔다. 현재 제품 경로가 쓰지 않는 추상 렌더러 포트는 제거됐다. **도메인 코드가 `three`/R3F 타입을 직접 import하지 않게** 한다 → 모바일에서 WebGPU/Filament로 바꿔도 UI 구현만 교체.

### 3.3 R3F 컴포넌트 배치 (엔그램)

| 무엇 | 어디 | 이유 |
|---|---|---|
| `<Canvas>` + WebGPU 렌더러 + 조명·카메라·Bloom 노드 (후처리는 `RenderPipeline`/`PostProcessing` — three 0.184 핀 기준 명칭 확인, §3.1) | **widgets** — `widgets/universe-canvas/ui/UniverseCanvas.tsx` | 자족적 큰 UI 블록. **Bloom 패스(`BloomPass`, RenderPipeline)는 `shared/ui/BloomPass.tsx`로 분리**해 universe-canvas와 CosmosScene(plan 43)이 공유 |
| 별 인스턴스 렌더 + TSL 머티리얼 | **entities** — `entities/star/ui/StarField.tsx` | 도메인 시각화. **(룩×추상화-단계) 버킷마다 InstancedMesh 1개**(change 29·헌법8 개정) — 단계별 실제 지오메트리(다면체 면 수·고슴도치 가시·액체→구름)를 그리되 메시 수는 별 수가 아니라 단계 수에 비례하는 상수. 같은 버킷 안 별의 고유함은 per-instance 시드를 TSL 변위로 표현. 모든 버킷이 같은 uniform(time·camera·self-light) 공유, capacity는 청크(64)라 별 추가마다 재생성 안 함. 좌표·focus·raycast·탄생/공명 빌보드는 글로벌↔버킷 슬롯 매핑으로 라우팅 |
| 별 본체 시각 정의(룩×단계 geometry + TSL 셰이딩) | **entities** — `entities/star/ui/star-body.ts` (`buildStarBody(look, stage)`, plan 42·53) | 입력 바인딩(attribute/uniform)이 추상화된 **별-바디 프리미티브**(순수: geometry+material만 반환). 룩(`STAR_LOOK_BUILDERS`)×빌드타임 단계로 toolkit geometry(`polyhedronForStage`·`spikyGeometry`, plan 50) + emissive 셰이딩 조립. 위치·움직임·time uniform 소유는 소비처(우주 `StarField`=attribute·단계 버킷, 단일 `widgets/star3d/Star3D`=uniform). `three`만 의존 → 라이브러리 추출 가능. 소비처가 자기 씬에 꽂으므로 배경과 한 캔버스 합성도 가능(`CosmosScene`, plan 43) |
| 공유 배경 합성(배경 fluid 앞/뒤 + 트윙클 + 별 + Bloom 한 씬) | **widgets** — `widgets/cosmos-scene/ui/CosmosScene.tsx` (plan 43) | 사인인·초대·랜딩이 공유하는 **디커플드 재사용 씬**. prop(별·팔레트·품질)만 주입 — appearance/FSM 미의존(라이브러리화 토대). 별 본체는 `buildStarBody`(uniform 바인딩) 소비, glow는 `BloomPass`(공유). fullscreen fit ortho(`manual=true`), demand+fps 스로틀·quality 다운그레이드 |
| 시냅스 렌더 + 가중치→가닥 수/밝기/펄스 TSL | **entities** — `entities/synapse/ui/SynapseFilaments.tsx` + `SynapseDust.tsx` | 도메인 시각화 |
| 별 회상·강화, 근접 항해 | **features** — `features/recall/` | 사용자 가치 행동 |
| force-sim, 셰이더 소스, 렌더러 셋업 | **shared/lib/{force-sim,shaders,r3f}** | 도메인 무관 |

### 3.4 모바일 재사용 전략 — React Native 트랙 (deferred)

웹이 React/R3F이므로 모바일은 **React Native** 트랙을 쓴다. 이유: RN은 도메인·상태·시뮬레이션·셰이더·R3F 씬 그래프·Connect 클라이언트까지 대부분 공유한다(Flutter는 `.proto` 계약 외 공유가 없어 사실상 앱을 두 번 만드는 것).

**단 "렌더러 선택"을 "트랙 선택"에서 분리한다.** R3F 모바일 렌더러는 2026년 현재 과도기(`@react-three/fiber/native`(expo-gl)는 버전 충돌·성능 문제, `react-native-webgpu`는 production-capable-but-evolving)이므로:

- **트랙:** RN + TS + Zustand + Connect(unary). 모노레포 승격 대비해 FSD 임포트 방향을 깨끗이 유지.
- **모바일 착수 시 결정:** 렌더러. **목표는 `react-native-webgpu` + three `WebGPURenderer` + TSL**(웹과 동일). 출시 안정성이 급하면 `react-native-filament`(고성능·R3F 미재사용) 폴백 검토.
- **지금 해야 할 일은 렌더러 교체 비용을 0에 가깝게 만드는 격리**(§3.2 port). 구체 규칙:
  - `entities/*/model`·`shared/lib/{force-sim,shaders}`·`shared/api`·`shared/config` = **순수/공유 레이어**. `three`/React/DOM import 금지(셰이더는 TSL 소스로).
  - `app`·`pages`·`widgets/ui`·`entities/*/ui` = **플랫폼 레이어**(렌더링·HUD). 플랫폼 분기는 여기서만(`*.native.tsx`). **`model`에는 `.native` 분기 금지.**
  - 모바일 추가 시 `pnpm workspace`로 `packages/core`(공유) · `apps/web` · `apps/mobile`로 승격. 핵심: `ui→model` import OK, `model→ui/three/react` import 금지.
- ⚠️ **Connect 스트리밍은 RN 미지원**(connect-es가 RN fetch 한계로 unary만). 따라서 회상 강화 등 실시간 갱신을 **서버 푸시 스트리밍으로 설계하지 않는다** → 클라 로컬 시뮬레이션 + unary 배치 영속(§4.4).

- **데모 parity 계약(change 27).** 체험 모드는 서버 없이 도는 클라 시뮬레이션이라 백엔드 비즈니스 로직(Go: `internal/job`·`internal/memory`)을 FE로 *충실히 포팅*한 거울이다 — "비슷해 보이는 별도 구현"이면 서버가 바뀔 때 조용히 드리프트한다(추상화 단계가 데모에서 영영 0이던 버그가 그 예). 드리프트를 막는 두 수단: **(a)** 공유 가능한 결정론 식(Bjork weight·자아 거리 반지름·추상화 단계·감쇠·재공고화 PE 재성형·감정 유사도)은 플랫폼 무관 순수 함수로 `shared/lib`(`memory-physics`)에 두고 **데모와 실렌더가 같은 함수를 import**한다(중복 구현 금지). **(b)** Go↔TS로 갈릴 수밖에 없는 핵심 로직(공고화 단계 승급·링크 가중치)은 **골든 픽스처 대조 테스트**(`memory-physics.test.ts`: 동일 입력→Go 식의 알려진 출력)로 동치를 못 박는다 — 서버 식이 바뀌면 테스트가 깨져 명시적으로 따라가게 한다. **환원 불가 경계:** 임베딩·LLM은 데모에 없어 의미 KNN(시드 그래프 topic-cosine)·조각화·감정 추출은 **명시적 근사·프리셋**으로 남고, 그 경계를 코드·문서에 표기한다(나머지 결정론 로직은 서버와 동치). FSD 주의: 데모(`shared/lib/demo`)는 `entities`를 import할 수 없으므로 공유 식은 반드시 `shared/lib`에 산다(`entities/memory`는 거기서 re-export).

---

## 4. 백엔드: Package-by-Feature + 헥사고날 규율

### 4.1 왜 sqlc인가

Go 커뮤니티 2025–2026 합의대로 풀 Clean Architecture/ORM 대신 **package-by-feature + sqlc**를 쓴다. 핵심 워크로드가 단순 CRUD가 아니라 **벡터 유사도·재귀 그래프·원자적 가중치 강화**라, ORM 추상화의 이득이 거의 없고 raw SQL/sqlc의 통제가 정확히 필요하다.

- **sqlc는 이미 repository다**(sqlc 이슈 #2467). 그 위에 ORM을 또 얹지 않는다.
- **인터페이스는 소비자(서비스) 측에 선언**한다 — 관용적 Go.
- sqlc **v1.23+**는 pgx/v5에서 `vector` 컬럼을 `pgvector.Vector`로 **자동 생성**(타입 오버라이드 불필요).
- ⚠️ 스키마는 `vector(1536)` 비수식 형태로 선언(`public.vector(...)`는 이슈 #3548로 `interface{}` 생성).

### 4.2 디렉터리 레이아웃

```
backend/
├── cmd/
│   ├── api/main.go            ← 컴포지션 루트(RPC/HTTP 서버). 와이어링은 여기서만.
│   └── worker/main.go         ← 비동기 AI 파이프라인 워커 (신설 예정)
├── internal/
│   ├── memory/                ← 기능: 기억(별). 일기 원본·분류·비주얼 속성·활성도
│   │   ├── memory.go          ← 도메인 (Memory, Mood, VisualSpec)
│   │   ├── repository.go      ← Repository 인터페이스(소비자 측)
│   │   ├── service.go         ← 비즈니스 로직
│   │   ├── repository_pg.go   ← sqlc gen + 얇은 pgx (동적 쿼리)
│   │   └── handler.go         ← Connect RPC 서비스 핸들러
│   ├── link/                  ← 기능: 시냅스(가중치 그래프). 강화·감쇠·이웃 조회
│   ├── ai/                    ← 공급자 추상화 (Embedder, Extractor 포트 + 어댑터)
│   ├── job/                   ← 비동기 작업 큐 (enqueue/claim/complete)
│   ├── platform/              ← config, postgres(pgxpool+pgvector 등록), rpcserver
│   └── db/                    ← migrations(.up/.down), queries(*.sql), gen(sqlc 출력, 손대지 않음)
├── proto/ 또는 ../proto       ← .proto 단일 계약 (Connect RPC)
├── sqlc.yaml · buf.gen.yaml   ← 코드젠 설정
└── go.mod
```

> DTO(`dto.go`)는 손으로 쓰지 않는다 — **proto 생성 타입이 전송 계층 모델**이다(§4.4).

### 4.3 의존 방향

```
RPC 핸들러 ──► service ──► Repository(interface) ──► repository_pg ──► db/gen(sqlc) + 얇은 pgx
                │
                └─► 도메인 타입 (Memory, Link) — 무엇도 의존하지 않음
```

- **안쪽으로만.** 핸들러는 service를 알지만 그 반대는 모른다.
- **기능 간 호출은 service ↔ service.** `link` 기능이 `memory` 데이터가 필요하면 `memory.Service` 인터페이스에 의존.
- **proto 생성 타입·sqlc 생성 타입은 인프라.** 도메인은 둘 다 모른다. 핸들러가 proto↔도메인, `repository_pg`가 row↔도메인 매핑.

### 4.4 API = Connect RPC + Protobuf

전송 계층은 **Connect RPC + Protobuf**다. 엔그램 페이로드(노드+가중치 엣지+진화하는 비주얼 속성)는 살아있는 그래프라 **protobuf 필드-번호 진화**가 수기 JSON DTO 동기화보다 안전하다.

- **`.proto`가 단일 계약 원천.** `buf` + `protoc-gen-connect-go`/`protoc-gen-go`로 Go 서버, `protobuf-es`+`connect-es`로 TS 클라이언트 생성 → **웹·React Native 공유**(추후 Flutter는 connect-dart).
- **proto = DTO 레이어.** "DTO vs 도메인 분리" — 도메인은 순수 유지, 핸들러가 proto↔도메인 매핑.
- **unary 전용.** RN이 server-streaming을 지원하지 않으므로(§3.4) 스트리밍을 쓰지 않는다. **회상 강화는 클라 로컬 시뮬레이션 + unary 배치 업서트로 영속화**한다(폴링/스트리밍 불필요).
  - **flush 트리거:** 클라가 페어별 `delta_weight`를 **로컬 누적**하고, **디바운스(유휴 ~5s) + `beforeunload`** 시 한 번에 flush.
  - **페이로드(증분):** `ReinforceLinksRequest{ items:[{ a_id, b_id, delta_weight }], batch_id }` — 절대값이 아니라 **증분(delta)**을 보낸다. BE는 `ON CONFLICT (a_id,b_id) DO UPDATE SET weight = LEAST(1.0, weight + EXCLUDED.weight)` 배치 업서트(신규 페어는 weight=delta, `link_type='co_recall'`).
  - **멱등성:** 각 배치에 `batch_id`를 부여하고 BE는 `processed_batches(batch_id, user_id)`에 기록 — 이미 본 batch_id면 skip해 **재전송 이중 가산을 방지**한다(헌법6의 `+EXCLUDED.weight`가 중복되지 않게).
- **idempotent unary는 HTTP GET** 으로 노출 가능 → 초기 그래프 로드를 Cloudflare CDN 캐시.
- **서버 셋업:** connect-go 핸들러는 `http.Handler`이므로 `net/http` mux에 마운트한다. `h2c`로 평문 HTTP/2, `connectrpc.com/cors`로 CORS. HTTP 라우팅은 `/health`만 남기는 얇은 mux를 `platform/rpcserver`에 둔다(웹 프레임워크 미사용).
- ⚠️ `connect-go`는 Go 1.25+ 요구(현재 빌드 이미지 `golang:1.26`이라 충족).
- ⚠️ **Windows 호스트에서 `buf`/`protoc` .exe 직접 실행 금지**(Application Control 차단) → **Docker/WSL 안에서 codegen** 실행(기존 `sqlc`/`go`와 동일 패턴).

### 4.5 데이터 계층 — sqlc + pgvector + 그래프

엔그램의 DB 책임은 세 가지이며 전부 raw SQL/sqlc의 강점이다.

1. **벡터 유사도** — `ORDER BY embedding <=> $1 LIMIT k`. 새 기억을 top-k 최근접과 연결. **HNSW 인덱스**(`vector_cosine_ops`) 권장.
2. **가중치 그래프** — `memory_links` 이웃 조회, top-N 강한 시냅스, `WITH RECURSIVE` N-홉 성단 추출.
3. **원자적 강화(헵)** — `INSERT ... ON CONFLICT (a_id,b_id) DO UPDATE SET weight = LEAST(1.0, memory_links.weight + EXCLUDED.weight)`. 다건 강화는 **`UNNEST($1::text[],$2::text[],$3::float8[])` 배치 업서트**(`:copyfrom`은 COPY라 ON CONFLICT 불가).

- **얇은 pgx 보강:** 런타임에 홉 수/필터가 바뀌는 **동적 N-홉 순회·동적 정렬**만 `repository_pg.go` 내부에서 pgx로 직접 작성(sqlc 정적 생성과 안 맞는 부분). 정적 쿼리는 전부 sqlc.
- **pgvector 등록:** pgx 풀 after-connect 훅에서 `pgvector-go`의 타입을 등록(`pgxvec.RegisterTypes`)하거나 sqlc 자동 매핑 사용.
- **마이그레이션 도구:** 현재 컨테이너 첫 기동 마운트 방식. `memory_links`/HNSW 인덱스 추가가 두 번째 마이그레이션이므로 이 시점에 **goose** 도입(plan/ 스펙).

### 4.6 비동기 워커

일기 저장은 즉시 응답하고, AI 파이프라인은 백그라운드에서 돈다.

```
[동기] 일기 작성 → RPC → memory 원본 저장 → job 큐 적재 → "별 생성 중" 응답
[비동기 worker]
   job claim → Embedder.Embed(text) → pgvector 저장
            → (v1) Extractor.Extract(text) → 분류·개체·비주얼
            → top-k 최근접 조회 → link 생성(초기 weight)
            → job complete
```

- **큐:** `jobs` 테이블 기반(별도 브로커 없이). `SELECT ... FOR UPDATE SKIP LOCKED`로 워커가 안전하게 claim. (규모가 커지면 전용 큐로 진화.)
- **워커는 별도 프로세스**(`cmd/worker`)이나 MVP에선 같은 바이너리의 고루틴으로 시작해도 됨(plan/ 스펙에서 택일).
- **견고성:** 구조화 출력 강제 + 파싱 실패 재시도 + 범위 밖 값 폴백 + 지수 백오프(`jobs.next_run_at`, §5). 실패한 job은 상태 보존.
- **신규 별 결과 수신(스트리밍 금지):** 일기 저장은 `RecordMemoryResponse{ memory_id }`만 즉시 반환하고, 클라는 그 `memory_id`+폼값으로 **낙관적 별**을 바로 띄운다. 워커가 채운 임베딩·연결(시냅스)은 폴링/스트리밍이 아니라 **다음 `GetUniverse` 호출(refetch)에서 반영**된다(헌법6, §4.4). 즉 "별은 즉시, 연결은 다음 refetch에서".

### 4.7 AI 공급자 추상화 — "어떤 LLM이든 교체 가능"

AI는 **포트(인터페이스)** 뒤에 둔다. 도메인·서비스·워커는 포트에만 의존하고, 어댑터(OpenAI/DeepSeek/로컬 등)는 가장 바깥에서 주입한다.

```go
// internal/ai
type Embedder interface {
    Embed(ctx context.Context, text string) ([]float32, error) // 차원은 어댑터가 보장(기본 1536)
}
type Extractor interface { // v1: 일화/의미 분류·인물·장소·주제·비주얼 속성
    Extract(ctx context.Context, text string) (Extraction, error)
}
```

- **어댑터 선택:** 임베더는 설정(config)으로 — `AI_EMBEDDER=openai` 식. 추출은 admin 콘솔이 결정한다(spec 34, env 노브 없음) — 활성 LLM 선택이 있으면 실제, 없으면 키리스 mock. 차원이 바뀌면 임베딩 컬럼/인덱스 재생성이 필요하므로 차원은 설정에 고정·기록.
- **MVP 범위:** **Embedder 필수**(연결의 핵심). **Extractor는 포트만 정의**하고 MVP는 no-op 또는 단순 기본 — 비주얼 속성은 감정/강도 기반 **결정론적 매핑**으로 대체. **LLM 추출(분류·개체·풍부한 비주얼)은 v1**에서 같은 포트로 슬롯인.
- **비용 관리:** 건당 토큰 상한·호출 캐싱·일/월 상한 + 알림. 임베딩(저비용)과 LLM(고비용)을 분리 계측.

### 4.8 흔한 함정

1. **sqlc 위에 또 손으로 Repository를 까는 것.** sqlc가 이미 repository다.
2. **인터페이스를 구현부에 선언.** 소비자(service) 측에 둔다.
3. **도메인 타입에 `json:`/`db:`/proto 태그.** 인프라가 도메인에 새겨진다. proto·row 타입은 별도.
4. **`public.vector(n)`로 스키마 선언.** `vector(n)` 비수식으로(이슈 #3548).
5. **회상 강화를 server-streaming으로 설계.** RN 미지원 — unary 배치로.
6. **별 좌표를 서버가 권위 저장.** 좌표는 클라 force-sim에서 창발. 서버는 **가중치 그래프만** 권위. (안정화 좌표 캐싱은 선택적 최적화)
7. **핸들러에 비즈니스 로직.** 핸들러는 얇게, 정책은 service.

---

## 5. 데이터 모델 (개념 수준)

> 정확한 타입·인덱스는 마이그레이션에서 확정(plan/ 스펙). 여기서는 *무엇을 들고 있어야 하는지*.

> **원본/별 분리(헌법1).** `records`는 **불변 원본**(append-only, UPDATE/DELETE 금지), `memories`는 그 원본을 가리키는 **가변 표상(별/엔그램)**이다. `mood`/`intensity`/`entry_date`/`body`는 **`records`에만** 둔다 — 별 행이 이 값을 필요로 하면(셰이더용 색=mood·크기=f(intensity), 회상 패널) `record_id`로 **`records`를 JOIN**해 읽는다(`memories`로 합치지 않는다). 정규 DDL·인덱스는 03.data-schema가 단일 권위.
>
> **user_id 격리.** 모든 도메인 테이블에 `user_id`를 두고, 모든 KNN/그래프/universe/recall/dormant 쿼리에 `WHERE user_id = $ctx`를 강제한다(인터셉터가 컨텍스트 user_id 주입). RLS는 v1, MVP는 WHERE + 인터셉터로 격리.

- **users** — MVP는 **별도 테이블 불필요**. `user_id`는 **Supabase Auth uid(TEXT)**를 그대로 쓴다. (다중 사용자 단계에서 확장.)
- **records(불변 원본)** — `id`, `user_id`, `body`(일기 원본), `entry_date`, `mood`(nullable), `intensity`(nullable, 0~1), `idempotency_key`(nullable), `created_at`. **append-only**(헌법1), `(user_id, idempotency_key)` 부분 UNIQUE.
- **memories(별)** — `id`, `user_id`, `record_id`(NOT NULL → `records` FK), `visual_spec`(JSONB, **MVP 미사용** — FE가 `memory_id` 시드로 결정론적 파생), `last_recalled_at`, `created_at`. 인덱스 `(user_id)`. **mood/intensity/entry_date/body는 없음**(records JOIN).
- **embeddings** — `memory_id`(PK → `memories` FK), `user_id`(격리), `embedding vector(1536)`, `model`(어댑터/차원 기록). pgvector + HNSW(`vector_cosine_ops`), 인덱스 `(user_id)`.
- **memory_links(시냅스)** — `a_id`, `b_id`(정규화: `a_id < b_id`로 무방향 1행), `user_id`(격리), `weight`(0~1), `link_type`(semantic/temporal/entity/co_recall), `co_activation_count`, `last_activated_at`, `created_at`. PK `(a_id,b_id)`, 인덱스 `(user_id)`.
- **jobs** — 비동기 작업 큐. `id`, `memory_id`(→ `memories` FK), `kind`, `status`(pending/running/done/failed), `attempts`, `error`, `next_run_at`(지수 백오프 — `now() + base·2^attempts`), `created_at`, `updated_at`. claim 인덱스 `jobs_claim_idx (status, next_run_at)`.
- **processed_batches** — 회상 강화 멱등성(§4.4). `batch_id`(PK), `user_id`, `created_at`. 이미 본 `batch_id` 배치는 skip(이중 가산 방지).

> **희소성 원칙:** `memory_links`는 전체 비교가 아니라 top-k 최근접만 연결한다(생물학적으로도 엔그램은 희소).

---

## 6. 망각 모델 구현 (구체 수치는 기본값, 튜닝 가능)

concept.md의 **"기억은 사라지지 않는다, 빛이 꺼질 뿐"(침묵 엔그램)** 을 다음과 같이 구현한다. **데이터도 우주의 별·시냅스도 절대 삭제·제거하지 않는다.** 감쇠는 **렌더 시 계산되는 밝기 상태**일 뿐이다.

> **구현 단계.** 아래 순수 시간 감쇠(`exp(-λ·Δt)`, 반감기 30일, 단일 λ)가 코어이며, concept.md가 요구하는 확장은 모두 구현됐다: **관련성·감정 가중 감쇠**(`λ_eff = λ_base·R_conn·R_recent·R_emo` — plan 26), **양방향 재공고화·재성형**(PE 게이트·append-only 변천사 — plan 23·24), **일기 분할·조각별 감정·valence**(plan 20·21·29). 강화는 `weight += 0.05` 단조 증가(상한 1.0), intensity·valence는 별 크기·연결·감쇠 저항에 가중된다. 캐노니컬 수치의 단일 출처는 [policy/domain/star.md](../policy/domain/star.md)·[synapse.md](../policy/domain/synapse.md).

- **활성도 감쇠:** `activation(Δt) = exp(-λ · Δt_days)`, **반감기 30일** → `λ = ln2/30 ≈ 0.0231/day`. `Δt`는 `now - last_recalled_at`(별) / `last_activated_at`(연결).
- **최소 밝기 바닥(floor):** 유효 밝기는 **`a_min = 0.05`로 바닥을 둔다 — 0이 되어 사라지지 않는다.** `a_min`까지 내려간 별·시냅스는 **"잠든(dormant) 상태"로 어둡게 계속 렌더링**되며(우주에서 제거하지 않음, `GetUniverse`는 전체 그래프 반환), 항해·클릭으로 접근 가능. 잠든 별은 별도 탐색(`ListDormant`)으로도 찾는다.
- **유효 밝기:** 별 = `max(a_min, activation)`; 시냅스 = `weight · max(a_min, activation)`.
- **연결 생성 초기 강도:** `w0 = clamp(α·cos_sim + β·temporal_bonus, 0, 1)`, 기본 `α=1.0`, `temporal_bonus`는 같은 주 `+0.3` 선형 감소. 연결 임계 `cos_sim ≥ τ = 0.75`, **top-k = 8**.
- **공동 회상 강화(헵):** 함께 본 두 별의 연결 `weight += 0.05`(상한 1.0), `co_activation_count++`, `last_activated_at = now`. **별을 회상하면 `last_recalled_at = now`** → 잠들었던 별이 다시 켜짐(재공고화). 공동 회상의 조작적 정의(≥2초 능동 열람 + 직전 열람 별 페어링)는 plan/ 스펙(회상 강화).
- **회상 강화 영속(unary 배치, §4.4):** 클라가 페어별 `delta_weight`(=0.05)를 **로컬 누적** → **디바운스 유휴 ~5s + `beforeunload`** 시 `ReinforceLinksRequest{ items:[{a_id,b_id,delta_weight}], batch_id }`로 **증분** flush. BE는 `ON CONFLICT DO UPDATE SET weight = LEAST(1.0, weight + EXCLUDED.weight)` 업서트하되, `batch_id`를 `processed_batches`에 기록해 **재전송 이중 가산을 방지**(멱등).
- **셰이더 매핑(TSL):** 선 두께 `lerp(0.5px, 4px, weight·brightness)`, emissive `weight·brightness`, **펄스** `sin(time·f)·amp` (최근 강화된 연결일수록 amp↑). 별 크기 `f(intensity)`(결정론적), 색 = mood 팔레트, 밝기 = `max(a_min, activation)`(잠든 별도 은은한 잔광).
- **계산 위치:** 활성도는 `last_*_at`로부터 **렌더 시 결정론적으로 계산**(서버가 매번 쓰지 않음). 강화/회상 이벤트만 unary 배치로 영속화.

---

## 7. 인프라 (구성은 추후, 문서엔 결정만)

> 구현(CI/CD 파이프라인·prod Dockerfile·compose·Caddy·Actions·배포 절차)은 [ops/deploy-cicd](../ops/deploy-cicd.md) + [DEPLOY.md](../../DEPLOY.md).

| 레이어 | 선택 | 비고 |
|---|---|---|
| 웹 호스팅 | **Cloudflare Workers** (정적 자산, 루트 `wrangler.jsonc`) | 정적 + 글로벌 CDN. unary GET 그래프 로드 캐시. |
| 백엔드 | **AWS Lightsail VPS** (서울 `ap-northeast-2`, Docker Compose) | Go API + worker. 정액 $7/월·x86(GHCR `linux/amd64` 그대로)·Supabase와 같은 리전. Hetzner는 한국 리전이 없어(최근접 싱가포르, 가격 할증) 미채택. |
| DB/Auth | **Supabase** (관리형 Postgres + pgvector + Auth) | 소셜 로그인·세션·관리형 벡터. ⚠️ Lightsail↔Supabase **리전 코로케이션**(둘 다 서울 — API↔DB 지연 방지). |
| 로컬 개발 | Docker Compose | postgres 이미지를 **pgvector 포함**(예: `pgvector/pgvector:pg16`)으로 교체. |
| 로깅/에러 | Structured logging + Sentry | |

> 이 표는 **결정의 기록**이다. Supabase 프로젝트 생성·Lightsail 프로비저닝·Cloudflare 연결 등 실제 구성은 하지 않는다(plan/ 스펙의 별도 단계). **CI/CD·실배포(develop→스테이징, main→프로덕션 자동 배포)는 [ops/deploy-cicd.md](../ops/deploy-cicd.md)** 에서 전개한다.

---

## 8. 공통 컨벤션

- **언어:** 한국어(UI 카피·문서), 영어(코드·식별자).
- **Git 커밋:** Conventional Commits — 영문 제목 / 한글 본문. 의미 단위로 작게.
- **포맷팅:** 프론트 ESLint, 백엔드 `gofmt`.
- **시간:** UTC 저장, 표시 시 사용자 로컬 변환.
- **ID:** 백엔드에서 `TEXT` PK(UUID 또는 nanoid). 클라이언트는 ID를 만들지 않는다.
- **Windows:** 사용자 디렉터리 .exe가 Application Control로 차단됨 → `go`/`sqlc`/`buf`/`protoc`는 **Docker/WSL 안에서** 실행.

---

## 9. 의도적으로 *지금* 도입하지 않은 것

| 항목 | 이유 |
|---|---|
| Connect server-streaming | RN 미지원. 회상 강화는 unary 배치로. 필요 시 웹 전용 SSE/WS 별도 채널. |
| 모바일 렌더러 확정 | RN 렌더러 생태계 과도기. 트랙(RN)만 확정, 렌더러는 착수 시점에. |
| 모노레포(`packages/core`) | 현재 단일 frontend. 모바일 추가 시 승격(FSD 격리로 비용 낮음). |
| 다중 사용자 실시간 협업 | 우주 공유·공명(plan 35–37)은 비동기·단방향이다. 실시간 동시 편집·프레즌스·공개 피드는 도입하지 않는다(concept.md 비-목표). |

> 이전 표에서 "지금 안 함"으로 두었던 항목들은 이후 plan으로 구현됐다: LLM 추출(20)·일기 분할(21)·관련성/감정 가중 감쇠(26)·별 재성형·변천사(23·24)·우주 배경=요즘 상태(25)·시드 기반 별 형태(08·23·38)·소셜 공유/공명(35–37)·안정 좌표 캐시(27)·구조 린트(steiger·eslint-plugin-boundaries). 인증은 MVP부터 ON(Supabase Auth 단일 계정, 모든 쿼리 `user_id` 스코프)이고, 다중 사용자 공유까지 구현됐다(35–37).

---

## 10. 참고 자료

### FSD
- [Feature-Sliced Design — Overview](https://feature-sliced.design/docs/get-started/overview) · [Layers](https://feature-sliced.design/docs/reference/layers) · [Slices and segments](https://feature-sliced.design/docs/reference/slices-segments) · [Public API](https://feature-sliced.design/docs/reference/public-api)

### 프론트 3D / WebGPU / 모바일
- [R3F docs](https://r3f.docs.pmnd.rs/getting-started/installation) · [Scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- [r3f-forcegraph](https://github.com/vasturiano/r3f-forcegraph) · [three-forcegraph](https://github.com/vasturiano/three-forcegraph) · [d3-force-3d](https://github.com/vasturiano/d3-force-3d)
- [three.js WebGPU 마이그레이션](https://www.utsubo.com/blog/webgpu-threejs-migration-guide) · [three.js Line2](https://threejs.org/docs/pages/Line2.html) · [InstancedMesh2](https://agargaro.github.io/instanced-mesh/)
- [react-native-webgpu (Software Mansion)](https://github.com/wcandillon/react-native-webgpu) · [react-native-filament](https://github.com/margelo/react-native-filament)

### 백엔드 (Go / sqlc / pgvector / Connect)
- [sqlc changelog (pgvector 자동 생성)](https://docs.sqlc.dev/en/latest/reference/changelog.html) · [sqlc #2467 (repository)](https://github.com/sqlc-dev/sqlc/issues/2467) · [#3548 (vector 함정)](https://github.com/sqlc-dev/sqlc/issues/3548)
- [pgvector](https://github.com/pgvector/pgvector) · [pgvector-go](https://github.com/pgvector/pgvector-go) · [sqlc INSERT/UNNEST](https://docs.sqlc.dev/en/latest/howto/insert.html)
- [connect-go](https://pkg.go.dev/connectrpc.com/connect) · [connect-es v2](https://buf.build/blog/connect-es-v2) · [connect-query-es](https://github.com/connectrpc/connect-query-es) · [Connect 프로토콜](https://connectrpc.com/docs/protocol/) · [buf](https://github.com/bufbuild/buf)
- [Three Dots Labs — Clean Architecture](https://threedots.tech/post/introducing-clean-architecture/) · [Go Code Review — Interfaces](https://go.dev/wiki/CodeReviewComments#interfaces)
