# PROD product
> r2 | what cosimosi is and for whom, its actors and pages, the core concepts and end-to-end flows, and what is in scope, deferred or excluded

## decisions
- PROD-1 [o] cosimosi is a diary app whose diaries become a living 3D "memory universe": each diary splits into episodic memories (stars) built from neurons, and the universe changes by rules drawn from how memory works ← rules taken from memory science rather than invented ones make the changes both beautiful and true
  - definition: it encodes a diary into neuron ensembles (stars); memories connect by sharing neurons and form constellations; a star's brightness, size, shape and position change with time, recall, connection and emotion
  - the rules: encoding →=ENC, linking →=LINK, recall →=RECALL, forgetting →=FORGET, consolidation →=CONSOL
  - inspired by engram theory, an honest analogy and never a simulation →=SCI
- PROD-2 [o] the product answers three diary problems
  | problem | answer |
  |---|---|
  | writing a diary is a chore: a blank page gives little reason to start | every diary is shown visually the moment it is written; signup asks for a nickname only →=ACCT-6 |
  | written diaries are never read again | the memories are shown as a living universe: recall brightens them, neglect dims and abstracts them, and they link with one another |
  | old entries are hard to find in lists by date or title | memories are explored by meaning and context links (shared neurons), not by date, so discoveries cross time and place; the date-ordered archive stays secondary →=DIARY-2 |
- PROD-3 [o] the goal: users enjoy writing their diary and see which emotions they keep returning to; the universe's colour mirrors the emotions recalled, never the average of those written →=MOOD-5
  - this honest definition is the core of the product message: the landing walkthrough and the demo deliver it, never an overlay on the universe's sky →=MKT-17 →=DEMO
- PROD-4 [o] the target users are diarists interested in recording and looking back on their own lives; no neuroscience knowledge is needed, because the science runs only as internal rules →~MKT-2
- PROD-5 [o] actors
  | actor | kind | acts | owner |
  |---|---|---|---|
  | diarist | human, signed in | writes diaries, edits the split before launch, navigates the universe, recalls and views gists, reads and searches the archive, deletes and lets go, decorates, claims achievements, earns and spends Twinkle, invites friends | →=WRITE →=RECALL →=DIARY |
  | visitor | human, signed out | reads the landing and the blog, plays the frontend-only demo, follows the signup call; never touches a real universe and carries nothing over | →=MKT →=DEMO-7 |
  | invited friend | human | arrives through an invite link that binds itself at signup; receives no shared star while sharing is deferred | →=ACCT-8 |
  | operator | human, admin | the web-only admin console: account metadata, admin grants, Twinkle grants, AI provider keys and settings, AI usage, job health; never reads what a user wrote | →=ADMIN |
  | AI | system | proposes the split with names, moods, passages and neurons; embeds neurons; writes gist stage texts; judges whether a rewrite differs; suggests letting-go candidates; it proposes and the domain decides | →=AI →=ENC |
  | universe clock | system | moves only on a launch or a recall; each advance drives forgetting and consolidation over the crossed interval | →=TIME |
  | background worker | system | drains the job queue: AI work, consolidation follow-ups, deletion and withdrawal sweeps, achievement settlement | →=AI |
  - no payment provider acts on the product →~PROD-16
- PROD-6 [o] page map
  | page | path | access | role | owner |
  |---|---|---|---|---|
  | door | `/`, `/login` | public | the way in: sign-in, with the demo and the landing as side doors; a signed-in visitor goes on to the universe | →=ACCT-30 →=AUTH |
  | signup | `/signup`, `/invite/$token` | public | the door in signup mode, asking only a nickname; an invite link is captured, then signup opens | →=ACCT-6 →=ACCT-8 |
  | landing | `/about` | public | what the product is: the walkthrough, the lay theory, the demo and signup calls | →=MKT-15 |
  | blog | `/blog/` | public | the theory in depth, with papers and DOIs; static, same origin | →=MKT-5 |
  | demo | `/demo` | public | a frontend-only sandbox on fixed fixtures | →=DEMO-1 |
  | universe | `/universe` | signed in | the home and core surface: 3D navigation, star detail, writing, recall, the decoration panel, the time HUD | →=VIS-0 →=WRITE-1 |
  | diary archive | `/diary` | signed in | secondary: list, search, filters, calendar, the original, the whole-diary recall | →=DIARY-2 |
  | my page | `/me` | signed in | profile and account, mood colours, Twinkle, achievements, export | →=ACCT-9 |
  | admin console | `/admin` | operator | operations over metadata | →=ADMIN |
  - decoration is a panel over the universe, never a page →=DECOR-5
  - the onboarding tour runs over the real universe once when signup completes and is replayable from `/me` →=ONB-3
  - web only, by explicit waiver: the landing and the blog →=MKT-26, the demo →=DEMO, the admin console →=ADMIN; the mobile app carries sign-in, signup, the universe, the archive and `/me` under the parity rule →=ARCH
  - the spec names no domain name; the deployed origin is recorded in `DEPLOY.md` →=ARCH
  - dev-only diagnostics routes are not product pages; routing mechanics →=CLIENT
- PROD-7 [o] the universe is the user's memory space: it starts empty except for gray latent stars in the background, and stars arise only from writing diaries →=ACCT-2 →~VIS-7
- PROD-8 [o] a memory is a bundle, not a point: a `Neuron` (drawn as a cell-star) is one element of a memory (a meaning, a place or an entity) shared by many memories, and an `EpisodicMemory` (drawn as a star) is a sparse ensemble of neurons →=MEM
  - the star is the trace an experience leaves; the `Diary` is the record of the experience →!INV-2
  - the ensemble guardrail →=INV
- PROD-9 [o] memories connect only by sharing neurons: neurons that fire in one memory bind by synapses, two memories sharing a neuron are connected, and constellations emerge from that sharing and its synapse strength →!INV-4
  - time, context and topic never set position directly: closeness in time or context raises the chance of sharing neurons, which draws memories together →=LINK-7
  - similar emotions never group memories →!INV-3
- PROD-10 [o] the universe has two stores along z: the hippocampal universe below (concrete, fast, where memories are born) and the neocortical universe above (gist, slow, stable); a memory rises as gist and then exists in both →=CONSOL-5
  - x,y (relations, self-centred) and z (concrete to gist) are independent axes →~VIS-9
- PROD-11 [o] the record is kept and the memory lives: the `Diary` is preserved as written, while its memories brighten when recalled, fade and abstract when left, link with others, and sit nearer the centre the more connected they are →!INV-2 →~INV-7
  - memories change but never vanish: the system deletes nothing, and only the user's explicit deletion removes →!INV-1 →=DEL
- PROD-12 [o] the life of a memory, each stage owned by its mechanism domain
  | stage | product fact | owner |
  |---|---|---|
  | birth | a diary splits at event boundaries into named, mood-tagged memories; a known element reuses its neuron, a new one wakes a latent star | →=ENC |
  | connection | co-fired neurons bind; memories sharing a neuron are linked; embedding similarity never links | →=LINK |
  | time | the clock is diary-driven: a launch or a recall moves it, viewing stops it, and forgetting and consolidation progress at the advance with no batch | →=TIME |
  | recall | viewing the meta and the forgotten text is free; recalling is free reconstruction: rewrite, and only a real difference changes the text and the shape | →=RECALL |
  | forgetting | an unrecalled memory dims and loses words, stops at a floor, costs more to restore from storage the deeper it fades, and recovers wholly on recall | →=FORGET |
  | sleep | while time advances, related memories replay, weak synapses downscale and gist versions rise into the neocortex | →=CONSOL |
- PROD-13 [o] the core loop is write, launch, let time pass, recall: what the user recalls grows, and the universe's colour follows it; spending elsewhere never blocks the day's recall →=TWINK-5
  - only looking changes nothing: no time passes and nothing fades →!INV-10
  - `SMALL` Twinkle refills daily for stored-text restoration; `GENERAL` Twinkle comes from writing, achievements, invites and the signup bonus →=TWINK-3
- PROD-14 [o] the product in scope now
  | area | what the user gets | owner |
  |---|---|---|
  | account | Google or email-and-password sign-in, nickname-only signup, auto-detected time zone, invite links, `/me`, withdrawal, a signup bonus | →=ACCT →=AUTH |
  | writing | write with a diary date, split into scenes (usually 2–5, one for a single-scene day), review names, moods and passages, revise in natural language, launch | →=WRITE →=ENC |
  | universe | 3D navigation, star detail, the latent field, the nebula colour, two z layers | →=VIS |
  | time | the diary-driven clock, the acceleration, sync consent | →=TIME |
  | linking | synapses from co-firing, sharing and temporal proximity | →=LINK |
  | recall | recall with reconsolidation, the gist view | →=RECALL |
  | forgetting | dimming with word loss, the accessibility cost, whole recovery on recall | →=FORGET |
  | consolidation | replay, downscaling, the gist rise and its timer | →=CONSOL |
  | emotion | 13 moods, mood colour, the per-mood colour editor | →=MOOD |
  | deletion | full delete with a restore window, permanent letting go | →=DEL |
  | Twinkle | the single currency in two kinds, its ledger | →=TWINK |
  | archive | the original reader, provenance, export, the list, keyword search, filters, a calendar | →=DIARY |
  | decoration | the panel over the universe, the full catalog with live preview, an atomic save | →=DECOR |
  | achievements | naturally reached achievements with an explicit claim | →=ACH |
  | public funnel | the landing, the blog, the demo, the onboarding tour | →=MKT →=DEMO →=ONB |
  | operations | the admin console | →=ADMIN |
  - free palette editing is in scope now, not deferred: the per-mood colour editor offers presets and a free picker →=MOOD-16 →=DECOR-1
- PROD-15 [o] deferred is not absent: a deferred item keeps a reserved slot in the shipped structure ← filling it later needs no redesign, and no other decision collides with a slot it cannot see
- PROD-16 [o] deferred items →!PROD-15
  | item | now | owner |
  |---|---|---|
  | social: sending a star to a friend, browsing a public universe | not offered; the friend invite is a separate, shipped growth path →=SOCIAL-4 | →~SOCIAL |
  | payment (store or PG) | none: the economy runs unmonetized, and the earn paths alone supply enough Twinkle | →=TWINK-3 |
  | cumulative interference over time | not built; the recall-time neighbour adjustment is | →=FORGET-8 |
  | consolidation choreography (replay visuals, the rise into the neocortex) | a reserved slot in the advance seam | →=VIS-8 |
  | semantic diary search | keyword search only | →=DIARY-9 |
  | blog posts in more languages | not yet; a translation would be a separate post | →=MKT-5 |
  | in-session edit gestures beyond the shipped merge, split and natural-language revise | not built | →=WRITE-4 |
  | schema, a structure over many memories | no concept; constellations express it emergently | →=CONSOL-3 |
- PROD-17 [o] non-goals: real-time multi-user collaboration (no live subscription, co-presence or shared editing), a simulation of the brain →=SCI, and any therapeutic or clinical purpose →=DEL-7

## flow
- entry: `/` (signed in: universe | signed out: sign in | side doors: `/demo`, `/about`) → signup (nickname; an invite link binds itself) → onboarding tour (once) → an empty universe with latent stars
- write: write (date, default today) → split (memories with name, mood and passage; edit | natural-language revise) → launch (dated before the clock: the diary is saved, no star) → clock moves to the diary date → acceleration → the star appears as a latent star wakes
- look and recall: tap a star → detail (free: meta, forgotten text) → recall (Twinkle; clock behind today: consent | cancel) → rewrite (differs: reconsolidate | same: reinforce); a gist star → gist view (Twinkle)
- archive: list, search, filters, calendar (free, no time) → the original → the stars born from that diary (summed recall cost) → whole-diary recall
- time: only looking → nothing changes; launch | recall → clock advance → forgetting and consolidation over the interval

## chg
- r2 261103 PROD-12✎ PROD-13✎ paid recall→free reconstruction and paid stored-text restoration
- r1 261102 initial
