import { VALUES } from '@cosimosi/config'

import { slowFactor } from './effective-values.ts'
import { elapsedUniverseDays } from './universe-time.ts'

// Forgetting decay ([F]) — the read-time math that dims a memory and erases its words as universe time
// passes without recall. Pure and IO-free, mirroring the Go internal/memory implementation byte-for-
// byte (golden-parity): the client renders the same decay the server computes for cost-gating, and
// nothing is ever deleted — brightness and text stop at a floor and wait for recall ([F2][I1]).

// The visual marker a removed word becomes. UI content owned with the algorithm, not a tuning value.
const REDACTION_TOKEN = 'xxxx'

// The v1 language-agnostic function-word heuristic: content words are redacted before these. Exact
// membership is code content (a "to refine" per [F9]), matching the Go forgettingStopWords set.
const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'so',
  'of',
  'to',
  'in',
  'on',
  'at',
  'by',
  'for',
  'with',
  'as',
  'is',
  'am',
  'are',
  'was',
  'were',
  'be',
  'i',
  'you',
  'he',
  'she',
  'it',
  'we',
  'they',
  'my',
  'me',
  'this',
  'that',
  '그리고',
  '그래서',
  '그러나',
  '하지만',
  '나는',
  '내가',
  '오늘',
])

// effectiveElapsedDays is the offset-inclusive recency clock both effectiveBrightness and decayStage
// consume, so brightness and stage move together ([F1]). Universe-days elapse from the last recall,
// or from creation when never recalled (a never-recalled memory still forgets). The signed neighbor
// forgettingOffsetDays (CC4) shifts that age and is floored at 0 — an offset can never make a memory
// younger than new ([I10]).
export function effectiveElapsedDays(
  now: string | null,
  lastRecalled: string | null,
  created: string,
  offsetDays: number,
): number {
  const anchor = lastRecalled ?? created
  const elapsed = elapsedUniverseDays(anchor, now)
  return Math.max(0, elapsed + offsetDays)
}

// decayStage is the discrete forgetting stage 0..maxStage a memory has reached — a monotone
// non-decreasing step function of the same effective elapsed days and the same slow factor as
// effectiveBrightness ([F1]). Stage 0 is vivid; the maximum stage is the derived length of
// forgetting.stageWordRemovalRatios — no stage past the last ([F2]).
export function decayStage(
  effectiveElapsedDaysValue: number,
  arousal: number,
  effectiveStrength: number,
): number {
  const maxStage = VALUES.forgetting.stageWordRemovalRatios.length
  const days = Math.max(0, effectiveElapsedDaysValue)
  const slow = slowFactor(arousal, effectiveStrength)
  const raw = Math.floor(days / (VALUES.forgetting.stageIntervalDays * slow))
  if (raw < 0) return 0
  if (raw > maxStage) return maxStage
  return raw
}

// decayDepth normalizes forgetting progress to [0, 1] — the continuous stage-fraction over the same
// slow-stretched elapsed clock decayStage crosses (0 = fresh, 1 = at/after the deepest stage). It is
// the normalized input accessibilityCostWeight reads, so the two axes speak one normalized language
// independent of the stage count ([F1][F4]). Recall resets decay → depth 0.
export function decayDepth(
  effectiveElapsedDaysValue: number,
  arousal: number,
  effectiveStrength: number,
): number {
  const maxStage = VALUES.forgetting.stageWordRemovalRatios.length
  const span =
    VALUES.forgetting.stageIntervalDays * maxStage * slowFactor(arousal, effectiveStrength)
  if (span <= 0) return 0
  return clampUnit(Math.max(0, effectiveElapsedDaysValue) / span)
}

// accessibilityCostWeight turns a memory's normalized forgetting depth into an accessibility/cost
// weight ([F4]), mirroring the Go implementation for golden-parity: a monotone convex ease from
// costWeightFloor (depth 0 — cheapest, never free [G1]) to costWeightCap (depth 1 — silent engram,
// expensive but bounded, never unreachable [I1][F2]). It emits a weight, not a Twinkle price (the
// pricing layer prices it; the client uses this only to preview the recall cost). Curve shape + clamp
// are code.
export function accessibilityCostWeight(decayDepthValue: number): number {
  const weightFloor = VALUES.forgetting.costWeightFloor
  const weightCap = VALUES.forgetting.costWeightCap
  const depth = clampUnit(decayDepthValue)
  const weight =
    weightFloor + (weightCap - weightFloor) * depth ** VALUES.forgetting.costWeightCurve
  return Math.min(weightCap, Math.max(weightFloor, weight))
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

// decayStageText produces the stage-`stage` decay text by removing a per-stage ratio of words at
// random, replacing each with the redaction token ([F1][F9]). Deterministic given (currentText,
// stage, seed) — the seeded PRNG is the only randomness. Stage 0 (or below) is the vivid text;
// stages 1..maxStage use forgetting.stageWordRemovalRatios[stage-1] (stage 0 is the reserved vivid
// state). Removal is a prefix of one seed-ordered list, so stage k+1 removes a superset of stage k.
// Structure is preserved: the first and last word of every sentence is never removed and content
// words go before function words, so even the deepest stage stays a non-empty legible fragment
// ([F2][F9]).
export function decayStageText(currentText: string, stage: number, seed: number | bigint): string {
  const words = currentText.trim() === '' ? [] : currentText.trim().split(/\s+/)
  if (stage <= 0 || words.length <= 2) return words.join(' ')

  const ratios = VALUES.forgetting.stageWordRemovalRatios
  const clampedStage = stage > ratios.length ? ratios.length : stage
  const ratio = ratios[clampedStage - 1]

  const removable = removableIndices(words)
  if (removable.length === 0) return words.join(' ')

  const order = seededRemovalOrder(words, removable, seed)
  const removeCount = Math.min(order.length, Math.floor(ratio * order.length))

  const result = [...words]
  for (const index of order.slice(0, removeCount)) result[index] = REDACTION_TOKEN
  return result.join(' ')
}

// removableIndices returns the word indices eligible for redaction: every word except the first and
// last of each sentence, which anchor the skeleton so a redacted text stays legible-as-fragments.
function removableIndices(words: readonly string[]): number[] {
  const protectedIndices = new Set<number>([0, words.length - 1])
  words.forEach((word, index) => {
    if (endsSentence(word)) {
      protectedIndices.add(index)
      if (index + 1 < words.length) protectedIndices.add(index + 1)
    }
  })
  const removable: number[] = []
  for (let index = 0; index < words.length; index += 1) {
    if (!protectedIndices.has(index)) removable.push(index)
  }
  return removable
}

// seededRemovalOrder orders the removable indices so content words are removed before function words
// (preserving the grammatical skeleton), with a deterministic seeded tiebreak. Stage-independent, so
// a prefix gives the nested superset property.
function seededRemovalOrder(
  words: readonly string[],
  removable: number[],
  seed: number | bigint,
): number[] {
  return [...removable].sort((indexA, indexB) => {
    const stopA = isStopWord(words[indexA])
    const stopB = isStopWord(words[indexB])
    if (stopA !== stopB) return stopA ? 1 : -1 // content words (non-stop) first
    const rankA = seededRank(seed, indexA)
    const rankB = seededRank(seed, indexB)
    if (rankA !== rankB) return rankA - rankB
    return indexA - indexB
  })
}

// seededRank is a deterministic uint32 hash of (seed, index) — a splitmix32-style finalizer in
// uint32 arithmetic (Math.imul + >>> 0) identical to the Go seededRank. The whole source of
// "randomness"; no ambient RNG (purity).
function seededRank(seed: number | bigint, index: number): number {
  // The seed is an int64 (proto/domain `bigint`); take its low 32 bits the same way Go's uint32(seed)
  // does, via bigint so seeds above Number.MAX_SAFE_INTEGER keep every bit (golden-parity, [A10]).
  const seed32 = Number(BigInt.asUintN(32, BigInt(seed)))
  let x = (seed32 + (Math.imul(index, 0x9e3779b1) >>> 0)) >>> 0
  x ^= x >>> 16
  x = Math.imul(x, 0x7feb352d) >>> 0
  x ^= x >>> 15
  x = Math.imul(x, 0x846ca68b) >>> 0
  x ^= x >>> 16
  return x >>> 0
}

// endsSentence reports whether a word carries sentence-final punctuation (Latin + CJK terminators),
// marking a sentence boundary for the first/last-word guard. Trailing closing quotes/brackets are
// stripped first so `hello."` still reads as a sentence end.
function endsSentence(word: string): boolean {
  const runes = Array.from(word)
  let end = runes.length
  while (end > 0 && CLOSING_PUNCT.has(runes[end - 1])) end -= 1
  if (end === 0) return false
  const last = runes[end - 1]
  return (
    last === '.' ||
    last === '!' ||
    last === '?' ||
    last === '。' ||
    last === '！' ||
    last === '？' ||
    last === '…'
  )
}

const CLOSING_PUNCT = new Set(['"', "'", ')', ']', '}', '”', '’', '」', '』', '）', '》'])

// isStopWord strips edge punctuation and lower-cases before the set lookup, matching the Go trim set.
function isStopWord(word: string): boolean {
  return STOP_WORDS.has(trimPunctuation(word).toLowerCase())
}

const EDGE_PUNCTUATION = new Set([
  '.',
  ',',
  '!',
  '?',
  ';',
  ':',
  '"',
  "'",
  '(',
  ')',
  '。',
  '！',
  '？',
  '…',
])

function trimPunctuation(word: string): string {
  const runes = Array.from(word)
  let start = 0
  let end = runes.length
  while (start < end && EDGE_PUNCTUATION.has(runes[start])) start += 1
  while (end > start && EDGE_PUNCTUATION.has(runes[end - 1])) end -= 1
  return runes.slice(start, end).join('')
}
