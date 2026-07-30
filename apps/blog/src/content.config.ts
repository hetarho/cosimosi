import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

/**
 * The five research strands the product is built on. A **closed** set, and the landing page's five theory
 * cards resolve against it by linking to `/blog/#<pillar>` — so a typo here does not produce a quietly
 * broken anchor, it fails this build.
 */
export const PILLARS = [
  'engram',
  'spatial-representation',
  'synapse-time',
  'reconstructive-recall',
  'forgetting-accessibility',
] as const

export type Pillar = (typeof PILLARS)[number]

/**
 * The schema IS the publication gate. Every field below is required because its absence is a way to ship
 * something the product's honesty rules forbid:
 *
 * - `description` is authored, never truncated from the body, so a share card is written rather than
 *   guessed at;
 * - `pillar` ties the post to a strand the product actually implements;
 * - `sources` has a **minimum of one** `{ label, doi }`, which is the whole of "papers live on the blog":
 *   a post that explains the science cannot ship uncited, and the DOIs it declares are also what the
 *   post's JSON-LD `citation` entries are built from;
 * - `lang` is the entire per-language story. A translation is a **separate post** with its own slug and
 *   its own `lang`, not a localized variant of this one — the essays are authored prose, and pretending
 *   one file can carry two languages is how a half-translated post ships.
 *
 * `draft` is the only publication switch, and it excludes a post from the index, the feed and the sitemap
 * at once, so the three can never disagree about what is published.
 */
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    pubDate: z.coerce.date(),
    updated: z.coerce.date().optional(),
    lang: z.enum(['ko', 'en']),
    pillar: z.enum(PILLARS),
    sources: z
      .array(z.object({ label: z.string().min(1), doi: z.string().min(1) }))
      .min(1, 'a post must cite at least one source'),
    draft: z.boolean().default(false),
  }),
})

export const collections = { posts }
