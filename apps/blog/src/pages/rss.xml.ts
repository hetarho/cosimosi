import * as blogMarkdown from "../../../../spec/blog.md";

export const prerender = true;

const siteUrl = "https://cosimosi.haeram.me";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  const raw = await blogMarkdown.rawContent();
  const title = raw.match(/^#\s+(.+)$/m)?.[1] ?? "cosimosi blog";
  const firstParagraph =
    raw
      .split("\n")
      .find((line) => line.startsWith("> cosimosi"))
      ?.replace(/^>\s*/, "") ??
    "cosimosi의 기억 우주를 뇌과학으로 풀어내는 블로그입니다.";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${siteUrl}/</link>
    <description>${escapeXml(firstParagraph)}</description>
    <language>ko-KR</language>
    <item>
      <title>${escapeXml(title)}</title>
      <link>${siteUrl}/</link>
      <guid>${siteUrl}/</guid>
      <description>${escapeXml(firstParagraph)}</description>
      <pubDate>${new Date("2026-06-24T00:00:00+09:00").toUTCString()}</pubDate>
    </item>
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
