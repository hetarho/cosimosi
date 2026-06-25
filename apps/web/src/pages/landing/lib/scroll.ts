import { useCallback } from 'react'
import { useLenis } from 'lenis/react'

/**
 * 섹션으로 부드럽게 스크롤하는 훅. 앱은 Lenis 관성 스크롤로 감싸여 있어(app/SmoothScroll)
 * 네이티브 `scrollIntoView`는 Lenis 내부 위치와 어긋나 목적지를 넘겨버린다.
 * 따라서 Lenis 인스턴스가 있으면 `lenis.scrollTo`로, 없으면(=reduced-motion 폴백) 네이티브로.
 */
export function useScrollToSection() {
  const lenis = useLenis()
  return useCallback(
    (id: string, offset = 0) => {
      if (lenis) {
        lenis.scrollTo(`#${id}`, { offset, duration: 1.1 })
      } else {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    },
    [lenis],
  )
}
