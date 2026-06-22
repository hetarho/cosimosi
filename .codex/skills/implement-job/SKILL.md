---
name: implement-job
description: >-
  Implement a job from spec/jobs/ end-to-end — the unified implementer for BOTH new builds and changes (the job's
  frontmatter `type: new|change` decides). Use when the user says "job NN 구현해줘", "/implement-job NN", "implement
  job NN", "이 job 마저 구현", or to continue building a scaffolded job. Claims the job in 00.overview (so concurrent
  agents don't collide), reads the source spec (plan or change) + grounding, works the 구현 체크리스트 top-to-bottom
  (regen with `pnpm gen`/`db:migrate`/`gen:values` as contracts/schema/tuning move), verifies (인수 조건 true + no
  regression for changes + build/lint/vet), code-reviews (/code-review), reflects the result into the SSOT
  (plan/policy/tech/values; archives the change doc if type=change), and marks the job done. Do NOT auto-commit.
---

# Implement a job (unified: new + change)

A **job** (`spec/jobs/NN.*.md`) is the buildable work doc. Its frontmatter tells you everything:
`type` (new|change), `source` (the plan or change it implements), `plan` (the plan built/modified), `status`.
You implement its **구현 체크리스트** and verify against its **인수 조건**.

## Step 0 — Claim the job (concurrency)

Open `spec/jobs/NN.*.md`. Read its frontmatter. In `00.overview.md`'s **진행 현황** board, check the `plan:` isn't
already 🟡 claimed by another in-flight job/agent. If free, set it 🟡 (job NN) and set the job's frontmatter
`status: doing`. This is how parallel agents avoid stepping on each other — claim before building.

## Step 1 — Read the source + grounding

Read the `source` spec in full (`plan/NN` for new, or `changes/NN` for change — esp. its 수용 기준 and 범위/비목표),
its 참고 (`tech/*.md`, `policy/**`, `concept.md`), and the **8 불변 원칙** in 00.overview. For `type: change`, also
read the modified `plan` and note the existing 수용 기준 you must NOT regress. Grep the code the spec names — that's
your blast radius (it should match the job's 영향 파일).

## Step 2 — Build the 구현 체크리스트 top-to-bottom

Implement tasks in order; flip `- [ ]` → `- [x]` in the job as you finish each. Match surrounding code style. Run
the matching regen when something ripples:

| You changed | Run |
|---|---|
| `proto/**/*.proto` (RPC contract) | `pnpm gen:proto` → fix call sites |
| a goose migration (+ sync `schema.sql`) | `pnpm db:migrate` |
| sqlc queries / schema | `pnpm gen:sql` |
| a tuned scalar in `spec/values.yaml` | `pnpm gen:values` |
| both proto and schema | `pnpm gen` |

**config 규칙 — 하드코딩 금지:** 새로 필요하거나 바뀐 설정·튜닝 수치(임계값·계수·상한·기본값 등)는 코드에 박지 말고
`spec/values.yaml`에 두고 `pnpm gen:values`로 생성된 FE(TS)·BE(Go) 상수를 import한다 — config의 단일 출처는 values.yaml다.
(공식·배열 콘텐츠(테마 CSS·mood 색표)·proto/DB 스키마는 제외 — 코드/proto/sqlc 소관.) 작업 중 기존 하드코딩 config를 만나면 이 기회에 values.yaml로 옮긴다.

**주석 규칙 — 미래 독자를 위한 "왜"만 (대화·이력 기록 금지):** 주석은 *지금 코드를 처음 보는 사람*이 코드만으로는 알 수
없는 것에만 단다. 비용 대비 가치로 판단한다 — 좋은 주석은 코드 추적 수천 토큰을 줄여주지만, 나쁜 주석은 토큰만 먹고
금세 거짓이 된다.
- **달 가치 O:** 코드에 없는 외부 제약(`camera far=4000`이라 `RADIUS`는 이래야 함, BloomPass가 time 안 굴림 등),
  비자명한 설계 의도("왜 이 효과만 navy↔mood mix인가"), spec/불변 원칙 연결, 함정·불간섭 보장(depthWrite/raycast 이유).
- **달지 말 것 X:** 변경 이력(`0.4 -> 0.75로 상승`, `예전엔 280이었다` — git이 기억), 코드를 그대로 옮긴 동어반복
  (`// time을 bump`), 리팩터/대화 과정 서사(`예술적 개편:`, `튜닝했다`), 현재 값에서 자명한 것. 과거 값·작업 동기는 코드에 남기지 말고 커밋 메시지로.
- 새 코드는 이 기준으로 달고, **손대는 파일에서 위 X 류 기존 주석을 만나면 "왜"만 남기고 정리**한다 (스코프 밖 파일은 건드리지 않음).

**Windows toolchain (this machine):** unsigned `.exe` in the user dir is blocked, so `go`/`sqlc`/`buf`/`goose`
**never run on the host** — always Docker; the `pnpm` scripts already do this. Ad-hoc Go:
`docker run --rm -v ${PWD}/backend:/app -w /app golang:1.26 sh -c "go build ./..."`. `pnpm db:migrate` needs
Postgres (`pnpm infra:up` first). Generated code is committed — leave new `*/gen/` files for the user.

## Step 3 — Verify

1. Codegen/migration/values applied, no errors (not skipped).
2. FE specs → `pnpm --filter ./frontend build` + `lint` (0 errors). BE specs →
   `docker run --rm -v ${PWD}/backend:/app -w /app golang:1.26 sh -c "go vet ./... && go build ./..."` (the `&&`
   must run *inside* the container).
3. **인수 조건 — the acceptance bar.** Go criterion by criterion; confirm each is **true in the running code**
   (curl, psql `\d`, grep, a UI check). Tick each `- [ ]` in the 인수 조건 section.
4. **For `type: change` — no regression:** the existing `plan` 수용 기준 this change does not intend to alter still hold.
5. Constitution sanity — no `DELETE FROM records|memories|memory_links` / `UPDATE records` (body), per 불변 1·2
   (legit `weight`/`last_*` updates and goose `Down` DROPs are fine).

Fix and re-run any red check before reporting.

## Step 4 — Code review → refactor

1. **`/code-review` on the diff — always.** Apply findings; note rejections (in the job).
2. **`/codex:review` — for non-trivial logic** (skip small/mechanical; or if the user says "just /code-review").
   Real Codex engine, different model — strong on race/lifecycle + second-order bugs.
   - **Invoke `/codex:review --background`.** If asked "Wait / Run in background", choose background.
   - ⚠️ **Run Codex with `-m gpt-5.5`** (this box's ChatGPT-account CLI rejects every `*-codex` model, and the CLI
     default is one — a bare `codex exec` fails; 5.4 is the fallback). If `/codex:review` isn't invocable, run Codex
     directly as a background **Bash** task (NOT via `codex:rescue`):
     `codex exec --skip-git-repo-check --sandbox read-only -m gpt-5.5 - < prompt.txt > review.txt 2>&1`, then
     `TaskOutput(block=true)`.
   - ⚠️ **Never route codex through `codex:rescue` or any sub-agent** (double-background trap; a sub-agent can
     silently substitute a non-Codex review). If `/codex:status` shows codex unavailable, say so — don't pass off a
     non-Codex review as codex.
   - Run `/code-review` while codex runs (~25 min); **don't end the turn waiting** — block in-turn
     (`TaskOutput(block=true, timeout=600000)` ~3×), then merge (dedupe + severity-rank).
3. **주석 패스 — diff의 신규/수정 주석을 Step 2 주석 규칙으로 훑는다.** 변경 이력·동어반복·`예술적 개편:` 류
   리팩터 서사는 "왜"만 남기고 쳐낸다. 외부 제약·비자명한 설계 의도가 *빠진* 비자명 코드엔 한 줄 보탠다. (별도 패스가
   부담이면 `/code-review`에 "주석 품질도 봐줘"를 끼워 한 번에.)
4. Re-verify (Step 3) if the review changed code.

## Step 5 — Reflect into the SSOT, finish (and do NOT commit)

A job is done when the **docs are true again**, not just when code builds:

1. **`plan/NN.*.md`** — update to the new current reality (new fields/rules/범위/수용 기준). plan is as-built; no checkboxes.
2. **`policy/**` · `tech/**`** — update any rule/contract the work set or changed (the owner doc).
3. **`spec/values.yaml`** — if a tuned scalar was set/changed, edit it there and `pnpm gen:values` (never hand-edit the generated constant).
4. **If `type: change`** — move the `source` `spec/changes/NN.*.md` → `spec/changes/archive/NN.*.md` (create `archive/` if absent).
5. **Close out** — job frontmatter `status: done`, all checkboxes ✅; 00.overview 진행 현황 for the `plan` → ✅ (clear the 🟡 claim).
6. **Archive the job** — move this `spec/jobs/NN.*.md` → `spec/jobs/archive/NN.*.md` (create `archive/` if absent), so `jobs/` lists only todo/doing work. The archived doc is a historical record — its relative links may go stale (no depth fix needed); only its frontmatter `source`/`plan` numbers must stay correct. Numbering stays safe: `pnpm spec:job` counts `archive/` too (monotonic), so the next job never reuses NN.

Report:

```
✅ Job NN — <제목> (<type>)  완료
- 출처: <plan/NN | changes/NN>  ·  plan: <plan/NN>
- 구현: 구현 체크리스트 T001–TNNN ✅
- 코드젠/마이그레이션/values: <결과, 또는 "해당 없음">
- 검증: build ✅ · lint ✅ · 인수 조건 <항목별 ✅> (+ change면 회귀 없음 ✅)
- 리뷰: /code-review <반영 N·기각 M+이유> (+ codex <합산> 또는 "생략")
- SSOT 반영: plan <갱신> · policy/tech <갱신/없음> · values.yaml <갱신/없음> (+ change면 changes/ archive)
- 정리: job → jobs/archive/ 이동 (jobs/엔 todo/doing만)
- 커밋: 안 함 — 변경 파일 준비됨. 커밋은 직접 (Conventional Commits, 영문 제목/한글 본문).
```

**Don't run `git commit`.** The user commits.

## Refactor jobs

If frontmatter says `type: refactor`, read `source: code-review/NN.slug` instead of a plan or change document.
Treat the linked report as evidence and scope, then implement only the job checklist. Refactor jobs are normally
behavior-preserving:

- verify the targeted structure, boundary, duplication, or documentation problem is improved
- verify user-facing behavior, APIs, data semantics, and policy remain unchanged unless the job explicitly says otherwise
- do not archive a `code-review/` source report automatically; it is a historical audit record
- reflect only true as-built changes into `plan/`, `policy/`, `tech/`, or `values.yaml`
- clear the job status and archive the completed job the same way as other job types
