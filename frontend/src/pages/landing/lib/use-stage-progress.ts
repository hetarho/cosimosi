import { useEffect, useState } from 'react'
import { useLenis } from 'lenis/react'
import type Lenis from 'lenis'
import { clamp01 } from '@/shared/lib'

/**
 * 히어로 → 상단 고정 무대 전환 진행도(0→1). 첫 화면 높이만큼 스크롤하면 히어로 별이 중앙(큰 별)에서
 * 상단 무대(축소·고정)로 옮겨 앉는다(change 31). 0=히어로 그대로, 1=무대에 완전히 고정.
 *
 * 앱은 Lenis 관성 스크롤로 감싸여 있어(app/SmoothScroll) 스크롤 위치의 단일 출처가 Lenis다 —
 * 있으면 그 콜백으로 읽고, 없으면(=reduced-motion 폴백, Lenis 미장착) 네이티브 scrollY로 읽는다.
 * 어느 경로든 마운트 직후·리사이즈 시 한 번 직접 읽어 초기값을 박는다(복원된 스크롤/딥링크에서 큰 별이
 * 깜빡이지 않게 — Lenis 콜백은 다음 스크롤 틱에야 처음 발화하므로).
 */
export function useStageProgress(): number {
  const [progress, setProgress] = useState(0)

  const lenis = useLenis((l: Lenis) => {
    setProgress(clamp01(l.scroll / window.innerHeight))
  })

  useEffect(() => {
    // 현재 스크롤 위치에서 초기값(또는 리사이즈 후 재계산) — Lenis 유무 무관.
    const read = () => setProgress(clamp01((lenis?.scroll ?? window.scrollY) / window.innerHeight))
    read()
    window.addEventListener('resize', read)
    // Lenis가 있으면 진행 갱신은 위 콜백이 — 여기선 폴백 스크롤만 듣는다.
    if (!lenis) window.addEventListener('scroll', read, { passive: true })
    return () => {
      window.removeEventListener('resize', read)
      window.removeEventListener('scroll', read)
    }
  }, [lenis])

  return progress
}
