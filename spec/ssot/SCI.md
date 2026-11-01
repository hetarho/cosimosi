# SCI neuroscience grounding
> r1 | which memory-neuroscience finding each mechanism follows, what is simplified or still disputed, and what the product may claim about the brain

## decisions
- SCI-1 [o] cosimosi is inspired by engram theory and honestly analogizes how the brain handles memory; it never implements or simulates it ← the appeal is an analogy that matches how memory works, not a merely plausible one
  - not a biophysical simulation: the aim is intuition that is not wrong, not an exact model →~SCI-13
  - a mechanism built on a misconception is never implemented →=INV
- SCI-2 [o] what the product may and may not claim about the brain →!INV-12
  | may claim | must not claim |
  |---|---|
  | inspired by engram theory and memory research | works like, or the same as, a brain; is a model of anyone's brain |
  | placing memories by their relations mirrors how the brain maps concepts →~SCI-3 | the 3D coordinates are the brain's real coordinates |
  | the five strands are the findings its rules were drawn from →~SCI-4 | any therapeutic, clinical or efficacy effect (letting go is symbolic →=DEL-7) |
  | a phenomenon it does not model, named as not modelled →~SCI-13 | a mechanic it does not have: emotion placing or linking memories, memories attracting each other, radius meaning recency |
  - public wording, the two theory tiers and the copy lint →=MKT
- SCI-3 [o] relational placement is grounded, the coordinates are not: the brain maps concepts and relations the way it maps space, so placing memories by their relations is an honest representation, while the concrete 3D coordinates are an emergent visualization of the relation graph →=INV-5
  - sources: cognitive map (O'Keefe & Nadel 1978); grid-like coding of conceptual space (Constantinescu 2016, 10.1126/science.aaf0941)
- SCI-4 [o] five strands ground the product; their ids are shared by the landing's theory cards and the blog's pillars →=MKT
  | id | finding | sources | product consequence |
  |---|---|---|---|
  | `engram` | a memory is a sparse, distributed ensemble of neurons | Josselyn & Tonegawa 2020 (10.1126/science.aaw4325) | an `EpisodicMemory` is a bundle of shared `Neuron`s →=INV |
  | `spatial-representation` | the brain maps concepts and relations like space | →~SCI-3 | relational placement, emergent coordinates →=INV-5 |
  | `synapse-time` | what fires together binds; memories close in time and context share neurons | Hebb 1949; Bliss & Lømo 1973; Cai 2016; Howard & Kahana 2002 | shared neurons and synapses make constellations emerge →=INV-4 |
  | `reconstructive-recall` | remembering reconstructs, and a prediction error updates the memory | Bartlett 1932; Nader 2000 | recall is reconsolidation; the `Diary` stays apart →=INV-2 |
  | `forgetting-accessibility` | forgetting is reversible loss of access; gist compression is a separate process | Ryan & Frankland 2022; Roy 2017; McClelland 1995 | forgetting and gist are independent axes →=INV |
- SCI-5 [o] encoding follows event segmentation and competitive neural allocation →=ENC
  | mechanism | model | sources |
  |---|---|---|
  | split at event boundaries →=ENC-1 | event segmentation | Zacks 2007 (10.1037/0033-2909.133.2.273); Baldassano 2017 (10.1016/j.neuron.2017.06.041) |
  | typed context neurons →=ENC-3 | place and concept cells | O'Keefe & Nadel 1978 |
  | seeds near co-born or reused neurons, neuron sharing →=ENC-7 →=LINK-2 | co-allocation; dendritic clustering | Cai 2016 (10.1038/nature17955); Sehgal 2021; Nat Neurosci 2025 (10.1038/s41593-025-01876-8) |
  | which latent star wakes →=ENC-12 | competitive, excitability-based allocation | Han 2007 (10.1126/science.1139438) |
  | arousal raises initial size and slows forgetting →=ENC-13 →=FORGET-6 | emotional arousal strengthens consolidation | McGaugh 2004 (10.1146/annurev.neuro.27.070203.144157); Kensinger & Corkin 2004 (10.3758/BF03206860) |
  | keeping similar memories apart →=ENC-11 | pattern separation (dentate gyrus) | Yassa & Stark 2011 (10.1016/j.tins.2011.06.006) |
- SCI-6 [o] linking follows Hebbian plasticity and co-allocation →=LINK
  | mechanism | model | sources |
  |---|---|---|
  | co-firing neurons strengthen →=LINK-1 →=RECALL-3 | Hebbian plasticity, LTP | Hebb 1949; Bliss & Lømo 1973 (10.1113/jphysiol.1973.sp010273) |
  | temporal-proximity bonus →=LINK-4 | co-allocation within a short window | Cai 2016 |
- SCI-7 [o] placement follows the self-memory system and temporal context →=VIS
  | mechanism | model | sources |
  |---|---|---|
  | centre = self, radius = connectedness →=VIS-1 →=INV-7 | self-memory system | Conway & Pleydell-Pearce 2000 (10.1037/0033-295X.107.2.261) |
  | time links memories and never places them →=LINK-4 | temporal context model | Howard & Kahana 2002 (10.1006/jmps.2001.1388) |
- SCI-8 [o] recall follows the testing effect and prediction-error-gated reconsolidation →=RECALL
  | mechanism | model | sources |
  |---|---|---|
  | recall strengthens →=RECALL-1 →=RECALL-3 | testing effect (retrieval practice) | Roediger & Karpicke 2006 (10.1111/j.1467-9280.2006.01693.x) |
  | partial restore, never the original →=RECALL-4 →=INV-8 | trace transformation; constructive memory | Winocur & Moscovitch 2011 (10.1017/S1355617711000683); Schacter & Addis 2007 (10.1098/rstb.2007.2087) |
  | neighbour forgetting ± →=RECALL-5 | spreading activation; retrieval-induced forgetting | Collins & Loftus 1975 (10.1037/0033-295X.82.6.407); Anderson 1994 (10.1037/0278-7393.20.5.1063) |
  | rewrite only on a prediction error, gist only viewed →=RECALL-6 →=RECALL-8 | reconsolidation; reconstructive distortion | Nader 2000 (10.1038/35021052); Sinclair & Barense 2019 (10.1016/j.tins.2019.08.007); Bartlett 1932 |
- SCI-9 [o] emotion follows the circumplex model, and the universe colour follows the testing effect →=MOOD
  | mechanism | model | sources |
  |---|---|---|
  | 13 moods on valence × arousal →=MOOD-2 | circumplex model of affect | Russell 1980 (10.1037/h0077714) |
  | colour weighted by what is recalled →=MOOD-5 | testing effect: recalled memories grow | Roediger & Karpicke 2006 |
- SCI-10 [o] forgetting follows reversible loss of access, never erasure →=FORGET
  | mechanism | model | sources |
  |---|---|---|
  | dimming with word loss to a floor, recall restores →=FORGET-1–7 | retrieval failure; silent engram; forgetting curve; transience | Ryan & Frankland 2022 (10.1038/s41583-021-00548-3); Roy 2017 (10.1073/pnas.1714248114); Ebbinghaus 1885 |
  | persistent interference, reserved →=FORGET-8 | retroactive interference | Anderson 1994 |
  | letting go keeps a trace without its meaning →=DEL-4 | silent engram: access blocked | Roy 2017 |
  - the fade is a floored exponential in universe time, an Ebbinghaus-style curve kept simple; its shape →=FORGET-1
- SCI-11 [o] consolidation follows systems consolidation and complementary learning systems →=CONSOL
  | mechanism | model | sources |
  |---|---|---|
  | sleep on a clock advance, replay of related memories →=CONSOL-1 →=CONSOL-2 | systems consolidation; sleep; replay | McClelland 1995 (10.1037/0033-295X.102.3.419); Diekelmann & Born 2010 (10.1038/nrn2762); Wilson & McNaughton 1994 (10.1126/science.8036517) |
  | two stores on z, the gist rising to the neocortex →=CONSOL-5–7 | complementary learning systems | McClelland 1995; Winocur & Moscovitch 2011 |
  | episodic memory becoming semantic →=CONSOL-6 | episodic and semantic memory | Tulving 1985 (10.1037/0003-066X.40.4.385) |
  | homeostatic downscaling →=CONSOL-4 →=INV-9 | synaptic homeostasis (SHY) | Tononi & Cirelli 2014 (10.1016/j.neuron.2013.12.025) |
  | schema, reserved →=CONSOL-3 | a skeleton shared by many memories (N→1), distinct from gist (1→1) | Ghosh & Gilboa 2014 (10.1016/j.neuropsychologia.2013.11.010) |
- SCI-12 [o] code names are functional terms; the theory names behind them live here and never become code names →=UL
  | theory term | code name |
  |---|---|
  | engram (Semon 1904) | `EpisodicMemory`, drawn as a star |
  | engram cell | `Neuron` |
  | engram complex (a brain-wide trace) | the one universe, with no type |
  | synapse; Hebbian plasticity, LTP | `Synapse`; `Potentiate` |
  | LTD; synaptic homeostasis (SHY) | `Depress`; `Downscale` |
  | neural allocation, co-allocation | `Encode`'s neuron allocation; `Link`'s time signal |
  | reconsolidation | `Reconsolidate` |
  | systems consolidation, CLS, semanticization | `Hippocampus`, `Neocortex`, `Semanticize`, `SemanticMemory` |
  | silent engram | the brightness floor; a let-go memory |
  | spreading activation, retrieval-induced forgetting | `Recall`'s neighbour forgetting ± |
  | circumplex model of affect | `Emotion` (valence, arousal) |
  | schema | none while reserved |
- SCI-13 [o] deliberately simplified: neuron counts, synapse chemistry and the division into brain regions are abstracted away
  - deliberately not modelled: mood-congruent recall (Bower 1981, 10.1037/0003-066X.36.2.129); the product never reads the user's current mood to surface memories
  - reserved and not modelled yet: schema →=CONSOL-3, persistent interference →=FORGET-8
- SCI-14 [o] the science the product leans on is partly open; each stance below is a modelling choice, revised through its owning domain when the science moves
  | topic | state of the science | product stance |
  |---|---|---|
  | human generalization | neural allocation, silent engrams and short linking windows come mostly from rodent studies; human behavioural evidence is emerging (Yetton 2019) | used as inspiration only |
  | reconsolidation boundary conditions | disputed; prediction error is the leading trigger hypothesis (Sinclair & Barense 2019) | prediction-error gate →=RECALL-6 |
  | event-segmentation trigger | whether prediction error is the only boundary signal is disputed | split on context change →=ENC-1 |
  | episodic vs semantic | separate systems or a continuum, under re-examination (Renoult 2019) | two stores, the gist dependent on its memory →=CONSOL-5 |
  | active forgetting | access switch or trace loss, unresolved (Ryan & Frankland 2022) | reversible loss of access with a floor →=INV-1 |
- SCI-15 [o] this domain is the product's bibliography: its DOIs mix verified entries and standard bibliographic data, so each is checked before any academic citation
  - academic citations appear on the blog only, never on product surfaces →=MKT-2
  - the blog may cite further sources in its essays →=MKT

## constraints
- a mechanism grounded in a model not listed here adds the model and its source here first

## chg
- r1 261102 initial
