import { getCollection } from 'astro:content'
import type { APIContext } from 'astro'

import { OG_IMAGE, absolute } from '../site.ts'

export const prerender = true

/** How many of the newest posts the feed carries. A reader wants the recent ones, not the archive. */
const FEED_LIMIT = 20

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

// Hand-rolled on purpose: a dependency to emit thirty lines of XML is not earned, and the feed's shape has
// not changed since RSS 2.0 was published.
export async function GET(context: APIContext) {
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime())
    .slice(0, FEED_LIMIT)

  const items = posts
    .map(
      (post) => `    <item>
      <title>${escapeXml(post.data.title)}</title>
      <link>${absolute(`${post.id}/`, context.site)}</link>
      <guid>${absolute(`${post.id}/`, context.site)}</guid>
      <description>${escapeXml(post.data.description)}</description>
      <pubDate>${post.data.pubDate.toUTCString()}</pubDate>
    </item>`,
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>cosimosi 노트</title>
    <link>${absolute('', context.site)}</link>
    <description>${escapeXml('cosimosi가 어떤 기억 연구에서 영감을 받았고, 그중 무엇을 가져오고 무엇을 가져오지 않았는지 적어 둔 글 모음입니다.')}</description>
    <language>ko-KR</language>
    <image>
      <url>${absolute(OG_IMAGE, context.site)}</url>
      <title>cosimosi 노트</title>
      <link>${absolute('', context.site)}</link>
    </image>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
