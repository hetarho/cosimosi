# 별 (star) (policy/domain/star)

> 현재 구현된 별의 사실 정의.

## 정의

**별(star) = 하나의 기억 흔적(엔그램)을 표상하는 가변 오브젝트.** 현재 구현에서는 **일기 1편 = record 1개(불변 원본) = memory 1개(별)** 의 1:1 관계다 — record 1개를 쓰면 별 1개가 생긴다. 사용자가 쓴 **원본 일기(record)는 별이 아니다**: record는 불변·영구 보관되는 별도 레이어(`records`)이고, 별은 그 record를 가리키는(`memories.record_id`) 가변 표상(`memories`)이다(헌법1).

별의 *지금 모습*은 결정론적 시드와 사용자가 고른 감정에서 나온다 — 색은 감정(mood)에서, 크기는 강도(intensity)에서, 형태는 시드에서 정해지고, 밝기는 회상 최근성으로 감쇠한다. 감정·강도는 **사용자가 기록 폼에서 직접 고른다**(AI 감정 감지가 아니다). 좌표는 별의 속성이 아니라 클라이언트가 결정론적으로 배치하며 서버는 좌표를 저장하지 않는다(헌법3 — navigation 정책 소관).

> 일기 1편 → N 조각 별 분할, 조각별 AI 감정 감지, 재공고화 재성형, 야간 요지화, 관련성·감정 가중 변조 감쇠는 plan 20·21·23·26·27에서 다룬다(아직 정책 아님).

## 규칙 · 파라미터

### 별이 되는 조건 (genesis)

| 규칙 | 값 / 조건 |
|---|---|
| 일기 1개 = 별 1개 | record 1개 → memory 1개 (1:1); `RecordMemory`가 record·memory·embed job을 한 트랜잭션으로 생성 |
| record는 별이 아니다 | record는 불변·영구(`records`, UPDATE/DELETE 금지); 별은 `memories.record_id`로 record를 가리키는 가변 행 |
| 낙관적 별 등장 | 제출 즉시 `temp-` id로 별 1개를 띄우고, 서버 확정 `memory_id`로 교체(seed 재파생) — 실패 시 임시 별만 롤백 |

### 감정 입력 (emotion)

| 규칙 | 값 / 조건 |
|---|---|
| mood·intensity는 사용자 입력 | 기록 폼의 mood `<select>` + intensity 슬라이더(0..1); `records.mood`/`records.intensity`에 저장 |
| 7 moods | `JOY`/`CALM`/`SAD`/`ANGER`/`FEAR`/`LOVE`/`NEUTRAL` (proto `enum Mood`와 단일 출처) |

### 시각 규칙 (appearance)

| 규칙 | 값 / 조건 |
|---|---|
| 형태 4종 (generative form) | `deepfield`(Crystal) · `aurora`(Nebula) · `liquid`(Liquid) · `ember`(Ember); 기본값 `deepfield`. 단일 `InstancedMesh` + TSL 노드 머티리얼(소수 draw call) |
| 색 = mood 팔레트 | mood → RGB 튜플 색; 팔레트 밖 값 → `NEUTRAL_RGB`(=`[0.6,0.6,0.6]`) 폴백(throw 금지). per-instance `aMood` attribute로 보존, 랜딩 테마와 독립 |
| 크기 = f(intensity) | `sizeFor(intensity) = 0.6 + clamp(intensity,0,1)·1.4` → 인스턴스 행렬 scale에 baked |
| 형태 시드 = 결정론적 | `seedFromId(memory_id)`(FNV-1a 32-bit → `[0,1)`); 같은 id → 같은 seed → 같은 형태. per-instance `aSeed`로 표면 무늬 변형 |
| 애니메이션 | 형태별 자가발광·뷰의존(fresnel)·변위; 공유 `uTime` uniform을 `useFrame`이 수동 갱신(BloomPass가 TSL `time` 노드를 우회하므로) |

### 밝기 · 감쇠 (brightness · decay)

| 규칙 | 값 / 식 |
|---|---|
| 시간 감쇠 `activation` | `activation(Δt) = exp(-λ·Δt_days)`, `λ = ln2/30` (`HALF_LIFE_DAYS=30` → λ≈0.0231/day); Δt=0 → 1, 30일 → 0.5. 단일 전역 λ |
| 밝기 바닥 `A_MIN` | **0.05** — 별은 0으로 꺼지거나 삭제되지 않는다(헌법2) |
| 별 유효 밝기 | `starBrightness = max(A_MIN, activation)` → per-instance `aBrightness`(forms가 emissive에 곱함) |
| 잠든(dormant) 판정 | raw activation `≤ 2·A_MIN`. 바닥 적용 *전* raw 값 기준. 서버 `ListDormant`는 동등한 시각 cutoff로 환산 |
| 계산 위치 | 밝기·activation은 **클라이언트가 렌더 시 계산**; 서버는 `last_recalled_at`/`last_activated_at`만 저장(밝기 컬럼 없음) |

## 불변식 (invariants)

- **별은 삭제되지 않는다(헌법2).** 감쇠는 밝기만 낮추며, 유효 밝기는 `A_MIN=0.05` 바닥 위로 유지된다. 잠든 별도 `A_MIN` 잔광으로 계속 렌더되고 클릭 가능하다 — 물리 삭제·소멸이 없다.
- **원본 record는 불변·영구다(헌법1).** 별의 색·크기·밝기는 모두 가변 별 레이어(`memories`)·클라 렌더 계산에서만 결정되고, `records`는 UPDATE/DELETE되지 않는다.
- **시드 재현성(헌법3).** 같은 `memory_id`는 항상 `seedFromId`로 같은 시드 → 같은 형태. 새로고침·재진입 후에도 같은 별 모양. 별은 좌표를 속성으로 갖지 않는다(좌표는 클라 결정·서버 비저장).
- **model 순수성(헌법4).** `entities/memory/model/**`·`shared/config/mood.ts`의 도메인 식(`activation`·`starBrightness`·`isDormant`·`seedFromId`·`MOOD_PALETTE`)은 three/React/DOM을 import하지 않는다(모바일 재사용).
- **렌더 권위(헌법8).** 수천 별은 단일 `InstancedMesh`로 그려 draw call이 별 수에 비례하지 않는다. 색·밝기·시드는 uniform이 아니라 per-instance attribute에서 온다.

## 구현 근거

- 형태 4종·InstancedMesh·TSL·색=mood·크기=f(intensity)·`seedFromId`·`activation`·`A_MIN`: 구현 plan 08 · `entities/star/ui/forms.ts` · `entities/star/ui/StarField.tsx` · `entities/star/model/{kinds,types}.ts` · `entities/memory/model/{activation,seed,types}.ts` · `shared/config/mood.ts`.
- 시간 감쇠 운영·`starBrightness=max(A_MIN, activation)`·dormant `≤2·A_MIN`·서버 `ListDormant` cutoff: 구현 plan 12 · `entities/memory/model/activation.ts`.
- 사용자 감정·강도 입력(mood select + intensity 슬라이더) → `records`: 구현 plan 04 · `features/record-memory/ui/MemoryForm.tsx` · `features/record-memory/model/use-record-memory.ts`.
- record(불변)/memory(별) 분리·낙관적 단일 별: 구현 plan 03·04·10 · `backend/internal/db/migrations/00001_engram_schema.sql` · `features/record-memory/model/use-record-memory.ts`.
