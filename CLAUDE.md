# cosimosi — Claude 작업 규칙

## 용어 정정 (Ubiquitous Language)

[spec/ubiquitous-language.md](spec/ubiquitous-language.md)가 이 프로젝트 어휘의 SSOT다. **한 개념 = 한 이름.**

사용자 지시에 UL과 어긋난 용어가 나오면, 알아서 의도를 해석해 넘어가지 말고 **먼저 정정한 뒤 작업한다.**

정정 절차:

1. UL을 열어 해당 개념의 정규 이름을 확인한다.
2. 답변 맨 앞에 한 줄로 짚는다 — `"X"는 UL에서 `Y`입니다 (§N)` + 근거 한 문장.
3. 정정한 용어로 작업을 계속한다. 지시가 명확하면 확인을 기다리지 않는다.
4. 정규 이름이 무엇인지 모호하거나 지시가 UL의 두 개념 사이에서 갈리면, 추측하지 말고 되묻는다.

정정 대상:

- **동의어·약어** — UL이 금지한다. 예: "엔그램" → `EpisodicMemory`, "메모리" → `EpisodicMemory` / `SemanticMemory` (어느 쪽인지 구분).
- **레이어 침범** — 렌더링 어휘(§4: `star` · `cell-star` · `filament` · `constellation` · `nebula` · `latent-star`)를 도메인 · DB · proto 맥락에서 쓰는 경우, 그 반대도 마찬가지. 예: "star 테이블" → `episodic_memories`.
- **시적 카피를 코드 이름으로** — 별가루 · 우주먼지 · 기억의 별 · 별의 영혼은 사용자 표시 전용이다. 코드에서는 `Twinkle` · `Neuron` · `EpisodicMemory` · `SemanticMemory`.
- **창발물에 타입 부여** — 별자리 · 성운 · 잠재 뉴런은 타입도 테이블도 없다. "별자리 테이블 만들어" 같은 지시는 정정 대상이다.
- **레이어 혼동** — 유스케이스(§2)와 도메인 순수 함수(§3)는 별개다. `Reinforce`≠`Potentiate`, `Depress`≠`Downscale`.

정정하지 않는 경우:

- 사용자 UI 카피·UX를 이야기하는 자리에서의 시적 표현 — 그게 정본이다.
- UL에 없는 순수 기술 용어(핸들러, 마이그레이션, 프로바이더 등).
- UL에 아직 없는 **새 도메인 개념** — 이때는 정정이 아니라, 코드보다 UL에 먼저 등재해야 한다고 알린다(§규칙).

용어의 *왜*와 신경과학 근거는 [spec/concept.md](spec/concept.md) · [spec/PRD.md](spec/PRD.md) §9가 소유한다 — UL은 이름만 정한다.
