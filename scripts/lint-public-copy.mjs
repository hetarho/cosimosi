#!/usr/bin/env node
// Public-copy lint: the honesty rules for every sentence a stranger can read, made mechanical.
//
// The product is unusually easy to overclaim — it is built on memory research, it moves, and it looks like
// a brain if you squint — so the temptation is never to lie outright, it is to let a reader draw a
// conclusion nobody wrote. Each class below is one of those conclusions.
//
// The ROOTS are data, deliberately: this ships scanning the blog's essays, and the landing page's message
// catalogue can join later without re-deciding anything (that surface currently carries its own unit test,
// which also holds an exact-sentence allowlist this script has no need of yet).
//
//   node scripts/lint-public-copy.mjs
//   node scripts/lint-public-copy.mjs --probe    self-test that every class actually fires
//
// Rules: spec/policy/ux/public-copy.md

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'

import { fail, ok, repoRoot, section } from './lib.mjs'

const roots = ['apps/blog/src/content']
const extensions = new Set(['.md', '.mdx'])

const classes = [
  {
    what: 'brain equivalence',
    why: 'the product is inspired by memory research; it is not a model of anyone’s brain',
    patterns: [
      /뇌\s*처럼\s*(작동|동작|기능)/,
      /뇌와\s*(똑)?같(이|은)\s*(작동|동작|구조)/,
      /뇌를\s*(그대로\s*)?재현(한|합니다|해)/,
      /works?\s+like\s+(a|the|your)\s+brain/i,
      /same\s+as\s+(a|the|your)\s+brain/i,
    ],
  },
  {
    what: 'a therapeutic or clinical claim',
    why: 'a diary makes no claim about anyone’s health',
    patterns: [
      /(치료|치유)(에|를|해|합니다|됩니다|하는)/,
      /효능/,
      /\btherapy\b/i,
      /\btherapeutic\b/i,
      /\bcure[sd]?\b/i,
      /\bclinically\b/i,
    ],
  },
  {
    what: 'coordinates presented as the brain’s real coordinates',
    why: 'positions come out of the force simulation and change every frame',
    patterns: [
      /뇌의\s*(실제\s*)?(좌표|위치)/,
      /실제\s*뇌\s*(좌표|위치)/,
      /brain'?s\s+(real\s+|actual\s+)?coordinates/i,
      /(real|actual)\s+brain\s+(coordinates|positions?)/i,
    ],
  },
  {
    what: 'emotion driving a position or a link',
    why: 'valence becomes colour and arousal changes strength; neither places a memory or forms a link',
    patterns: [
      /감정\s*(좌표)?\s*(가|이)\s*(가까운|비슷한)[^.\n]{0,20}(더\s*)?(단단|강|굵)/,
      /감정이[^.\n]{0,20}(위치|자리|거리|좌표|연결)를?\s*(정|결정|만들)/,
      /감정으로\s*(물든|이어진)[^.\n]{0,10}(연결|선)/,
      /emotion(al)?[^.\n]{0,24}(determines?|drives?|sets?)[^.\n]{0,12}(position|place|distance|coordinates?|link|connection)/i,
    ],
  },
  {
    what: 'memories attracting one another',
    why: 'memories hang from shared neurons, not from each other',
    patterns: [
      /기억(들)?(끼리|이)\s*서로를?\s*(끌어당|당긴|당깁)/,
      /기억끼리\s*끌어당/,
      /memories\s+attract\s+(each\s+other|one\s+another)/i,
    ],
  },
  {
    what: 'radius meaning recency or emotion',
    why: 'the centre is self, and radius is how connected a memory is — never time, never feeling',
    patterns: [
      /(강렬|격렬)했?던?\s*기억일수록[^.\n]{0,16}가까(이|운)/,
      /감정이\s*(깊|강)[^.\n]{0,16}(가까이|중심)/,
      /(최근|새로운)\s*기억일수록[^.\n]{0,16}(가까이|중심)/,
      /radius\s+(means?|is)\s+(how\s+)?(recen|new)/i,
    ],
  },
]

// A DENIAL is not a claim, and the posts are full of denials on purpose — "감정은 별의 자리를 정하지
// 않습니다" is the sentence the policy WANTS on the page. So a match only counts when the clause it starts
// is not negated.
//
// The window is deliberately AFTER the match, not "anywhere in the sentence". Korean negation is
// post-verbal (`…끌어당기지 않습니다`, `…재현한 모형이 아닙니다`), so a tail check catches every honest
// denial while leaving no room for the trick a whole-sentence check has: an English-style "Not just a
// diary — it works like your brain" puts the negation BEFORE the claim and would sail through a sentence
// scan. If English posts ever arrive, their denials need their own handling rather than a widened window.
const NEGATION_TAIL = /(않|아닙|아니|없|말고|대신)/

function claimingMatches(text, patterns) {
  const found = []
  for (const pattern of patterns) {
    const global = new RegExp(
      pattern.source,
      pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
    )
    for (const match of text.matchAll(global)) {
      const from = match.index ?? 0
      // To the end of the clause: a Korean sentence terminator, or a hard break.
      const tail = text.slice(from, from + 160).split(/[.!?\n]/)[0] ?? ''
      if (!NEGATION_TAIL.test(tail)) found.push(pattern)
    }
  }
  return found
}

function walk(dir, into) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, into)
    else if (extensions.has(extname(full))) into.push(full)
  }
}

const probe = process.argv.includes('--probe')

section('public-copy honesty')

if (probe) {
  // A lint rule nobody has seen fail is a rule nobody knows is wired. One deliberate offender per class,
  // plus the sentences the rules must NOT touch — the disclaimers are the whole point of the page.
  const offenders = {
    'brain equivalence': '이 제품은 뇌처럼 작동합니다.',
    'a therapeutic or clinical claim': '기억을 치료하는 데 효능이 있습니다.',
    'coordinates presented as the brain’s real coordinates': '별의 자리는 뇌의 실제 좌표입니다.',
    'emotion driving a position or a link': '감정이 별의 위치를 결정합니다.',
    'memories attracting one another': '비슷한 기억끼리 끌어당깁니다.',
    'radius meaning recency or emotion': '강렬했던 기억일수록 중심에 가까이 남아요.',
  }
  const permitted = [
    'cosimosi는 기억 연구에서 영감을 받은 일기이고, 누군가의 뇌를 재현한 모형이 아닙니다.',
    '감정은 별의 자리를 정하지 않습니다.',
    '기억끼리 서로를 끌어당기지 않습니다.',
    '중심에서의 거리는 그 별이 다른 기억들과 얼마나 이어져 있는지에서 나와요.',
    '정서가는 색이 되고, 각성은 강도와 잊히는 속도를 바꿉니다.',
  ]
  const missed = classes.filter(
    ({ what, patterns }) => claimingMatches(offenders[what] ?? '', patterns).length === 0,
  )
  if (missed.length) {
    fail(
      `these classes did not fire on their own offender:\n  ${missed.map((c) => c.what).join('\n  ')}`,
    )
  }
  const wrongly = []
  for (const sentence of permitted) {
    for (const { what, patterns } of classes) {
      if (claimingMatches(sentence, patterns).length > 0) wrongly.push(`${what}: ${sentence}`)
    }
  }
  if (wrongly.length) {
    // A rule that flags the denial pushes the copy into saying nothing at all, which is quieter but not
    // more honest.
    fail(
      `these rules wrongly flagged a sentence the policy WANTS on the page:\n  ${wrongly.join('\n  ')}`,
    )
  }
  ok(
    `${classes.length} class(es) fire on an offender and leave ${permitted.length} honest sentence(s) alone`,
  )
} else {
  const files = []
  for (const root of roots) {
    const dir = join(repoRoot, root)
    walk(dir, files)
  }

  const violations = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    const rel = relative(repoRoot, file).split(sep).join('/')
    for (const { what, why, patterns } of classes) {
      const [hit] = claimingMatches(text, patterns)
      if (hit) violations.push(`${rel}: ${what} — ${why}\n    matched ${hit}`)
    }
  }

  if (violations.length) {
    console.error(violations.map((line) => `- ${line}`).join('\n'))
    fail('public copy makes a claim the product cannot support (spec/policy/ux/public-copy.md)')
  }
  ok(`scanned ${files.length} public-copy file(s) across ${classes.length} claim class(es)`)
}
