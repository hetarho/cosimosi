# 데이터 동기화·캐싱 (data-sync) 도메인 정책 (policy/domain/data-sync)

> 현재 구현된 클라이언트 데이터 계층(쿼리 캐시·무효화·스토어 병합·출처 경계)의 사실 정의.

## 정의

서버 상태의 소유자는 **TanStack Query(+connect-query) 캐시**이고, Zustand 스토어는 렌더
트리가 60fps로 읽는 **투영**이다(쿼리 데이터를 R3F가 직접 구독하지 않는다). cosimosi의
우주는 **단일 작성자**(나 자신 + 비동기 임베딩 워커)라서 갱신은 시간 만료가 아니라
**이벤트 기반 무효화**로 돈다 — 짧은 staleTime 폴링은 낭비이고, 멀티 디바이스 드리프트만
focus refetch가 안전망으로 커버한다. 쿼리 성공 → 스토어 반영은 **전체 교체가 아니라
병합(merge)** 이다: 무삭제(헌법2)·좌표 창발(헌법3) 전제에서 교체는 temp 별·인스턴스
슬롯·로컬이 앞선 타임스탬프를 깨기 때문이다.

## 규칙 · 파라미터

### 쿼리별 캐시 정책

| 캐시 | 키 | staleTime | gcTime | focus refetch | 갱신 트리거 |
|---|---|---|---|---|---|
| `GetUniverse` | connect-query 생성 키 | 5분 | 30분 | true (stale일 때만) | RecordMemory 성공 **+10s 지연 invalidate 1회**(연속 기록은 마지막 1회로 코알레스) |
| `ListDormant` | connect-query 생성 키 | 5분 | 10분 | 기본(false) | RecallMemory 성공 시 invalidate(회상된 별은 잠에서 깸) |
| `Record`(원본) | `['record', memoryId]` 손 키 | **Infinity**(불변 — 헌법1) | 30분 | — | 없음 — RecallMemory 응답을 `setQueryData`로 시드(영구 캐시, 재열람 무스피너) |
| 전역 기본값 | — | 60s | 기본 | false | 새 쿼리의 보수적 안전망 |

- 키·queryFn·캐시 정책은 **그 쿼리를 소유한 슬라이스에 함께** 둔다: GetUniverse·ListDormant·Record 키는 `entities/memory/api`가 소유하고, invalidate 부분 키(`*InvalidateKey` — transport·input 생략, TanStack 부분 매칭)도 같은 파일에서 export한다(분산 시 무효화가 조용히 no-op이 되는 사고 방지).
- **무한·조건 폴링 금지(헌법6).** record 후 갱신은 횟수 제한 지연 invalidate뿐이다. 새 별이 연결을 못 받는 경우(τ 미달)도 정상이므로 "링크 생길 때까지" 폴링은 없다.
- **캐시 영속화 없음.** persistQueryClient/localStorage를 쓰지 않는다(공용 PC·mood 개인 데이터).

### 변이별 캐시 상호작용

| 변이 | 동작 |
|---|---|
| `RecordMemory` | 낙관적 별은 Zustand가 처리(쿼리 캐시에 낙관 쓰기 없음). 성공 +10s 후 GetUniverse invalidate 1회 — "별은 즉시, 연결은 다음 refetch에서"(§4.6) |
| `RecallMemory` | **touch는 매 열람마다 발사**(재점화 의미론 — 캐시 히트가 touch를 생략하면 감쇠 모델이 굶는다). 응답 Record를 영구 시드. 재열람 = 캐시에서 즉시 본문 + touch는 백그라운드. touch 실패는 비차단(Sentry 기록, 다음 열람 재시도). 성공 시 ListDormant invalidate |
| `ReinforceLinks` flush | **캐시 무효화 없음** — 명령형 keepalive 호출 유지(React 훅 생명주기 밖, 헌법6). batch_id 멱등 + 병합 max 규칙이 수렴 보장 |

### 동기화 = 병합 (merge)

| 대상 | 규칙 |
|---|---|
| 별 | `memory_id` 키. 기존 `StarNode` **객체 보존**(슬롯 `index`·seed·좌표 유지), `lastRecalledAt = max(서버, 로컬)`. 서버 신규 별은 끝에 append(다음 슬롯). 로컬 전용 별(temp-·확정 직후)은 유지 |
| 시냅스 | `(a_id, b_id)` 무방향 키. `weight = max(서버, 로컬)`(미flush 강화 델타의 시각적 후퇴 금지), `lastActivatedAt = max` 후 **brightness는 그 타임스탬프에서 재파생**(`starBrightness(ts, now)`) — 서로 다른 시점에 구운 brightness끼리 max를 하면 감쇠가 동결되기 때문. `reinforcedRecency = max` |
| temp 별 | 병합은 `temp-`를 건드리지 않는다. 확정 교체는 `replaceStar` 소유 — refetch가 확정 별을 먼저 들여온 경우(레이스) temp를 **제거**해 같은 기억이 두 별로 그려지지 않게 하고, temp가 이미 사라진 경우(= 출처 리셋이 제출 중 발생)는 **추가하지 않는다**(이전 출처 소유 — 소유자의 다음 GetUniverse가 보여줌) |
| no-op | 아무것도 안 바뀌면 **같은 배열 참조 반환** → 스토어 미갱신·InstancedMesh 재구축 생략. protobuf-aware structuralSharing이 내용 동일 refetch의 data 참조를 유지해 병합 자체가 안 돈다 |

### 출처 경계 리셋 (identity boundary)

| 전환 | 동작 |
|---|---|
| 로그아웃·다른 계정 사인인 (`onAuthStateChange` uid 변화) | `queryClient.clear()` + 별/시냅스 스토어 리셋 + 선택 해제 + **공동회상 세션 교체**(미flush 페어·델타·lastViewedId 폐기) — **이벤트 시점(렌더 전)** 수행이라 이전 계정의 별·일기 본문이 한 프레임도 새지 않는다 |
| 체험(demo) enter/exit | 동일 리셋 — demo와 실서버가 **같은 쿼리 키**를 쓰므로 출처 전환 = 캐시 무효. shared의 demo flag가 콜백 주입점(`setDemoModeListener`)을 두고 app이 리셋을 주입한다(상향 import 없이) |
| 늦게 도착한 응답 | 리셋 **이후** 해소되는 in-flight 응답은 캐시·스토어에 쓰지 않는다 — RecallMemory는 언마운트(cancelled) 가드를 캐시 시드보다 앞에 두고, RecordMemory는 temp 별 부재(=리셋 발생)를 감지해 별 추가·지연 invalidate를 모두 건너뛰며, flush 실패 재병합은 세션이 교체됐으면 폐기한다 |

### 전송 (transport)

| 규칙 | 값 |
|---|---|
| 멱등 읽기 = HTTP GET | `GetUniverse`·`ListDormant`에 proto `idempotency_level = NO_SIDE_EFFECTS` + 웹 transport `useHttpGet: true` (connect-go는 GET 자동 수용) |
| transport 단일 인스턴스 | `shared/api/transport.ts` 하나를 TransportProvider·queryFn·명령형 client가 공유(키 공간 분열 방지). 인증 인터셉터·keepalive fetch 유지 |
| 요청 메시지 상한(17) | `connect.WithReadMaxBytes(256KiB)` — 정상 최대 페이로드(일기 4000자 ≈ 16KB)의 넉넉한 헤드룸, 초과는 `ResourceExhausted`로 거부(핸들러 진입 전) |
| 서버 타임아웃(17) | `ReadHeaderTimeout 10s` + `ReadTimeout/WriteTimeout 30s` + `IdleTimeout 120s`(h2c 스트림에는 Read/Write가 per-stream 적용; IdleTimeout만 `http2.Server`에 미러) |
| 패닉 복구(17) | RPC: `connect.WithRecover` → 스택 slog + Sentry 캡처(주입 훅) + `CodeInternal`(값 비유출). 워커: 잡 단위 recover → 스택 slog + 백오프 실패 처리 — 단일 바이너리(API+워커)가 죽지 않는다 |

## 불변식 (invariants)

- **병합은 추가-단조(append-monotone).** 어떤 refetch도 별·시냅스를 스토어에서 제거하지 않는다(헌법2). 제거가 일어나는 유일한 지점은 출처 경계 리셋(전체 초기화)뿐이다.
- **원본 Record 캐시는 영구 신선(헌법1).** 불변이므로 재검증하지 않는다 — 같은 별 재열람에 네트워크 왕복·스피너가 없다.
- **flush 경로는 쿼리 레이어 밖.** `ReinforceLinks`는 mutation 훅으로 감싸지 않는다 — beforeunload/visibilitychange + keepalive가 페이지 teardown을 견뎌야 하기 때문(헌법6).
- **렌더 60fps 데이터는 쿼리가 아니다.** 좌표 버퍼·프레임 데이터는 ref/스토어 경로(§3.2) — 쿼리 캐시는 서버 상태만 담는다.

## 구현 근거

- 쿼리 옵션·병합 동기화·invalidate 키: 구현 plan 16 · `frontend/src/entities/memory/api/{universe-query.ts,dormant-query.ts,record-query.ts}`, `frontend/src/entities/memory/model/merge.ts`(+`merge.test.ts`)
- 캐시 정책 등록·전역 기본값: plan 16 · `frontend/src/app/query-client.ts`(`RECORD_QUERY_DEFAULTS` 등록), `frontend/src/app/App.tsx`(TransportProvider)
- 변이 상호작용: plan 16 · `frontend/src/features/record-memory/model/use-record-memory.ts`(+10s 코알레스 invalidate), `frontend/src/features/recall/ui/MemoryPanel.tsx`(시드·touch·dormant invalidate)
- 출처 경계 리셋: plan 16 · `frontend/src/app/model/{reset-universe-data.ts,auth-store.ts}`, `frontend/src/shared/lib/demo/flag.ts`(`setDemoModeListener`), `frontend/src/features/recall/model/recall-flush.machine.ts`(`RESET` — 세션 교체·리셋 후 재병합 폐기 — tech/state-machines.md)
- 낙관적 레이스 가드: plan 16 · `frontend/src/entities/memory/model/store.ts`(`replaceStar` 중복 확정 별 가드·리셋 후 미추가), `frontend/src/features/record-memory/model/use-record-memory.ts`(temp 부재 시 지연 invalidate 생략)
- HTTP GET: plan 16 · `proto/cosimosi/v1/memory.proto`(NO_SIDE_EFFECTS), `frontend/src/shared/api/transport.ts`(`useHttpGet`)
