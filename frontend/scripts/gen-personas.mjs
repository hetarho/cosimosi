// personas.ts 생성기 — scripts/persona-corpora.json(검수된 일기 코퍼스 원천)을 읽어
// src/shared/lib/demo/personas.ts(타입 입힌 PersonaCorpus 3종)를 찍어낸다. 일기 본문을
// 손으로 옮기다 escape를 틀리지 않도록, 텍스트는 JSON.stringify로 안전하게 직렬화한다.
// 코퍼스를 손보려면 persona-corpora.json을 고치고 다시 돌린다:  node scripts/gen-personas.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(here, 'persona-corpora.json')
const OUT = resolve(here, '../src/shared/lib/demo/personas.ts')

const MOODS = new Set([
  'JOY',
  'CALM',
  'SAD',
  'ANGER',
  'FEAR',
  'LOVE',
  'NEUTRAL',
  'EXCITEMENT',
  'GRATITUDE',
  'RELIEF',
  'STRESS',
  'TIRED',
  'EMPTINESS',
])
const VAR = { student: 'STUDENT', worker: 'WORKER', homemaker: 'HOMEMAKER' }

const { personas } = JSON.parse(readFileSync(SRC, 'utf8'))
const s = (v) => JSON.stringify(v) // 한국어/따옴표 안전 직렬화(JSON 문자열은 그대로 유효한 TS 문자열)

function fragLine(f) {
  if (!MOODS.has(f.mood)) throw new Error(`unknown mood: ${f.mood}`)
  return `        { topics: ${s(f.topics)}, mood: Mood.${f.mood}, intensity: ${f.intensity}, text: ${s(f.text)} },`
}

function diaryBlock(d) {
  const frags = d.fragments.map(fragLine).join('\n')
  return `    {\n      key: ${s(d.key)},\n      entryDaysAgo: ${d.entryDaysAgo},\n      fragments: [\n${frags}\n      ],\n    },`
}

function recallLine(r) {
  return `    { daysAgo: ${r.daysAgo}, keys: ${s(r.keys)} },`
}

function corpusBlock(p) {
  const diaries = p.diaries.map(diaryBlock).join('\n')
  const recalls = p.recalls.map(recallLine).join('\n')
  const stars = p.diaries.reduce((n, d) => n + d.fragments.length, 0)
  return (
    `// ${p.label} — ${p.tagline} · 일기 ${p.diaries.length}편 / 별(조각) ${stars}개 / 회상 ${p.recalls.length}회\n` +
    `const ${VAR[p.id]}: PersonaCorpus = {\n` +
    `  id: ${s(p.id)},\n  label: ${s(p.label)},\n  tagline: ${s(p.tagline)},\n` +
    `  diaries: [\n${diaries}\n  ],\n  recalls: [\n${recalls}\n  ],\n}`
  )
}

const header = `// 데모("체험") 페르소나 일기 코퍼스 — 우주의 주인공별 일기 흐름(별·시냅스의 원천).
// 자동 생성: scripts/gen-personas.mjs <- scripts/persona-corpora.json. 손으로 고치지 말고
// JSON을 고친 뒤 \`node scripts/gen-personas.mjs\`로 다시 찍는다(일기 본문 escape 안전).
//
// 한 일기는 여러 조각(fragment)으로 나뉘고 조각 하나가 별 하나가 된다. 같은 일기 조각들이
// 서로 다른 주제를 담으면 그 일내 결속선이 주제 성단 사이의 다리가 된다(simulate.ts). 그래프
// (별·시냅스)는 simulate가 이 코퍼스에서 파생한다 — 여기엔 "쓴 것"만 두고 "이어진 것"은 안 둔다.
import { Mood } from '@/shared/api'
import type { DemoPersona } from './flag'
import type { PersonaCorpus } from './simulate'
`

const body = personas.map(corpusBlock).join('\n\n')

const footer = `

/** 페르소나 id → 코퍼스. ensureSeeded가 활성 페르소나로 골라 우주를 시드한다. */
export const CORPORA: Record<DemoPersona, PersonaCorpus> = {
  student: STUDENT,
  worker: WORKER,
  homemaker: HOMEMAKER,
}

/** 스위처 표시 순서(조밀→성김). */
export const PERSONA_ORDER: DemoPersona[] = ['student', 'worker', 'homemaker']

export interface DemoPersonaMeta {
  id: DemoPersona
  label: string
  tagline: string
}

/** 스위처용 메타 목록 — 라벨·태그라인은 코퍼스 단일 출처에서 읽는다(중복 없음). */
export function demoPersonaList(): DemoPersonaMeta[] {
  return PERSONA_ORDER.map((id) => ({ id, label: CORPORA[id].label, tagline: CORPORA[id].tagline }))
}
`

writeFileSync(OUT, header + '\n' + body + footer)
const total = personas.reduce(
  (n, p) => n + p.diaries.reduce((m, d) => m + d.fragments.length, 0),
  0,
)
console.log(`wrote ${OUT}\n  personas: ${personas.length}, total stars(fragments): ${total}`)
