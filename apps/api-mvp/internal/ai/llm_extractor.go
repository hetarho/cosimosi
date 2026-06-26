package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"unicode/utf8"

	"github.com/cosimosi/backend/internal/llm"
)

// extractMaxTokens caps one extraction response. Up to 5 fragments of a ≤4000
// rune diary plus entities fits comfortably; generous so dense CJK output is
// never truncated mid-JSON.
const extractMaxTokens = 8192

const extractSchemaName = "diary_extraction"

// extractSchema is the canonical structured-output schema (spec 20) — portable
// across all providers: every object has additionalProperties:false with all
// properties required, and NO numeric/array constraints (support differs per
// provider; the [1,5] clamp and range clamps are re-applied in code instead).
var extractSchema = json.RawMessage(`{
  "type": "object", "required": ["segments"], "additionalProperties": false,
  "properties": { "segments": { "type": "array",
    "items": { "type": "object",
      "required": ["index", "text", "mood", "intensity", "valence", "entities"],
      "additionalProperties": false,
      "properties": {
        "index":     { "type": "integer" },
        "text":      { "type": "string" },
        "mood":      { "type": "string", "enum": ["joy","excitement","love","calm","gratitude","relief","anger","fear","stress","sad","tired","emptiness","neutral"] },
        "intensity": { "type": "number" },
        "valence":   { "type": "number" },
        "entities":  { "type": "object", "additionalProperties": false,
          "required": ["people", "places", "topics"],
          "properties": { "people": {"type":"array","items":{"type":"string"}},
                          "places": {"type":"array","items":{"type":"string"}},
                          "topics": {"type":"array","items":{"type":"string"}} } } } } } } }`)

// extractSystemPrompt is the event-segmentation rubric (spec 20). The
// quadrant-first selection, tie-breaks, and Korean-affect recipe quote spec
// 29's extraction guideline — the single source for the 13-mood taxonomy.
const extractSystemPrompt = `너는 일기를 '사건 경계(event boundary)'로 나눈다. 장소·사람·활동(목표)·주제·감정 톤 중
하나라도 바뀌면 새 조각(segment)을 시작한다. 그런 전환이 하나도 없으면 1조각으로 둔다.
각 조각에 감정(아래 13종 중 하나)과 강도(intensity 0~1, 감정의 '세기'=각성),
정서가(valence -1~1, 음=부정·0=중립·양=긍정), 인물(people)/장소(places)/주제(topics)를 붙인다.

규칙:
- 감정 13종 = joy | excitement | love | calm | gratitude | relief | anger | fear | stress | sad | tired | emptiness | neutral.
  선택은 반드시 **사분면 먼저 → 사분면 내 선택** 순서로 한다:
  HAP(고각성·긍정): joy(이미 일어난 좋은 사건) / excitement(아직 안 온 일·기대) / love(대상·관계에 대한 애정)
  LAP(저각성·긍정): calm(지속되는 평온) / relief(직전 긴장의 해소) / gratitude(대상에 대한 고마움)
  HAN(고각성·부정): anger(부당함·방해 지향) / fear(위협·불확실) / stress(과부하·벅참)
  LAN(저각성·부정): sad(상실) / tired(소진) / emptiness(무의미·공허)
  중심: neutral(감정 신호 없음)
- 사분면 간 tie-break: calm vs tired는 valence 부호로(충전·쉼→calm, 소진→tired) /
  neutral vs tired는 신호 유무로(고갈 신호가 명시되면 tired, 없으면 neutral) /
  anger vs stress는 지향으로(타자·부당함 지향→anger, 자기 용량 초과→stress).
- 한국어 정동 레시피: 한(恨)·그리움→sad(깊은 음 valence) · 답답/억울→stress(막힘) 또는 anger(분개) ·
  화병→anger(+음 valence), 소진이 짙으면 tired · 지침/소진/무기력→tired · 권태/지루→tired(약한 |valence|) 또는 neutral ·
  공허/허무→emptiness · 혐오/역겨움→anger(음 valence) · 뿌듯→joy/excitement · 죄책감/미안/부끄러움→sad 또는 fear.
- intensity는 감정의 세기다(차분=낮음, 격렬=높음). valence와 별개다(고강도 슬픔: intensity 높고 valence 음).
- 강한 고통·혐오는 별도 범주 없이 sad/fear/anger + 강한 음 valence + 높은 intensity로 표현한다.
- text는 그 조각에 해당하는 원문 구간(요약 아님, 원문 어순 유지)이다. 모든 원문 내용이 정확히 한 조각에 속해야 한다.
- 대략 80~120단어당 1조각, 단 의미 전환이 우선. 60단어 미만이거나 전환이 없으면 1조각.
- 조각은 1~5개. index는 0부터 순서대로.
- 출력은 JSON 스키마를 따르는 JSON만.

예시(혼동 쌍 기준):
- "퇴근하고 소파에 누워 아무것도 안 했다. 오랜만에 충전되는 기분." → calm (쉼·충전 = 양 valence, tired 아님)
- "하루 종일 회의가 이어져서 집에 오니 손가락 하나 까딱할 힘이 없다." → tired (소진 = 음 valence, calm 아님)
- "장 보고 빨래하고 평범하게 보냈다." → neutral (고갈 신호 없음, tired 아님)
- "내 차례가 또 밀렸다. 왜 항상 나만 양보해야 하지." → anger (부당함 지향, stress 아님)
- "마감 세 개가 겹쳐서 숨이 막힌다. 다 못 끝낼 것 같다." → stress (용량 초과, anger 아님)
- "내일 면접 결과가 나온다. 자꾸 휴대폰을 확인하게 된다." → excitement 또는 fear (기대/불확실 — 문맥의 valence로 가른다)`

// LLMExtractor is the real Extractor (spec 20): it owns the prompt, the
// canonical schema, response validation/fallback, the text-hash cache, and
// LLM metrics — and calls whatever provider sits behind the llm.Client port,
// so swapping providers never touches extraction logic (constitution §7).
// Transport errors propagate (the worker retries with backoff); unusable
// content degrades to the single-segment fallback instead (concept §4.6).
type LLMExtractor struct {
	client  llm.Client
	metrics *ExtractMetrics

	mu    sync.RWMutex
	cache map[string]Extraction
}

// NewLLMExtractor wires the extractor over an LLM provider client.
func NewLLMExtractor(client llm.Client) *LLMExtractor {
	return &LLMExtractor{
		client:  client,
		metrics: &ExtractMetrics{},
		cache:   make(map[string]Extraction),
	}
}

func (e *LLMExtractor) Extract(ctx context.Context, text string) (Extraction, error) {
	key := cacheKey(text)
	if ext, ok := e.fromCache(key); ok {
		e.metrics.CacheHits.Add(1)
		return ext, nil
	}

	// MIRRORS the embedder's input cap (openai.go maxInputRunes): RecordMemory
	// already rejects longer bodies (memory.MaxBodyRunes), so this is a
	// last-resort guard, not the normal path.
	input := text
	runeLen := utf8.RuneCountInString(text)
	if runeLen > maxInputRunes {
		input = string([]rune(text)[:maxInputRunes])
		runeLen = maxInputRunes
		e.metrics.TokenCapHits.Add(1)
	}
	e.metrics.ExtractCalls.Add(1)
	e.metrics.ApproxTokens.Add(int64(runeLen / 4))

	resp, err := e.client.Complete(ctx, llm.Request{
		System:    extractSystemPrompt,
		User:      input,
		Schema:    &llm.Schema{Name: extractSchemaName, Raw: extractSchema},
		MaxTokens: extractMaxTokens,
	})
	if err != nil {
		// Transport-level failure: NOT a fallback — let the worker back off and
		// retry, so a transient provider outage doesn't permanently flatten a
		// diary into one unsegmented star.
		return Extraction{}, fmt.Errorf("llm extract: %w", err)
	}

	var ext Extraction
	if segs, decodeErr := decodeSegments(resp.Text); decodeErr != nil {
		// Content-level breakage (unparseable JSON, zero segments): the
		// single-segment fallback is a normal result, not an error (concept §4.6).
		e.metrics.Fallbacks.Add(1)
		slog.Warn("extraction fallback",
			"model", e.client.Model(), "err", decodeErr)
		ext = fallbackExtraction(text, MoodUnspecified, 0)
	} else {
		ext = normalizeExtraction(segs, text)
	}

	e.toCache(key, ext)
	slog.Debug("extraction done",
		"model", e.client.Model(),
		"segments", len(ext.Segments),
		"extract_calls", e.metrics.ExtractCalls.Load(),
		"approx_tokens", e.metrics.ApproxTokens.Load(),
		"cache_hits", e.metrics.CacheHits.Load(),
		"token_cap_hits", e.metrics.TokenCapHits.Load(),
		"fallbacks", e.metrics.Fallbacks.Load(),
	)
	// Clone so the caller never shares backing arrays with the cache entry —
	// a caller mutating its result must not corrupt future cache hits.
	return cloneExtraction(ext), nil
}

// decodeSegments parses the model's (claimed) JSON into raw segments. An error
// means the content is unusable (unparseable JSON, wrong shape, zero segments)
// — the caller decides the fallback; this function only decodes.
func decodeSegments(raw string) ([]Segment, error) {
	var wire struct {
		Segments []struct {
			Index     int     `json:"index"`
			Text      string  `json:"text"`
			Mood      string  `json:"mood"`
			Intensity float64 `json:"intensity"`
			Valence   float64 `json:"valence"`
			Entities  struct {
				People []string `json:"people"`
				Places []string `json:"places"`
				Topics []string `json:"topics"`
			} `json:"entities"`
		} `json:"segments"`
	}
	if err := json.Unmarshal([]byte(raw), &wire); err != nil {
		return nil, fmt.Errorf("parse segments: %w", err)
	}
	if len(wire.Segments) == 0 {
		return nil, fmt.Errorf("empty segments")
	}
	segs := make([]Segment, 0, len(wire.Segments))
	for _, s := range wire.Segments {
		segs = append(segs, Segment{
			Text:      s.Text,
			Mood:      Mood(s.Mood),
			Intensity: s.Intensity,
			Valence:   s.Valence,
			Entities:  Entities{People: s.Entities.People, Places: s.Entities.Places, Topics: s.Entities.Topics},
		})
	}
	return segs, nil
}

// cloneExtraction deep-copies segments AND their entity slices, so a cached
// Extraction and what callers hold never share backing arrays.
func cloneExtraction(ext Extraction) Extraction {
	out := make([]Segment, len(ext.Segments))
	copy(out, ext.Segments)
	for i := range out {
		out[i].Entities = Entities{
			People: append([]string(nil), out[i].Entities.People...),
			Places: append([]string(nil), out[i].Entities.Places...),
			Topics: append([]string(nil), out[i].Entities.Topics...),
		}
	}
	return Extraction{Segments: out}
}

func (e *LLMExtractor) fromCache(key string) (Extraction, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	ext, ok := e.cache[key]
	if !ok {
		return Extraction{}, false
	}
	return cloneExtraction(ext), true
}

func (e *LLMExtractor) toCache(key string, ext Extraction) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.cache[key] = ext
}
