# 우주 공개 (sharing) 도메인 정책 (policy/domain/sharing)

> 현재 구현된 우주 공개 표면(공개 URL `/u/:slug` + `ShareService`/`VisitService`)의 공개 단위·
> 표면 격리·슬러그·프라이버시 규칙의 사실 정의. (spec 35 — `backend/internal/share`,
> `proto/cosimosi/v1/share.proto`, `backend/internal/platform/rpcserver/server.go`,
> `frontend/src/pages/visit`, `frontend/src/features/share-universe`)

## 공개 단위 — 풍경만, 내용 제로

- 공개되는 것은 **우주의 풍경뿐**: 별의 감정(색)·강도(크기)·날짜, 시냅스(인덱스 쌍+weight),
  소유자의 시각 설정(배경 테마·오브제·감정색). **일기 본문·조각 텍스트는 어떤 경로로도 나가지
  않는다.**
- 전용 DTO로 **타입 수준 보장**: `SharedStar`/`SharedSynapse`엔 `body`·`fragment_text`·
  `record_id`·`memory_id`·정확 타임스탬프 **필드가 아예 없다**(누락이 아니라 부재). `GetUniverse`의
  `Star`(필드가 계속 자람)를 재사용하지 않는다 — 새 필드가 공개로 새는 것을 구조적으로 차단.
- **별 식별자 없음:** 응답 배열의 인덱스가 곧 별 id다. 시냅스는 그 인덱스 쌍으로만 잇는다.
- **타임스탬프는 일 단위 양자화**(`last_recalled_day`·`created_day` = epoch days). 정확 시각을
  주지 않아 행동 핑거프린팅(언제 일기를 쓰고 회상하는지)을 무디게 한다.
- **좌표는 보내지 않는다**(헌법3). 방문자 브라우저의 force-sim이 재창발하므로 방문마다 배치가
  미세하게 다른 건 의도된 자연스러움이다.
- **요즘 하늘색(ambient, spec 25)은 서버가 계산하지 않는다** — 클라가 공개된 별들에서 파생한다
  (`deriveAmbient`, 데모/폴백과 같은 경로). proto `Ambient` 필드는 향후 서버 계산용으로 비어 둔다.

## 공개 표면 격리 — 무인증은 `VisitService` 하나뿐 (fail-closed)

- 무인증으로 도달 가능한 RPC는 **`VisitService.GetSharedUniverse` 단 하나**다. 별도 service로
  분리해 **그 핸들러에만 auth 없는 인터셉터 체인**(logging→recover, 256KB read cap 유지)을
  장착한다. 나머지 모든 service(`Memory`·`Settings`·`Admin`·`Share`)는 기존 auth 체인을 그대로
  유지한다 — allowlist 구멍이 아니라 service 분리라, 실수로 다른 RPC가 공개로 새는 구조가 없다.
- `ShareService`(소유자 설정)는 **인증 체인 그대로**다. `user_id = JWT sub`로 자기 행만 읽고
  쓴다(교차 사용자 접근 경로 없음).
- 17의 요청 한도(256KB read cap·서버 타임아웃)는 무인증 표면에도 동일 적용된다.

## 슬러그 규칙

- **추측 불가가 1차 방어선:** `crypto/rand` 16바이트 → base64url 22자(128bit).
- **최초 켜기에 생성**된다. 끄고 다시 켜면 같은 슬러그를 재사용한다(회전이 아닌 한).
- **회전(rotate):** 새 슬러그를 발급하고 **이전 URL은 즉시 무효**가 된다.
- **균일 NotFound:** 존재하지 않는 슬러그·꺼진 공유(`enabled=false`)·빈 우주를 **구분 없이 동일한
  NotFound**로 응답한다(존재 비노출). 슬러그→소유자 조회는 `enabled=true`일 때만 행을 돌려준다.

## 방문자 — 순수 읽기

- 방문 페이지(`/u/:slug`)는 **SessionGate 밖**의 공개 라우트. 우주 캔버스를 읽기 전용으로
  재사용한다 — 기록 폼·회상 패널·시뮬 패널 없음, 별을 눌러도 **어떤 일기·조각 텍스트도 뜨지
  않는다**(바라보기·fly-to만).
- 방문은 **쓰기 RPC를 한 건도 호출하지 않는다**(회상 강화·기록은 소유자 전용). 공개 전송은
  인증 인터셉터가 없는 **전용 무인증 transport**라 토큰을 절대 싣지 않는다.
- 방문 페이지는 소유자의 시각 설정·풍경을 적용하되, **방문자 자신의 시각 설정은 보존**한다
  (진입 시 스냅샷→떠날 때 복원; 소유자 풍경이 방문자 기기에 눌러앉지 않게).
- 비로그인 방문자에겐 하단에 "나의 우주 만들기" CTA를 띄운다(유입 경로).

## 비목표 (현재 미구현)

- 별 단위 공개 수위(제목만/일부) — 35는 전역 한 단계(모든 별 내용 비공개·풍경 전체 공개).
- 친구 계정 그래프·팔로우·피드 — 없음(공유는 링크 전달로만).
- 공명 마커의 제3자 노출 — 36·37 소관(각자 자기 우주·겹침 뷰에서만).
