# REPORT 261103-universe
> mode:autopilot | host:codex | from:2026-11-03T00:26:00Z | to:2026-11-03T00:43:53Z | push:-

## done
- Preserved the original web implementation at `40abb60fe1798c6e2072edd8539a7dea3c20f62c`. `/review` serves its isolated production build on the left and the working implementation's production build on the right. The review bridge pins the fixture draw and mirrors actual button actions; neither app receives product data or a review flag. `scripts/capture-universe-baseline.mjs --restore` rebuilds the retained commit, independently of working-tree edits. `node scripts/preview-universe.mjs` rebuilds the candidate and starts or reuses the preview server.
- ONB-9 / DEMO-25: the sequence hook can pause reading time while a host withholds its caption. The demo pauses during scene reveals, and the real onboarding host pauses during a time sweep. Skip and genuine user signals remain available.
- ONB-20: the real onboarding host retains each reported action until its step awaits it. Previously an early split or launch overwrote the pending writing-opened signal, potentially stranding the entry step. The shared signal channel remains one slot; buffering belongs to the host.
- DEMO-20/21: demo semantic stages project at the displayed sweep date. Previously brightness used the displayed date while gist stages used the immediately committed final clock, making gist bodies rise before their date arrived. Stored facts and the committed clock still update immediately.
- VIS-34: an awaken flare travels from its selected latent point to its actual live neuron in the simulation buffer, instead of disappearing in an unrelated place. Simulation positions remain ephemeral and determine every destination.
- VIS-5/9 / TIME-19: genuinely new memories emerge on a bounded, staggered smooth envelope after an advancing launch's sweep; a populated initial read stays at full size. The demo also defers the awaken ids until the displayed date lands. Gist rises ease into and out of their motion, with an immediate settled result under reduced motion. Awaken flares and mask transitions also respect reduced motion.
- VIS-10/33: a palette update invalidates color projections through an explicit revision rather than changing React keys. The star, nebula and gist layers retain their identity and ongoing rise state. Decoration changes update their body source without remounting the layer.
- ONB-18 / DEMO-32: Korean and English tour copy no longer assumes an empty universe or a first-ever record during replay. The sky caption describes all memories' strength-weighted emotions instead of claiming only reread memories contribute.
- The local comparison includes desktop/mobile viewport choices, independent enlargement, restart, synchronized button presses, and an expandable planning comparison. Its middleware is development-only and absent from the production route tree.

## decided
- Focused the document-to-code audit on the requested universe, tutorial, time, and decoration experience: ONB, DEMO, VIS and the relevant TIME/ARCH decisions. This is not an assertion that all backend/account/billing rules were exhaustively audited.
- Kept the retained build and its source archive under `.git/universe-review`; the tracked commit pointer and capture tool make it reproducible without checking generated bundles into source control. The retained build removes the local sign-in bypass from public build configuration.
- Did not change domain formulas, force layout semantics, account records, diary content, or the existing T213–T221 backlog.

## parked
- iOS/Android device rendering and gestures require device verification. The shared controller and renderer changes are included in the mobile typecheck; no native device result is claimed.
- ONB-25 remains the documented native-modal limitation: the guide's skip is hidden beneath the three native dialogs. This is not addressed by a web comparison or inferred solved from shared rendering changes.
- Existing pending renderer lifecycle/resource/performance tasks in STATE remain independent work. No whole-repository compliance or frame-rate claim is made.

## checks
- Passed: 430 unit tests — universe (328), universe-render (34), targeted web demo/timing (23), sequence (26), onboarding (19).
- Passed: web and mobile typecheck, web lint/boundary probe, package lint, FSD layout, package-entry boundaries, raw-string and public-copy checks.
- Passed: web production build; isolated baseline and candidate production builds; `git diff --check`; style-escape, comment and spec hygiene checks.
- Browser: both actual frames loaded the same fixture and date using the WebGL fallback in software Chromium, with a captured image at `/tmp/cosimosi-review.png`. Screenshot capture throttled requestAnimationFrame in the test browser to reduce software-renderer load; the app and review tool do not throttle it. No hardware frame-pacing claim is made.
- Browser bridge check: real trusted button clicks mirrored exactly once; independent mode, mobile viewport, findings, enlargement, Escape and restart passed. This check replaced only the iframe scene HTML with lightweight button fixtures so it verifies the comparison tool, not 3D rendering.
- A subsequent real-scene pass read, split and launched the same diary on both sides, reaching step 4 in both frames. Its capture is `.git/universe-review/first-launch.png`; it used OS reduced-motion emulation and throttled test-browser frames, so it proves the action sequence and rendered result rather than animation quality. The opening comparison capture is retained at `.git/universe-review/comparison.png`.
- The unthrottled software-GPU interaction pass timed out after issuing launch; full animated-tour visual verification and native-device validation remain unproven.

## next
- Review `/review` against the preserved implementation. Native-modal guide placement and physical-device animation validation remain separate follow-ups.
