# LLM 공급자 추상화 (`backend/internal/llm`)

도메인 코드는 어떤 LLM인지 모른다. LLM이 필요한 로직은 `llm.Client` 포트만 호출하고,
실제 공급자(openai · gemini · claude · deepseek · grok)는 **env만으로** 갈아끼운다(헌법7).

```
도메인(ai.LLMExtractor 등)
   │  llm.Client.Complete(ctx, Request{System, User, Schema, MaxTokens})
   ▼
backend/internal/llm
   ├─ llm.go            포트 + Request/Response/Schema (순수 타입 — 공급자/HTTP 비의존)
   ├─ factory.go        New(cfg): LLM_PROVIDER → 어댑터 선택, 키 fail-fast, LLM_MODEL 오버라이드
   ├─ openai_compat.go  OpenAI-호환 chat completions 제네릭 어댑터 (openai · deepseek · grok)
   ├─ anthropic.go      Anthropic Messages API (claude)
   └─ gemini.go         Gemini generateContent (gemini)
```

## 사용 (env)

```bash
AI_EXTRACTOR=llm          # mock(기본·키리스) | llm
LLM_PROVIDER=claude       # openai | gemini | claude | deepseek | grok (기본 openai)
LLM_MODEL=                # 비우면 공급자 기본 모델
ANTHROPIC_API_KEY=sk-...  # 선택한 공급자의 키만 있으면 됨
```

## API 키 넣는 곳 (환경별)

키는 **항상 env로만** 들어간다 — 코드·리포에 절대 커밋하지 않는다(`.env`는 비추적).

| 환경 | 넣는 곳 | 전달 경로 |
|---|---|---|
| 로컬 | **리포 루트 `.env`** (`.env.example` 복사 후 채움) | ① 호스트에서 백엔드 실행 시: `config.Load()`의 godotenv가 `../.env`를 직접 읽음 ② dev 컨테이너(`docker compose --profile dev`): compose가 루트 `.env`를 `${...}`로 보간해 backend 서비스 `environment:`로 주입 (docker-compose.yml에 변수 목록 있음) |
| 스테이징/프로덕션 | **VPS `/srv/cosimosi-{staging,prod}/.env`** (`chmod 600`, 비추적 — DEPLOY.md §4) | `docker-compose.prod.yml`의 `env_file: .env`가 파일 전체를 컨테이너에 주입. 키 목록 문서화는 `.env.production.example` |

순서: ① 루트 `.env`(또는 VPS 스택 `.env`)에 `AI_EXTRACTOR=llm` + `LLM_PROVIDER=<공급자>` + 그 공급자의 키 한 줄을 채운다 → ② 백엔드 재시작(dev 컨테이너는 `docker compose --profile dev up -d backend`로 재생성 — env는 재시작이 아니라 재생성 시 반영된다) → ③ 로그에 fail-fast 에러가 없으면 끝(키가 비면 부팅 시 `LLM_PROVIDER=… requires …_API_KEY`로 즉사한다).

프론트(`VITE_*`)와 무관하다 — LLM 키는 전부 백엔드 전용이고 브라우저에 노출되지 않는다.

| provider | 기본 모델 | 키 env | 구조화 출력 |
|---|---|---|---|
| `openai` | `gpt-5.4-mini` | `OPENAI_API_KEY` | `response_format: json_schema (strict)` |
| `gemini` | `gemini-3.5-flash` | `GEMINI_API_KEY` | `responseMimeType` + `responseJsonSchema` |
| `claude` | `claude-opus-4-8` | `ANTHROPIC_API_KEY` | `output_config.format: json_schema` |
| `deepseek` | `deepseek-v4-flash` | `DEEPSEEK_API_KEY` | `json_object` + 프롬프트 내 스키마(자동 강등) |
| `grok` | `grok-4.3` | `XAI_API_KEY` | `response_format: json_schema (strict)` |

## 새 공급자 추가하기

### A. OpenAI-호환 API면 (대부분 — Mistral, Qwen, Together 등)

어댑터를 새로 만들지 않는다. `factory.go`의 switch에 case 하나만 추가:

```go
case "mistral":
    if cfg.MistralAPIKey == "" {
        return nil, fmt.Errorf("LLM_PROVIDER=mistral requires MISTRAL_API_KEY")
    }
    return newOpenAICompat("mistral", "https://api.mistral.ai/v1/chat/completions",
        cfg.MistralAPIKey, orDefault(model, defaultMistralModel),
        true,           // json_schema strict 지원 여부 — 미지원이면 false(json_object+프롬프트 스키마로 강등)
        "max_tokens",   // 토큰 캡 필드명 — 현행 OpenAI만 "max_completion_tokens"
        httpClient), nil
```

체크리스트:
1. `factory.go` — case + `default<Provider>Model` 상수(공식 문서에서 **현재** 모델명 확인 — 퇴역 모델 주의).
2. `config.go` — `<Provider>APIKey` 필드 + `getEnv` 로드.
3. `.env.example` — 키 줄 + 상단 주석의 provider 목록·기본 모델 갱신.
4. `factory_test.go` — 선택/기본 모델/키 fail-fast 3종 케이스에 한 줄씩 추가.
5. `spec/policy/domain/memory.md`의 "LLM 공급자 추상화" 행 + 이 문서의 표 갱신.

### B. 요청/응답 모양이 다른 API면 (Anthropic·Gemini처럼)

`anthropic.go`를 본보기로 어댑터 파일 1개를 새로 만든다:

```go
type fooClient struct{ apiKey, model string; http *http.Client }

func (c *fooClient) Model() string { return "foo/" + c.model }

func (c *fooClient) Complete(ctx context.Context, req Request) (Response, error) {
    body := map[string]any{ /* 공급자 요청 모양 */ }
    respBody, err := postJSON(ctx, c.http, fooURL, body,
        map[string]string{ /* 인증 헤더 */ }, "foo") // 공유 HTTP 헬퍼 재사용
    // 응답에서 텍스트(JSON 문서)를 꺼내 Response{Text: ...}로 반환
}
```

지켜야 할 계약 (`llm.go`의 Client 주석이 원본):
- **전송 실패(HTTP/네트워크/비2xx)만 에러로** 올린다 — 워커가 백오프·재시도한다.
- **내용 깨짐(빈 텍스트·스키마 위반)은 에러가 아니다** — `Response{Text: ...}` 그대로 반환하면
  호출자(ai 패키지)의 검증·단일조각 폴백이 처리한다(concept §4.6).
- `Model()`은 `"provider/model"` 형식 — 로그·계측용.
- 공급자 SDK를 들이지 않는다 — raw `net/http` + `postJSON` 헬퍼(저의존 유지).

그다음 A의 체크리스트를 똑같이 따른다.

## 스키마 휴대성 규칙

`llm.Schema.Raw`에 넣는 JSON Schema는 모든 공급자의 strict 모드 **교집합**만 쓴다:
- 모든 object에 `additionalProperties: false` + 전 필드 `required` (OpenAI·Anthropic 요구).
- `minimum`/`maximum`/`minItems`/`maxItems` 등 수치·배열 제약 **금지**(Anthropic이 거부) —
  범위·개수 제한은 프롬프트로 지시하고 **코드에서 클램프**로 보장한다
  (예: `ai/extractor.go`의 `normalizeExtraction`).

## 새 LLM 기능을 만들 때

추출기처럼 도메인 쪽에 기능을 추가할 때(요지화·재성형 등):
- 프롬프트·스키마·검증·폴백·캐시·계측은 **기능(도메인) 쪽이 소유**한다 — 공급자를 바꿔도 품질 로직이 그대로여야 한다. 본보기: `backend/internal/ai/llm_extractor.go`.
- 공급자 호출은 `llm.New(cfg)`로 받은 `llm.Client` 하나면 된다.
