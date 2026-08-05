---
name: review-ux
description: >-
  Review a UI surface against the repo's UX criteria and fix what the review finds — the runnable form of the
  design-review rubric. Use when the user says "/review-ux <target>", "review the UX of X", "UX 검사", "위계 점검해줘",
  "이 화면 디자인 점검", "왜 이 페이지 안 예뻐 보이지", or wants a screen/page/feature audited for hierarchy, typography,
  spacing, contrast, glass legibility, motion or a11y — even if they don't say "review". The target parameter is a
  route (/landing), a page/feature name, or an FSD path. The criteria are owned by spec/policy/ux/ui-principles.md and
  the rubric by spec/policy/ux/design-review.md — this skill is the procedure that applies them to real code and
  applies the safe fixes, not a second copy of the rules.
---

# UX review + fix (/review-ux <target>)

**Criteria SSOT = [spec/policy/ux/ui-principles.md](../../../spec/policy/ux/ui-principles.md)** (what good looks
like, with evidence tiers), **rubric = [spec/policy/ux/design-review.md](../../../spec/policy/ux/design-review.md) §3–§5**
(the dimensions, the scale, the ledger), **decisions = [spec/tech/design-language.md](../../../spec/tech/design-language.md)**
(tokens, type roles, materials) and **[spec/tech/design-system.md](../../../spec/tech/design-system.md)** (primitives,
a11y baseline). Read ui-principles before scoring — the whole point of that document is that a finding cites a
criterion (`§N`), not a taste.

## 1. Resolve the target

The argument may be a route, a page name, a feature, or a path. Map it to the FSD slices that render it:

- route → `apps/web/src/pages/<slice>` (check `app/` routing if unclear), plus the widgets/features it composes;
- a name → glob `apps/web/src/{pages,widgets,features}/*<name>*`;
- include the mobile sibling (`apps/mobile/src/...`) when one exists — rubric dimension 8 needs it;
- if a `spec/tech/<unit>.md` or `spec/policy/ux/<unit>.md` exists for this surface, read it: it carries decisions
  the review must not contradict (e.g. a deliberate absence is a decision, not a gap).

## 2. Load the criteria that apply

Always: ui-principles (all of it — it is short), design-language §3–§5 (type roles, spacing/hierarchy, materials),
design-review §3.1 + §4 (dimensions and scale). Conditionally: design-language Part II when the surface touches the
3D scene; the surface's own policy/ux doc; [spec/policy/ux/public-copy.md](../../../spec/policy/ux/public-copy.md)
for public pages.

## 3. The static pass — what to actually check

Walk the surface's TSX/styles against these, citing `file:line` + the principle (`ui-principles §N`) for every
finding. This list is the rubric's dimensions made greppable; it does not replace reading the rendered result.

| Dim | Check in code |
| --- | ------------- |
| 1 Hierarchy | One primary action per screen; one `contained` button per group; ≤2 "big" elements; emphasis spent once (§1). First screenful carries message + primary action (§3). |
| 2 Typography | Every heading/text uses a design-language §3.2 role recipe verbatim — a locally invented `text-*`/`font-*` combo is a finding, not a style. Prose capped by measure; Korean display copy has `keep-all` (+ `break-word`, `text-wrap: balance`) (§4). |
| 3 Spacing | Values on the token scale only; density altitudes (control 2–3 · panel 4–5 · between panels 6–8); gaps inside a group visibly smaller than between groups (§2); borders only where spacing failed. |
| 4 Colour | No literals (`lint-style-escapes` should already hold this); accents on controls not areas; status colour never alone; de-emphasized text on tinted grounds keeps hue (§5); text-bearing glass declares a contrast floor and text surfaces are never pure black (§5). |
| 5 Consistency | Primitives from `@cosimosi/ui`, not lookalikes; same thing renders the same everywhere; icons via the bound meanings, `aria-hidden`, labelled when alone. |
| 6 Motion | Durations/easings from tokens, never raw numbers; motion confirms, never blocks; reduced-motion loses nothing — camera travel/parallax stop, local life may stay (§8). |
| 7 Emotion/brand | The surface has a designed peak and a composed ending, not uniform spectacle (§10); copy passes the five-second test on public pages (§3); no deceptive pattern shapes (§9). |
| 8 Parity | Mobile sibling reads the same, or a written waiver exists (precedent: landing's §8). |

Cross-cutting: states complete per design-language §9 (a missing empty/error/loading state is a finding); focus
ring is the shared role and never fully obscured; hit areas ≥24px (44–48 preferred) counting the hit region, not
the drawing; every string through i18n.

## 4. The visual pass (when looks are the complaint)

Static greps cannot score what the eye does. When the finding is about how it reads — hierarchy, glass legibility,
squint test — run the app and look: headless Chrome + CDP screenshots work for WebGPU surfaces (no browser MCP
needed). Score the screenshot with ui-principles §1's squint test and §3's five-second test. Skip this pass only
when every finding is mechanical.

## 5. Score, then split the findings in two

Score all 8 dimensions on the design-review §4 scale (Meets / Needs-work / Blocking), including untouched ones.
Then split:

- **Fix now** — the code drifted from an approved pattern and the fix restores it (a role recipe, a token step, a
  missing state, a11y wiring, keep-all, i18n). Design-review §1 exempts "layout that follows an approved pattern",
  so these need no review round. Fix, then verify with `pnpm check`.
- **Propose, don't invent** — the right fix needs a decision that does not exist (a new token, a new type tier, a
  changed material, anything that alters what the product looks like beyond restoration). Inventing it locally is
  the exact failure ui-principles §1 names. Record it as a proposal naming the decision's home (design-language §N)
  and the route (a change doc + a design-review round). Never silently change the language.

## 6. Report

End with the ledger, design-review §5's shape:

| Dim | Score | Finding (file:line · criterion) | Status |
| --- | ----- | ------------------------------- | ------ |

`Status` ∈ fixed / proposed (with its home) / meets. Then one line each: what `pnpm check` said, and what remains
that only a human eye or a design decision can close. Do NOT auto-commit.
