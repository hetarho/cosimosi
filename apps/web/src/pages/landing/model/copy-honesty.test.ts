import { describe, expect, it } from 'vitest'

// `?raw` rather than `node:fs`, so the test reads through the same bundler the app does and this package
// needs no Node types in its browser tsconfig.
import enCatalogue from '../../../../../../packages/i18n/messages/en.json?raw'
import koCatalogue from '../../../../../../packages/i18n/messages/ko.json?raw'
import shell from '../../../../index.html?raw'

// The honesty gate for the two places this unit puts prose in front of a stranger: every `landing_*`
// message in BOTH catalogues, and the HTML shell.
//
// A test rather than a lint script on purpose — the repo-wide public-copy script is the blog unit's, and
// it lands after this one, so a script here would be the second thing checking the same rule. When it
// arrives it takes these two roots; this stays as the unit's own regression guard.
//
// The product is unusually easy to overclaim: it is built on memory research, it moves, and it looks like
// a brain if you squint. Each pattern below is one of those temptations, made mechanical.
const CATALOGUES = ['en', 'ko'] as const

const CATALOGUE_SOURCE: Readonly<Record<(typeof CATALOGUES)[number], string>> = {
  en: enCatalogue,
  ko: koCatalogue,
}

function landingMessages(locale: (typeof CATALOGUES)[number]): Record<string, string> {
  const all = JSON.parse(CATALOGUE_SOURCE[locale]) as Record<string, string>
  return Object.fromEntries(Object.entries(all).filter(([key]) => key.startsWith('landing_')))
}

// A DENIAL is not a claim. "It is a diary, not a model of anyone's brain" is the sentence the honesty rule
// wants on the page, and a matcher that flagged it would push the copy into saying nothing at all — which
// is how a page ends up merely quiet about the thing it should be explicit about.
//
// It is an EXACT-SENTENCE allowlist rather than a negation rule, because a negation rule has a hole you
// cannot close by tightening it: "Not just a diary — it works like your brain." carries a negation and the
// forbidden claim in one breath, and any "is there a `not` nearby" test lets it through. Listing the
// reviewed sentences instead means every disclaimer is a deliberate entry a reviewer sees, and nothing else
// gets the exemption.
//
// Adding a sentence here is a public-copy decision, not a test fix.
const REVIEWED_DENIALS: readonly string[] = [
  "It is a diary, not a model of anyone's brain, and you never need to know any of this to use it.",
  '이것은 일기이고, 누군가의 뇌를 재현한 모형이 아닙니다.',
]

const reviewed = new Set(REVIEWED_DENIALS.map(normalize))

// `’` vs `'` and collapsed whitespace, so a typographic apostrophe or a reflowed line does not silently
// drop a sentence out of the allowlist and into the forbidden set.
function normalize(sentence: string): string {
  return sentence.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()
}

function claimingSentences(text: string, patterns: readonly RegExp[]): string[] {
  return normalize(text)
    .split(/(?<=[.!?])\s+|(?<=[다요][.!?])\s*/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
    .filter((sentence) => patterns.some((pattern) => pattern.test(sentence)))
    .filter((sentence) => !reviewed.has(sentence))
}

interface ForbiddenClass {
  readonly what: string
  readonly patterns: readonly RegExp[]
}

const FORBIDDEN: readonly ForbiddenClass[] = [
  {
    // The claim the product must never let a reader form. "Inspired by" is the whole licence.
    what: 'brain equivalence',
    patterns: [
      /뇌\s*처럼/,
      /뇌와\s*(같|동일)/,
      /뇌를\s*재현/,
      /works?\s+like\s+(a|your)\s+brain/i,
      /like\s+your\s+brain\s+does/i,
      /same\s+as\s+(a|the|your)\s+brain/i,
    ],
  },
  {
    what: 'therapeutic or clinical claim',
    patterns: [
      /치료/,
      /치유/,
      /효능/,
      /\btherapy\b/i,
      /\btherapeutic\b/i,
      /\bcure[sd]?\b/i,
      /\bclinical/i,
    ],
  },
  {
    // The coordinates are emergent visualization, never anatomy. The hero mounts no coordinate source at
    // all, so there is nothing on the page for a sentence like this to be about — but prose could still
    // invent it.
    what: 'coordinates presented as the brain’s real coordinates',
    patterns: [
      /뇌의\s*(실제\s*)?(좌표|위치)/,
      /실제\s*뇌\s*좌표/,
      /brain'?s\s+(real\s+|actual\s+)?coordinates/i,
      /(real|actual)\s+brain\s+(coordinates|positions?)/i,
    ],
  },
  {
    // Mechanics the code does not have. Emotion colours a memory; it does not place one. Memories do not
    // pull on each other — they hang from shared neurons. Radius is not a clock.
    what: 'a mechanic the product does not have',
    patterns: [
      /감정이\s*(위치|자리|좌표)를\s*(정|결정)/,
      /emotion\s+(determines?|drives?|sets?)\s+(the\s+)?(position|place|coordinates?|distance)/i,
      /emotion\s+(determines?|drives?|sets?)\s+(the\s+)?(link|connection)\s+strength/i,
      /기억(들)?이\s*서로를?\s*(끌어|당긴|당깁)/,
      /memories\s+attract\s+(each\s+other|one\s+another)/i,
      /(반지름|거리)(가|는)\s*최근/,
      /radius\s+means\s+(how\s+)?recen/i,
    ],
  },
  {
    // The landing carries the summary a non-specialist reads; papers and DOIs live one tier down. A page
    // that can cite is a page that will eventually cite something it does not implement.
    what: 'an academic citation',
    patterns: [/10\.\d{4,9}\//, /\bet\s+al\.?/i, /\([A-Z][A-Za-z-]+,?\s+(19|20)\d{2}\)/],
  },
]

describe('landing copy honesty', () => {
  for (const locale of CATALOGUES) {
    const messages = landingMessages(locale)

    it(`has landing copy at all in ${locale}`, () => {
      expect(Object.keys(messages).length).toBeGreaterThan(20)
    })

    for (const { what, patterns } of FORBIDDEN) {
      it(`makes no ${what} in ${locale}`, () => {
        const offenders = Object.entries(messages).filter(
          ([, text]) => claimingSentences(text, patterns).length > 0,
        )
        expect(offenders.map(([key]) => key)).toEqual([])
      })
    }
  }

  for (const { what, patterns } of FORBIDDEN) {
    it(`makes no ${what} in the HTML shell`, () => {
      expect(claimingSentences(shell, patterns)).toEqual([])
    })
  }

  it('says inspired-by rather than equivalence, in both locales', () => {
    // The positive half of the rule: the framing has to be on the page, not merely un-violated.
    expect(landingMessages('en').landing_theory_intro).toMatch(/inspired by/i)
    expect(landingMessages('ko').landing_theory_intro).toMatch(/영감/)
  })

  it('carries the same landing keys in both catalogues', () => {
    // A key present in one language only is a sentence nobody reviewed in the other.
    expect(Object.keys(landingMessages('ko')).sort()).toEqual(
      Object.keys(landingMessages('en')).sort(),
    )
  })

  it('proves each pattern class can actually fail', () => {
    // A guard nobody has seen fail is a guard nobody knows is wired. One deliberate offender per class,
    // through the same matcher the assertions above use.
    const offenders: Record<string, string> = {
      'brain equivalence': 'It works like a brain.',
      'therapeutic or clinical claim': 'Clinically proven therapy for memory.',
      'coordinates presented as the brain’s real coordinates':
        "These are the brain's real coordinates.",
      'a mechanic the product does not have': 'Memories attract each other over time.',
      'an academic citation': 'See Kandel et al. and 10.1038/nature12345.',
    }
    for (const { what, patterns } of FORBIDDEN) {
      expect(claimingSentences(offenders[what] ?? '', patterns).length, what).toBeGreaterThan(0)
    }
  })

  it('still lets the page deny the claim it must not make', () => {
    // The other half of the negation rule, in both languages — because the useful sentence and the
    // forbidden one share every keyword.
    const brain = FORBIDDEN[0].patterns
    expect(claimingSentences('It is a diary, not a model of anyone’s brain.', brain)).toEqual([])
    expect(
      claimingSentences('이것은 일기이고, 누군가의 뇌를 재현한 모형이 아닙니다.', brain),
    ).toEqual([])
    expect(claimingSentences('뇌처럼 작동합니다.', brain)).toHaveLength(1)
  })
})
