# OpenRouter LLM cutover evaluation

The evidence record AI-19 requires before a model enters `approvedModels` (`allowlist.go`) and before
the direct LLM adapters are removed. `TestAllowlistMatchesApprovedEvaluation` keeps the allowlist equal
to the rows below whose decision reads `approved`. Retrieved facts are dated because OpenRouter's
catalog, routing and fees are external operational facts, never `spec/values.yaml` tuning (AI-16).

## 1. Contract

- Retrieval date: **2026-08-30 (Asia/Seoul)**, carried into this record when the adapter was built.
  **Recheck pending**: prices, fees, routing and the response shape must be re-read from the official
  documentation before the phase 2 runs (AI-19), and this section updated with the new date.
- Stack: Go, `net/http`, non-streaming Chat Completions. The existing
  `github.com/santhosh-tekuri/jsonschema/v6` validator stays the local trust boundary; no OpenRouter or
  OpenAI SDK (AI-20).
- Chat endpoint: `POST https://openrouter.ai/api/v1/chat/completions`, Bearer authentication, JSON.
- Model catalog: `GET https://openrouter.ai/api/v1/models`. Each row exposes its request `id`, a
  permanent `canonical_slug` and `supported_parameters`. The curated intersection requires both
  `structured_outputs` and `response_format`; `require_parameters` filters endpoints per request.
- Structured output: `response_format.type = "json_schema"` with `json_schema.strict = true` and the
  caller's whole schema in `json_schema.schema`; the adapter still validates the answer locally.
- Completion state: exactly one choice with `finish_reason = "stop"` is a success; missing or multiple
  choices, `length`, `content_filter`, `tool_calls`, `error`, empty or unknown states are not.
- Model identity: the response `model` must equal the requested id or its `canonical_slug`
  (case-insensitive). **Confirm the normalization rule at the recheck** and record it here.
- Routing on every request: one explicit `model`, no `models` list, auto-router, route, preset, plugin
  or vendor BYOK key; `provider.zdr = true`, `provider.data_collection = "deny"`,
  `provider.require_parameters = true`, `provider.allow_fallbacks = true` (same model only).
- Prompt-logging account check: **PENDING** — an operator with access to the production OpenRouter
  workspace confirms prompt logging opt-in is disabled before the smoke call.
- Error envelope `{"error":{"code":number,"message":string,"metadata":object?}}`. 401, 403 and 402
  (insufficient credits) need an operator; 408, 429 and 5xx are retryable, with `Retry-After` accepted
  only as non-negative delta-seconds. Causes carry the status only.
- Usage and cost: non-streaming responses carry usage accounting. Inference prices pass through; the
  platform fee at retrieval was a **5.5% credit-purchase fee** (USD 0.80 minimum), recorded as its own
  line, never folded into inference cost.
- Latency: an endpoint fallback can make a request slower; no speed, cost or availability gain is
  claimed without the measurements below (AI-11).

### Sources (recheck each)

- [Chat Completions API](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion)
- [Structured Outputs](https://openrouter.ai/docs/guides/features/structured-outputs)
- [Provider Routing](https://openrouter.ai/docs/guides/routing/provider-selection)
- [Model Fallbacks](https://openrouter.ai/docs/guides/routing/model-fallbacks)
- [Models API and supported parameters](https://openrouter.ai/docs/guides/overview/models)
- [Zero Data Retention](https://openrouter.ai/docs/guides/features/zdr)
- [Errors and Debugging](https://openrouter.ai/docs/api_reference/errors-and-debugging)
- [Usage Accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting)
- [Pricing and fees](https://openrouter.ai/docs/faq)

## 2. Corpus and method

- Corpus: `internal/ai/testdata/llm-evaluation-corpus.json` — synthetic Korean diary content, no real
  diary, account identity or secret.
- Harness: `internal/ai/openrouter/live_evaluation_test.go`, skipped unless `COSIMOSI_LIVE_LLM_EVAL=1`
  and never part of the hermetic suite. Inputs: `COSIMOSI_LIVE_LLM_EVAL_PROVIDER` (`openrouter`,
  `anthropic` or `deepseek` until the cutover), `_MODEL`, `_API_KEY`, `_WARMUPS`, `_SAMPLES`. Keys
  come from the environment and are never printed or written.
- An `openrouter` run builds the candidate through `NewCandidateClient` (test builds only) and injects
  it through `ai.FactoryOptions.LLMClient`, so the production ports, parsers, schemas, domain
  validators, metering and cache all run; each measured call uses a fresh synthetic user scope so the
  identical-input cache cannot serve it. Warm-up samples are excluded.
- Recorded per scenario (`Split`, `ReviseSplit`, `GenerateSemanticStages`, `Differs`, `Suggest`):
  schema and domain-validator outcome, source-fidelity outcome, elapsed time, provider-reported input
  and output tokens and cost. A named human reviewer scores task and source fidelity from the
  product-shaped result and copies only aggregates here; raw payloads and prompts are never committed.
- Latency is wall-clock around the product port; p50 and p95 are nearest-rank over measured samples.

## 3. Direct-provider baseline

Status: **PENDING** — live Anthropic and DeepSeek credentials are not present in the implementation
environment.

| Provider / model               | Samples | Warm-up | Schema/domain | Source fidelity | Task fidelity reviewer | Input / output tokens | Inference cost | p50 / p95 | Notes                  |
| ------------------------------ | ------: | ------: | ------------- | --------------- | ---------------------- | --------------------- | -------------: | --------- | ---------------------- |
| Anthropic / `claude-opus-4-8`  | pending | pending | pending       | pending         | pending                | pending               |        pending | pending   | current direct adapter |
| DeepSeek / `deepseek-v4-flash` | pending | pending | pending       | pending         | pending                | pending               |        pending | pending   | current direct adapter |

## 4. OpenRouter candidates

No model is approved or selectable. Candidate ids are exact catalog ids of the form `vendor/model`;
aliases, auto routers and variants that can resolve to another model are excluded.

| Candidate                    | Samples | Warm-up | Schema/domain | Source fidelity | Task fidelity reviewer | Input / output tokens | Inference cost | Credit fee, separate | Gateway p50 / p95 | Endpoint fallback | Decision       |
| ---------------------------- | ------: | ------: | ------------- | --------------- | ---------------------- | --------------------- | -------------: | -------------------: | ----------------- | ----------------- | -------------- |
| `anthropic/claude-opus-4.8`  | pending | pending | pending       | pending         | pending                | pending               |        pending |              pending | pending           | pending           | candidate only |
| `deepseek/deepseek-v4-flash` | pending | pending | pending       | pending         | pending                | pending               |        pending |              pending | pending           | pending           | candidate only |

## 5. Gates

- [ ] Contract rechecked against the official documentation, with the date above updated.
- [ ] Production OpenRouter workspace prompt logging opt-in confirmed disabled by an operator.
- [ ] Direct Anthropic and DeepSeek baselines completed before either adapter is deleted.
- [ ] Every admitted candidate passed every corpus scenario through the adapter.
- [ ] Schema and domain-validator results reviewed; source and task fidelity scored by a named reviewer.
- [ ] Tokens and inference cost recorded per scenario, the credit fee as its own line.
- [ ] Direct-vs-gateway p50/p95 and endpoint-fallback observations recorded.
- [ ] A real production key + exact model smoke call passed with the routing controls.
- [ ] The allowlist holds exactly the rows marked `approved` above.

## 6. Approval

- Reviewer: **PENDING**
- Review date: **PENDING**
- Approved model ids: **none**
- Decision: **NOT APPROVED** — the registry cutover and the direct-adapter deletion stay blocked.
