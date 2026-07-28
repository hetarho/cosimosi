import { highlightSegments } from '@cosimosi/memory'

export interface HighlightedBodyProps {
  /** A stretch of the diary's immutable body — never a memory's current or decayed text ([D10]). */
  text: string
  query: string
}

// features/search-diary ui ([D9][D10]): marks the keyword inside text the row is already showing.
// It highlights in place and never re-centres on the hit, so the preview stays the prefix
// diaryPreview produced — a match-centred excerpt is the snippet [D10] rules out.
export function HighlightedBody({ text, query }: HighlightedBodyProps) {
  const segments = highlightSegments(text, query)
  if (segments.length === 1 && !segments[0]?.match) return text

  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          // Marked typographically rather than with a fill: the palette has no highlight role, and a
          // weight + underline reads on every theme without inventing one.
          <mark
            key={index}
            className="bg-transparent font-medium text-text underline decoration-2 underline-offset-2"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  )
}
