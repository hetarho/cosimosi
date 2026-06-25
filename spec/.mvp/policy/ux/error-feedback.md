# 에러 피드백 (policy/ux/error-feedback)

> 현재 구현된 실패 상태 UX의 사실 정의 — 어떤 경로로 깨져도 흰 화면을 보여주지 않는다.

## 정의

cosimosi의 실패 처리 원칙은 **"흰 화면 금지 + 다음 행동 제시"** 다. 모든 폴백 화면은
무엇이 잘못됐는지(설명)와 무엇을 하면 되는지(새로고침/다시 시도/홈/입력 수정)를 함께
준다. 바운더리는 3겹이고 안쪽일수록 좁게 복구한다 — 우주가 죽어도 일기 작성(코어
가치)은 살아 있어야 한다.

## 규칙 · 파라미터

### 바운더리 계층 (바깥 → 안)

| 계층 | 잡는 것 | 폴백 | 복구 |
|---|---|---|---|
| 전역 `Sentry.ErrorBoundary`(App) | 라우터 폴백조차 못 그린 크래시 | "문제가 생겼어요" 풀스크린 카드 | 새로고침(전체 리로드) |
| 라우터 `defaultErrorComponent` | 라우트 로드/렌더 실패 | "이 화면을 불러오지 못했어요" | 다시 시도(reset) + 처음으로 |
| 라우터 `defaultNotFoundComponent` | 없는 경로 | "이 좌표에는 아무것도 없어요" | 내 우주로 / 처음으로 |
| 캔버스 전용 바운더리(HomePage, Canvas만 감쌈) | R3F 트리 throw + 렌더러 init 실패 | 원인 구분 카드(아래) | 다시 시도 = 캔버스 리마운트 |

- Sentry init이 안 된 환경(DSN 없음)에서도 폴백 렌더는 동일하게 동작한다 — 캡처만 no-op(DSN 유무로 분기하지 않음).
- 에러 후 라우터 상태를 신뢰할 수 없으므로 폴백 화면의 이동은 `<a>`(전체 리로드)다.
- Sentry fallback은 **모듈 레벨 컴포넌트**로 전달한다 — 인라인 화살표는 element type이 매 렌더 바뀌어 에러 상태의 폴백이 리마운트(포커스 유실)된다.

### 우주 캔버스 실패 (원인 구분)

| 원인 | 판별 | 카피 | 복구 |
|---|---|---|---|
| 렌더러 불가(WebGPU·WebGL2 모두 실패) | `RendererUnavailableError` | "이 브라우저/기기에서는 우주를 그릴 수 없어요" + 브라우저/가속 안내 + "일기 작성은 그대로" | 없음(재시도 무의미) |
| 일반 렌더 크래시 | 그 외 에러 | "우주를 불러오지 못했어요" + 에러 메시지 | 다시 시도(리마운트) |

- **렌더러 init 실패 표면화:** R3F는 async gl 팩토리의 reject를 바운더리에 전달하지 않는다(fire-and-forget) — `UniverseCanvas`가 실패를 state로 받아 **렌더 중 throw**로 바꿔 바운더리에 넘긴다. three의 `init()`이 WebGPU 실패 시 WebGL2로 내부 폴백하므로, `RendererUnavailableError`는 WebGL2까지 실패한 진짜 불가 환경에서만 던져진다.
- **HUD 생존:** 바운더리는 `<UniverseCanvas/>`만 감싼다 — 작성 폼·회상 패널·내비는 캔버스가 죽어도 동작한다(일기는 렌더러 없이도 기록된다).

### 입력 검증 피드백 (기록 폼)

| 실패 | 카피 |
|---|---|
| 빈 본문(클라 사전 차단 + 서버 `body is empty`) | "일기 내용을 입력해 주세요." |
| 4,000자 초과(클라 사전 차단 + 서버 `exceeds max length` + 256KB `ResourceExhausted`) | "일기가 너무 길어요 — 4,000자 이내로 줄여 주세요." |
| 강도 범위 밖(서버 `intensity`) | "감정 강도 값이 올바르지 않아요…" |
| 날짜 형식(서버 `entry_date`) | "날짜 형식이 올바르지 않아요." |
| 그 외(네트워크·서버 오류) | "별을 띄우지 못했어요. 잠시 후 다시 시도해 주세요." + 낙관적 별 롤백 |

- 카피 선택은 서버 sentinel **문구 매칭**이다 — 양쪽에 거울 주석 + 서버 테스트가 문구를 핀으로 고정(문구 변경 = FE 함께 변경). 기계가독 에러 코드(metadata)는 18+ 후보.

## 불변식 (invariants)

- **흰 화면 금지.** 모든 렌더 크래시·라우트 실패·없는 경로·렌더러 불가는 설계된 폴백으로 끝난다.
- **코어 가치 생존.** 캔버스 실패가 일기 작성 경로를 막지 않는다.
- **검증 실패는 영구 조건으로 안내.** "다시 시도하세요"가 아니라 무엇을 고치면 되는지 말한다(길이/빈 본문/강도). 낙관적 별은 롤백되고 서버에는 아무것도 생성되지 않는다.

## 구현 근거

- 바운더리·폴백: 구현 plan 17 · `frontend/src/app/{App.tsx,router.tsx,ui/ErrorScreens.tsx}`, `frontend/src/pages/home/ui/HomePage.tsx`(UniverseErrorCard·CanvasErrorFallback), `frontend/src/shared/ui/button-styles.ts`
- 렌더러 실패 표면화: plan 17 · `frontend/src/shared/lib/r3f/renderer.ts`(`RendererUnavailableError`), `frontend/src/widgets/universe-canvas/ui/UniverseCanvas.tsx`(state→render throw)
- 검증 피드백: plan 17 · `frontend/src/features/record-memory/{api/record-memory.ts,model/use-record-memory.ts}` ↔ `backend/internal/memory/`(sentinel — [domain/memory.md](../domain/memory.md) §RecordMemory 입력 검증)
