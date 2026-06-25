# XState 개발 가이드 (xstate-guide)

> cosimosi에서 **상태 머신을 쓰는 방식**을 한 패턴으로 못 박는다. [state-machines.md](state-machines.md)가 "어떤 머신이 존재하나"라면, 이 문서는 **"머신을 어떻게 작성·연결·테스트하나"**다.
> 기준: **XState v5**(`xstate@^5`, `@xstate/react@^5`) — v4 API(`Machine`/`interpret`/`cond`/typegen)는 쓰지 않는다.

## 0. 설치·버전

```bash
pnpm --filter ./frontend add xstate @xstate/react
```

- `xstate` 코어는 **순수 TS**(React/three/DOM 무의존) → `model` 세그먼트에 둔다(헌법4 충족).
- `@xstate/react`는 **`ui` 세그먼트에서만** import.
- 모델 기반 테스트가 필요하면 `@xstate/graph`(개발 의존성).

## 1. 한 장 요약 (이것만 지키면 80%)

1. 머신은 **`setup({ types, actions, guards, actors, delays }).createMachine({…})`** 로 만든다. v5엔 **typegen 없음** — 타입은 `setup`에서 추론.
2. context 갱신은 **`assign`**(불변, 새 값 반환). 직접 변이 금지.
3. 이벤트는 **`type` 판별 유니온.** "무슨 일이 일어났나"를 표현(`SELECT_STAR`), **setter 금지**(`setSelectedId`).
4. async/구독/타이머 = **액터**(`fromPromise`/`fromCallback`/`after`), 동기 fire-and-forget만 action.
5. React는 **`createActorContext` + `useSelector`**(파생값 구독), **`useActorRef`**(무구독 send). `useMachine`은 작은 지역 머신에만.
6. **R3F `useFrame`은 `getSnapshot()`** 로 읽고, 임계 도달 시 `send`. 컨트롤러에서 `useMachine` 금지.
7. 머신 간 통신은 **`sendTo` + input ref + `emit`/`.on`** ([state-machines §5](state-machines.md)). 공유 가변 필드 금지.

## 2. 파일·네이밍·배치 (FSD)

| 무엇 | 어디 | 비고 |
|---|---|---|
| 머신 정의 | `<layer>/<slice>/model/<name>.machine.ts` | 순수 TS. `setup().createMachine` export |
| selector | 같은 `model/<name>.selectors.ts` (또는 machine 파일 하단) | 컴포넌트 밖에서 정의(참조 안정) |
| actor context (React 바인딩) | `<layer>/<slice>/ui/<name>-context.tsx` | `createActorContext(machine)` — **`ui`에 둔다**(React라 `model` 아님, 헌법4) |
| R3F 연동 | `<slice>/ui/*` | `useSelector`/`useActorRef`/`useFrame`+`getSnapshot` |

- 파일: `*.machine.ts`, `*.context.tsx`(kebab). 머신 const는 `camelCase` + `Machine` 접미(`focusMachine`).
- 이벤트 `type`: `SCREAMING_SNAKE` 또는 점 표기(`'feedback.submit'`) — 한 머신 안에서 일관되게. 도착/완료 같은 시스템성 이벤트는 점 표기(`'arrived.star'`).
- `model`은 `three`/React/DOM import 금지(헌법4). 플랫폼 신호(`matchMedia` 등)는 `ui`에서 이벤트로 주입.

## 3. 머신 작성 — 정전(canonical) 템플릿

```ts
// features/<slice>/model/example.machine.ts
import { setup, assign, fromPromise } from 'xstate'

type Ctx = { targetId: string | null; error: unknown }
type Ev =
  | { type: 'SELECT'; id: string }          // 판별 유니온
  | { type: 'DISMISS' }
  | { type: 'RETRY' }

export const exampleMachine = setup({
  types: {
    context: {} as Ctx,
    events: {} as Ev,
    input: {} as { initialId: string | null },   // createActor 시 주입
  },
  actions: {
    // 이름 붙인 액션 = 재사용·강타입·provide 교체 가능
    clearError: assign({ error: null }),
  },
  guards: {
    hasTarget: ({ context }) => context.targetId != null,
  },
  actors: {
    load: fromPromise(async ({ input }: { input: { id: string } }) => fetchThing(input.id)),
  },
  delays: { debounce: 5000 },
}).createMachine({
  id: 'example',
  context: ({ input }) => ({ targetId: input.initialId, error: null }),
  initial: 'idle',
  states: {
    idle: {
      on: { SELECT: { target: 'active', actions: assign({ targetId: ({ event }) => event.id }) } },
    },
    active: {
      entry: 'clearError',
      on: { DISMISS: 'idle' },
    },
  },
})
```

규칙

- **`types`는 `{} as T` 캐스트**(순수 컴파일타임). 이벤트는 반드시 `type` 판별 유니온.
- **액션·가드·액터는 `setup`에 이름으로** 둔다(인라인 익명 지양) — 재사용·타입·`machine.provide({…})` 교체.
- `assign`은 **per-key**(`assign({ x: ({context}) => … })`) 또는 **whole-object**(`assign(({context}) => ({…}))`). 항상 새 값 반환.
- context가 input에 의존하면 **`context: ({ input }) => ({…})`** 함수형.
- 여러 이벤트가 한 액션을 트리거하면 `event`는 유니온이다 → **`assertEvent(event, 'SELECT')`** 로 좁힌다.

## 4. 상태·전환 핵심 (v5)

- **compound**(`states`+`initial`) / **parallel**(`type:'parallel'`, 각 region `initial`) / **final**(`type:'final'`, 부모 `onDone`).
- `on`(이벤트), **`always`**(전이형 — guard 통과 즉시), **`after`**(지연 — ms 또는 named delay), `entry`/`exit`, `guard`, `target`(`'sibling'`/`'parent.child'`/`'#id'`).
- ⚠️ **v5는 전환이 기본 internal** — 자기/하위 타깃 전환은 `entry`/`exit`·`invoke`·`after`를 재시작하지 않는다. 재진입이 필요하면 **`reenter: true`**.

## 5. 액터 — async·구독·타이머

| 패턴 | 쓰임 | cosimosi 예 |
|---|---|---|
| `fromPromise(async ({input,signal}) => …)` | 1회성 fetch | 작성 분절/제출, 회상 flush |
| `fromCallback(({sendBack,receive,input}) => cleanup)` | 외부 구독·타이머 | Supabase `onAuthStateChange`, demo 시간 트윈 틱 |
| `after: { debounce: 'FLUSH' }` | 지연 전환 | 회상 디바운스(유휴 5s) |
| `invoke`(상태 수명) vs `spawn`(동적 N개) | — | invoke 위주 |

```ts
loading: {
  invoke: {
    src: 'load',
    input: ({ context }) => ({ id: context.targetId! }),
    onDone:  { target: 'shown',   actions: assign({ data:  ({ event }) => event.output }) },
    onError: { target: 'failure', actions: assign({ error: ({ event }) => event.error }) },
  },
},
```

**구독(fromCallback) — 세션 머신에서:**

```ts
actors: {
  authChanges: fromCallback(({ sendBack }) => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) =>
      sendBack({ type: 'AUTH_CHANGED', session }))
    return () => data.subscription.unsubscribe()
  }),
},
```

- 동기 부수효과만 action. **async·구독·interval은 반드시 액터.**
- `onDone`은 `event.output`, `onError`는 `event.error`.

## 6. React 바인딩 (`@xstate/react`)

**전역/기능 단위 = `createActorContext`(권장).**

```tsx
// entities/memory/ui/focus-context.tsx  (ui — createActorContext는 React)
import { createActorContext } from '@xstate/react'
import { focusMachine } from '../model/focus.machine'
export const FocusContext = createActorContext(focusMachine)

// 페이지에서 Provider 마운트
<FocusContext.Provider>{children}</FocusContext.Provider>
```

```tsx
// 값은 selector로 구독(전환마다 리렌더 X), send는 actorRef로(구독 X)
const selectedId = FocusContext.useSelector(s => (s.matches('starFocus') ? s.context.targetId : null))
const actorRef   = FocusContext.useActorRef()
actorRef.send({ type: 'SELECT_STAR', id })
```

- **`useSelector`** 로 파생 슬라이스만 구독 → 그 값이 바뀔 때만 리렌더. selector는 **컴포넌트 밖**에서 정의(참조 안정), 객체/배열 선택은 **`shallowEqual`**(@xstate/react) 비교 전달.
- **`useActorRef`** = 구독 없이 `send`만. 이벤트만 보내는 컴포넌트는 이걸로(리렌더 0).
- **`useMachine`**(전환마다 리렌더)은 작은 **지역** 머신에만. Core 머신엔 쓰지 않는다.

## 7. R3F 통합 — per-frame 읽기 (cosimosi 핵심)

WebGPU 렌더 루프는 **React 렌더가 아니라 매 프레임 `getSnapshot()`** 로 머신을 읽는다(Architecture §3.2 "React state로 60fps 구동 금지"와 정합).

```tsx
function FlightController() {
  const nav = NavigationContext.useActorRef()   // 구독 X — 리렌더 0
  useFrame((_, dt) => {
    const snap = nav.getSnapshot()
    if (!snap.hasTag('transitioning')) return
    const target = snap.context.targetPose       // 이산 타깃만 머신에서
    camera.position.lerp(target.pos, 1 - Math.exp(-dt * 4))   // 연속 보간은 여기
    if (camera.position.distanceTo(target.pos) < 0.5)
      nav.send({ type: 'ARRIVED' })              // 임계 도달 → 이산 전환
  })
  return null
}
```

규칙

- 컨트롤러는 **`useActorRef`로 ref만** 얻고 `useFrame`에서 `getSnapshot()`. **`useMachine` 절대 금지**(매 전환 리렌더 → 폭발).
- 머신엔 **이산 상태 + 타깃**만. **연속 lerp·`move` 벡터·drag offset**은 ref/zustand.
- 이벤트 핸들러(`onPointerMissed`, `onClick`)도 ref로 `send`한다 — 클로저 캡처된 렌더-지연 props 대신 현재 상태.

## 8. 머신 간 통신

[state-machines §5](state-machines.md)의 나브↔포커스 배선이 정전 패턴이다.

- 한쪽을 먼저 만들고 그 `ref`를 다른 쪽 **`input`** 으로 → `sendTo(ref, …)`.
- 역방향 알림은 **`emit({ type:'…' })`** + 소비처 `actorRef.on('…', cb)` 한 줄 브리지(순환 ref 회피).
- 라우팅이 늘면 부모 오케스트레이터가 `invoke`로 둘을 품고 `sendTo` 중계. **그 전엔 과설계 금지.**
- ⚠️ `sendParent`보다 **input으로 받은 ref에 `sendTo`** 를 선호(결합도↓·타입 안전).

## 9. 테스트

```ts
import { createActor } from 'xstate'
import { test, expect } from 'vitest'

test('diaryFocus는 두 진입점에서 동일', () => {
  const a = createActor(focusMachine, { input: { initialId: null } }).start()
  a.send({ type: 'SELECT_DIARY', recordId: 'r1' })
  expect(a.getSnapshot().matches('diaryFocus')).toBe(true)
  expect(a.getSnapshot().context.recordId).toBe('r1')
})
```

- **순수 단위테스트**(`createActor`+`send`+`getSnapshot`, React 없음)가 기본 — `model`이 순수하니 vitest로 직접.
- 무실행 전이: `machine.transition(state, event)` / `machine.getInitialSnapshot(...)`.
- 분기 많은 머신: **`@xstate/graph` `createTestModel`** 로 경로 커버(`getShortestPaths`/`getSimplePaths`). (v5에서 `@xstate/test`는 `@xstate/graph`로 통합.)

## 10. v4 → v5 함정 (이것만 다르다)

| v4 | v5 |
|---|---|
| `interpret(machine)` | **`createActor(machine)`** |
| `Machine(...)` / `createMachine(config, options)` | **`setup({…}).createMachine({…})`** |
| `cond` | **`guard`** |
| `services` | **`actors`** |
| `withConfig`/`withContext` | **`machine.provide(...)`** / `input`·`context` 함수 |
| `tsTypes`/typegen | **없음** — `setup` 추론 + `assertEvent` |
| 자유 `spawn(logic,'name')` | **`assign` 안 `spawn`** 또는 **`spawnChild('logic',{id})`** |
| `pure`/`choose` | **`enqueueActions`** |
| `send`(액션) | **`raise`**(자기) / **`sendTo`**(타 액터) |
| `done.invoke.<id>`/`error.platform.<id>` | **`onDone`/`onError`**(`event.output`/`event.error`) |
| 전환 external 기본 | **internal 기본** — 재진입은 `reenter:true` |
| `state.context` (string 이벤트 가능) | **`snapshot`**(`.context/.value/.matches/.hasTag`), `send`는 **객체만** |

> ⚠️ `actor.subscribe(...)`는 **즉시 현재 스냅샷을 방출하지 않는다.** 초기값은 `start()` 후 `getSnapshot()`으로 잡고, 이후 `subscribe`/`getSnapshot`.

## 11. 안티패턴 (하지 말 것)

- ❌ **setter 이벤트**(`{type:'setSelectedId', id}`) — 의도를 표현(`SELECT_STAR`). 머신이 *무엇이 바뀌나*를 결정.
- ❌ **context에 대형 데이터**(별 배열·쿼리 결과) — id만. 데이터는 스토어/Query.
- ❌ **깊게 중첩한 context** — flat하게(selector/비교/assign이 깨끗). 진짜 하위상태는 child state로.
- ❌ **컴포넌트 안에서 selector 정의** — 참조 churn → 매번 리렌더. 밖에서 정의.
- ❌ **컨트롤러에서 `useMachine`** / 매 프레임 머신에 연속값 이벤트 — getSnapshot + ref.
- ❌ **`model`에서 React/three import** — 헌법4. 플랫폼 신호는 ui에서 이벤트로.
- ❌ **boolean 수프**(`isLoading && !error && data`) — 유한 상태(`idle/loading/shown/failure`)로 *불가능한 상태를 표현 불가능하게*.

## 12. 새 머신 도입 체크리스트

- [ ] "N개 배타 상황의 명시적 수명주기"인가? (아니면 zustand/useState로) — [state-machines §0](state-machines.md)
- [ ] `model/<name>.machine.ts`에 `setup().createMachine`, 이벤트는 판별 유니온.
- [ ] async/구독/타이머는 액터, 동기만 action.
- [ ] selector는 model에서 정의, 컴포넌트는 `useSelector`/`useActorRef`.
- [ ] R3F가 읽으면 `getSnapshot()` per-frame, 연속값은 머신 밖.
- [ ] 순수 단위테스트(+ 분기 많으면 graph 경로).
- [ ] `model`에 React/three import 없음(steiger·헌법4 통과).
