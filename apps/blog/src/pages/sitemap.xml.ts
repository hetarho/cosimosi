import { getCollection } from 'astro:content'
import type { APIContext } from 'astro'

import { absolute } from '../site.ts'

export const prerender = true

// Served at `/blog/sitemap.xml`, which the origin root's robots.txt names alongside its own. It lists the
// index and every non-draft post and nothing else — a sitemap that advertised a URL the SPA answers with
// its not-found screen would be asking a crawler to index a soft 404.
export async function GET(context: APIContext) {
  const posts = (await getCollection('posts', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
  )

  const urls = [
    { loc: absolute('', context.site), lastmod: posts[0]?.data.pubDate },
    ...posts.map((post) => ({
      loc: absolute(`${post.id}/`, context.site),
      lastmod: post.data.updated ?? post.data.pubDate,
    })),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ({ loc, lastmod }) => `  <url>
    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}
  </url>`,
  )
  .join('\n')}
</urlset>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
