// LLM 토큰 단가표(USD / 1M tokens) — 비용 "추정" 전용 정적 상수(spec 34).
// 단가는 자주 바뀌므로 서버·DB에 두지 않고 FE 상수로 둔다. 갱신처(공식 가격 페이지):
//   openai.com/api/pricing · ai.google.dev/pricing · anthropic.com/pricing ·
//   api-docs.deepseek.com/quick_start/pricing · x.ai/api
// 항목에 없는 모델은 비용을 표시하지 않는다(토큰 수만) — 모르는 단가로 추정하지 않는다.

interface ModelPrice {
  inputPerMillion: number // USD / 1M input tokens
  outputPerMillion: number // USD / 1M output tokens
}

// 키는 모델명(공급자 무관 — 모델명은 공급자 간 안 겹친다). 2026-06 기준.
const MODEL_PRICES: Record<string, ModelPrice> = {
  'gpt-5.4-mini': { inputPerMillion: 0.25, outputPerMillion: 2.0 },
  'gemini-3.5-flash': { inputPerMillion: 0.3, outputPerMillion: 2.5 },
  'claude-opus-4-8': { inputPerMillion: 5.0, outputPerMillion: 25.0 },
  'claude-haiku-4-5': { inputPerMillion: 1.0, outputPerMillion: 5.0 },
  'deepseek-v4-flash': { inputPerMillion: 0.07, outputPerMillion: 1.1 },
  'grok-4.3': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
}

/** 토큰 수 → 추정 비용(USD). 단가표에 없는 모델은 null(표시 생략). */
export function estimateCostUSD(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const price = MODEL_PRICES[model]
  if (!price) return null
  return (
    (inputTokens / 1_000_000) * price.inputPerMillion +
    (outputTokens / 1_000_000) * price.outputPerMillion
  )
}

/** 비용 표기: 1센트 미만도 보이게 소수 4자리까지. */
export function formatUSD(cost: number): string {
  return `$${cost.toFixed(cost < 0.01 ? 4 : 2)}`
}
