# packages/ — 공유 패키지 경계

여러 앱(`apps/web`, 미래 `apps/mobile`, `apps/blog`)이 같은 코드를 실제로 쓰게 될 때
승격(promote)할 자리다. **빈 패키지를 미리 만들지 않는다** — 추상화는 두 번째 소비자가
생기는 순간에만 비용을 낸다(FSD "needs-driven / 미리 추상화하지 말 것").

## 승격 규칙 (promote-on-reuse)

- **두 번째 실제 소비자**가 생기는 순간 승격한다. 한 앱만 쓰는 코드는 그 앱 안(`apps/web/src/shared/*` 등)에 둔다.
- 승격해도 **헌법 §4 import 방향**은 깨지지 않는다: `ui → model` OK, `model`/`core`는 `three`/React/DOM 미의존(모바일 재사용 전제). 플랫폼 분기는 앱의 `ui`에서만.
- 앱끼리 서로의 `src`를 **relative import 하지 않는다**. 공유가 필요하면 `packages/*` 또는 루트 `proto/`(전송 계약)로만 연결한다(헌법 §5).

## 후보 (아직 만들지 않음)

| 후보                                | 무엇                                                                                       | 승격 조건                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `packages/core`                     | 앱 독립 순수 로직 — memory physics(`force-sim`의 순수 `tick`), values 해석, mood utilities | 순수 로직이 web 밖(모바일 등)에서 필요해질 때                                                               |
| `packages/rendering` (또는 `webgl`) | TSL 노드 조립, WebGPU renderer 포트, R3F 헬퍼, shader-art toolkit                          | 모바일 렌더러(`react-native-webgpu` 등)가 확정돼 같은 셰이더/씬을 공유할 때 — 그 전엔 app-local 유지가 기본 |

## 이미 승격된 패키지

- **`packages/ui`** (`@cosimosi/ui`) — 공유 디자인 토큰 + 접근성 UI 프리미티브. web·mobile이 day-one에 함께 쓰는
  Phase 1 예외라(promote-later 아님, [overview](../spec/plan/00.overview.md) §1) 처음부터 패키지로 짓는다. `packages/`의
  "DOM/native 미의존" 규칙의 **플랫폼 인지 예외**: DOM(`*.tsx`) + RN(`*.native.tsx`) 형제를 `exports` 조건으로 가른다.
  규칙은 [spec/tech/design-system.md](../spec/tech/design-system.md).

루트 `proto/`는 패키지가 아니라 **모든 클라이언트가 공유하는 transport 계약**이다 — `packages/`로 옮기지 않는다.
모바일 재사용 전략의 전체 그림은 [spec/tech/architecture.md](../spec/tech/architecture.md) §3.4를 본다.
