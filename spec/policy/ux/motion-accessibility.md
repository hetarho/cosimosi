# 모션·접근성 (policy/ux/motion-accessibility)

> 현재 구현된 모션·접근성 패턴의 사실 정의.

## 정의

cosimosi의 화면은 별이 숨 쉬고(미세 모션) 회상이 흐름으로 보이는 **항상-온 우주**다. 현재 구현은 그 모션을 (1) `prefers-reduced-motion: reduce` 사용자에게 정지/축소하고, (2) coarse pointer(터치) 기기에서 hover를 대체 트리거로 바꾸며, (3) WebGPU/WebGL2 두 렌더 경로에서 동일하게(TSL 단일 소스) glow 클리핑 없이 그린다. 모든 애니메이션은 `useFrame` 수동 uniform으로 구동하고(BloomPass의 `RenderPipeline`가 TSL `time` 노드를 멈추므로), 3D 씬 안에 DOM(`<Html>`)을 두지 않는다.

핵심 어휘:

- **미세 모션(micro-motion):** 별 폼의 출렁임·깜빡임·흐름, 시냅스 필라멘트의 light-packet flow·breath, 배경 그레인의 미세 지터.
- **수동 uniform(manual uniform):** `uniform(0)`을 `useFrame`에서 `clock.elapsedTime`으로 매 프레임 갱신하는 시간원. TSL 내장 `time` 노드 대체.

랜딩의 3D Star3D 폼·이론 카드 인터랙션 등 표현 확장은 plan 15에서 다룬다(여기 규칙은 현재 코드에 박힌 패턴만).

## 규칙 · 파라미터

| # | 규칙 | 현재 값/조건 |
|---|---|---|
| R1 | **`prefers-reduced-motion: reduce` 존중** — reduced 환경에서 무한 배경/그레인 애니메이션을 정지하고 정적 프레임만 남긴다. 별 밝기·색·시냅스 강도 같은 핵심 의미는 모션 없이도 그대로 전달된다. | `useReducedMotion()`(motion/react)로 게이트; reduced 시 `ld-grain--animated`·랜딩 배경 애니메이션 미적용 |
| R2 | **coarse pointer(터치) 트리거 분기** — hover가 없는 기기에서 hover 전용 인터랙션을 in-view 등 다른 트리거로 대체한다. | `useCoarsePointer()` = `matchMedia('(hover: none)')`; 카드 active = `hovered \|\| (coarse && visible)` |
| R3 | **항상-온 미세 모션** — reduced가 아닌 한 별·시냅스는 매 프레임 미세하게 움직인다(완전 정적 화면을 기본으로 두지 않음). | StarField `update(clock.elapsedTime)` 매 프레임; SynapseFilaments shader `uTime` 구동(flow·breath·noise) |
| R4 | **glow/bloom 클리핑 금지** — bloom은 HDR 밝은 별·시냅스를 부드럽게 번지게 하되 톤매핑에 뭉개지지 않는다. 발광 머티리얼은 `toneMapped=false`로 HDR 유지, threshold는 낮게 둬 밝은 것만 걸린다. | `bloom(scenePass, strength 0.9, radius 0.5, threshold 0.1)`; synapse material `toneMapped=false`·`AdditiveBlending` |
| R5 | **3D 씬 안 DOM(`<Html>`) 금지** — 라벨/HUD를 R3F 씬 그래프 안에 DOM으로 박지 않는다. three 오브젝트 또는 캔버스 바깥 2D 레이어로 분리한다. | UniverseCanvas 씬 내부 `<Html>` 0건; 그레인은 캔버스 위 별도 DOM/SVG 오버레이(bloom 파이프라인 밖) |
| R6 | **애니메이션은 frozen TSL `time` 노드 대신 `useFrame` 수동 uniform** — BloomPass의 `RenderPipeline.render()`가 renderer nodeFrame을 전진시키지 않아 TSL `time` 노드가 멈춘다. 애니메 머티리얼은 `useFrame`에서 갱신하는 `uniform()`으로 구동한다. | 시간원 = `uniform(0)` ← `useFrame(()=>u.value=clock.elapsedTime)`; TSL `time` 노드 미사용 |

## 불변식 (invariants)

- **모션을 끄는 것이 의미를 끄는 것이 되어선 안 된다** — reduced/정적 상태에서도 별·시냅스는 사라지지 않는다(밝기 바닥 `A_MIN=0.05`, 가지치기는 밝기만 — 헌법2).
- **`model`·`shared.lib`는 `three`/React/DOM에 의존하지 않는다**(헌법4) — `useReducedMotion`·`matchMedia`·`useFrame` 같은 플랫폼/DOM 신호는 ui 레이어에만 존재한다. 순수 레이어는 좌표·값만 다룬다.
- **씬 안 DOM(`<Html>`) 금지** — 라벨·HUD는 three 오브젝트 또는 2D 레이어로 분리한다(WebGPU/모바일 이식성, 헌법4).
- **렌더 경로 단일 소스** — 모든 모션·glow는 WebGPU와 WebGL2 폴백 양쪽에서 동일 의미로 그려진다(TSL 단일 소스, 헌법8).

## 구현 근거

- R1: plan 15 · `widgets/universe-canvas/ui/UniverseGrain.tsx`, `pages/landing/ui/background/*`
- R2: plan 15 · `pages/landing/lib/use-coarse-pointer.ts`, `pages/landing/ui/section/EngramCard.tsx`
- R3: plan 08 · `entities/star/ui/StarField.tsx`(`update(elapsed)`), `entities/synapse/ui/SynapseFilaments.tsx`
- R4: plan 08 · `widgets/universe-canvas/ui/BloomPass.tsx`, `entities/synapse/ui/SynapseFilaments.tsx`
- R5: plan 08 · `widgets/universe-canvas/ui/UniverseCanvas.tsx`, `widgets/universe-canvas/ui/UniverseGrain.tsx`
- R6: plan 08 · `widgets/universe-canvas/ui/BloomPass.tsx`(RenderPipeline), `entities/star/ui/StarField.tsx`, `entities/synapse/ui/SynapseFilaments.tsx`
- 불변식: 헌법2(삭제 금지·밝기만)·헌법4(model 순수)·헌법8(TSL 단일 소스)
