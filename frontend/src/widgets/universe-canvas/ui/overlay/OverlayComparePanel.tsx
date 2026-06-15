// Compare panel (spec 37): when a resonance bridge is selected, show the same event as it lives in
// BOTH universes side by side — the divergence is the point (color=emotion, brightness=recall,
// differ between the two engrams). ASYMMETRIC by design (acceptance 2.3): MY side may show its
// fragment text (it's mine); the FRIEND side shows ONLY visual info — never text (content-zero,
// spec 35). A DOM HUD (outside the R3F scene, 헌법4); reads the focus machine's pair selection.
//
// MY text is supplied by `resolveMyText` (the public visit page reads the read-only query cache —
// never a reinforcing RecallMemory, since overlay is write-free 3.1; the demo reads its fragment
// store). If absent, a gentle hint shows instead. The friend side NEVER renders text.
import { useSelector } from '@xstate/react'
import { focusActor, selectPairFocus, type StarNode } from '@/entities/memory'
import { moodLabel, resolveMoodRgb } from '@/shared/config'

/** linear RGB(0..1) → CSS rgb() for a swatch. */
function rgbCss(rgb: readonly [number, number, number]): string {
  const to = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255)
  return `rgb(${to(rgb[0])}, ${to(rgb[1])}, ${to(rgb[2])})`
}

function Meter({ label, value }: { label: string; value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-white/40">{label}</span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-white/60" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function StarFacet({ star, colors }: { star: StarNode; colors?: Record<string, string> }) {
  const m = star.memory
  const swatch = rgbCss(resolveMoodRgb(m.mood, colors))
  // 밝기(회상 빈도) 차이는 3D 씬의 실제 별 밝기로 이미 드러난다 — 패널은 정적 데이터(감정·강도)만
  // 보여 두 별이 같은 사건에서 어떻게 다르게 *물든* 기억인지 나란히 비교한다(렌더 순수성: now 미사용).
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: swatch }} />
        <span className="text-sm text-white/85">{moodLabel(m.mood)}</span>
      </div>
      <Meter label="감정 강도" value={m.intensity} />
    </div>
  )
}

export interface OverlayComparePanelProps {
  myStars: StarNode[]
  theirStars: StarNode[]
  myEmotionColors?: Record<string, string>
  theirEmotionColors?: Record<string, string>
  /** my star's fragment text, resolved read-only by the host (cache / demo store). undefined → hint. */
  resolveMyText?: (memoryId: string) => string | undefined
}

export function OverlayComparePanel({
  myStars,
  theirStars,
  myEmotionColors,
  theirEmotionColors,
  resolveMyText,
}: OverlayComparePanelProps) {
  const pair = useSelector(focusActor, selectPairFocus)
  if (!pair) return null

  const mine = myStars.find((s) => s.id === pair.myId)
  const theirs = theirStars.find((s) => s.id === pair.theirId)
  if (!mine || !theirs) return null

  const raw = resolveMyText?.(mine.id)
  const myText = raw && raw.trim() !== '' ? raw : undefined

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
      <div className="w-xl max-w-[92vw] rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-white/85">공명하는 두 기억</p>
          <button
            type="button"
            onClick={() => focusActor.send({ type: 'DISMISS' })}
            className="rounded-full px-2 py-0.5 text-xs text-white/50 hover:text-white/80"
            aria-label="비교 닫기"
          >
            닫기
          </button>
        </div>
        <p className="mb-3 text-[11px] text-white/40">
          같은 사건이 두 우주에서 어떻게 다르게 빛나고 변해 왔는지 — 색은 감정, 밝기는 회상이에요.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-amber-200/80">내 별</p>
            <StarFacet star={mine} colors={myEmotionColors} />
            {myText ? (
              <p className="mt-1 max-h-24 overflow-y-auto text-[11px] leading-relaxed text-white/70">
                {myText}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-white/35">
                내 우주에서 이 별을 회상하면 그 일기를 볼 수 있어요.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-sky-200/80">친구의 별</p>
            <StarFacet star={theirs} colors={theirEmotionColors} />
            <p className="mt-1 text-[11px] text-white/35">
              풍경만 공개돼요 — 친구가 쓴 글은 보이지 않아요.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
