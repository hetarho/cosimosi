// 카드 한 장의 별들을 한 개의 WebGL 캔버스에 담는 공유 캔버스. 별마다 캔버스를 두면 WebGL
// 컨텍스트가 폭발하므로, 카드당 하나만 둔다. ortho 카메라가 논리 좌표 박스(SVG viewBox와 동일한
// y-down 좌표계)를 왜곡 없이(contain) 비추도록 맞춰, 자식 Star3D가 SVG가 그리던 (x,y,r)에 정확히
// 박힌다. IntersectionObserver로 화면 근처일 때만 장착하고, 안 보이면 렌더 루프를 멈춘다.
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Canvas, useThree, type GLProps } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { OrthographicCamera } from 'three'
import { createRenderer } from '@/shared/lib/r3f'
import { useInView } from './use-in-view'
import { StarCanvasContext } from './star-canvas-context'

// 투명 캔버스를 위해 alpha:true 강제(R3F가 promise를 await).
const glFactory = ((props: Parameters<typeof createRenderer>[0]) =>
  createRenderer({ ...props, alpha: true })) as unknown as GLProps

/**
 * 직접 소유한 ortho 카메라로 논리 박스를 contain(여백)으로 비춘다 — SVG meet과 동일. 캔버스 픽셀
 * 비율이 어떻든 x·y 스케일이 같아 오브제가 찌그러지지 않는다. (drei 카메라의 자동 종횡비는
 * 비정사각 캔버스에서 오브제를 왜곡시키므로 직접 제어한다.)
 */
function FitCamera({ width, height }: { width: number; height: number }) {
  const set = useThree((s) => s.set)
  const size = useThree((s) => s.size)
  const camRef = useRef<OrthographicCamera | null>(null)
  if (camRef.current === null) camRef.current = new OrthographicCamera()

  useLayoutEffect(() => {
    const cam = camRef.current
    if (!cam) return
    const target = width / height
    const aspect = size.width / size.height
    let halfW = width / 2
    let halfH = height / 2
    if (aspect > target) halfW = halfH * aspect
    else halfH = halfW / aspect
    cam.left = -halfW
    cam.right = halfW
    cam.top = halfH
    cam.bottom = -halfH
    // ortho는 거리에 무관하게 크기가 같으므로, 카메라를 박스 크기에 비례해 충분히 뒤로 물려 어떤 r의
    // 별이든 near~far 슬랩 안에 통째로 들어오게 한다. (near 평면이 별 앞면보다 가까워야 큰 r의 별
    // 앞면이 잘리지 않는다.)
    const depth = Math.max(width, height)
    cam.position.set(0, 0, depth * 2)
    cam.near = 0.1
    cam.far = depth * 4
    cam.updateProjectionMatrix()
    set({ camera: cam })
  }, [set, size.width, size.height, width, height])

  return null
}

export interface StarCanvasProps {
  /** 논리 좌표 박스(자식 Star3D의 x/y/r 단위). SVG viewBox와 동일하게 맞춘다. */
  width: number
  height: number
  /** 자전·노이즈 등 상시 애니메이션이 필요하면 true(보이는 동안 always 렌더). */
  animated?: boolean
  className?: string
  children: ReactNode
}

export function StarCanvas({ width, height, animated = false, className, children }: StarCanvasProps) {
  const reduced = !!useReducedMotion()
  const { ref, mounted, visible } = useInView<HTMLDivElement>()
  const frameloop = !visible ? 'never' : animated && !reduced ? 'always' : 'demand'

  // R3F는 커스텀 WebGPU 렌더러를 언마운트 시 dispose하지 않는다(UniverseCanvas와 동일 이슈). 직접
  // 보관·정리하지 않으면 StrictMode(dev) 더블마운트나 라우트 전환 때 init()이 진행 중이던 렌더러가
  // 고아로 남아 두 번째 렌더러와 같은 캔버스를 두고 경쟁 → 간헐적으로 첫 프레임이 안 떠 새로고침해야
  // 보이던 버그의 원인. 직접 dispose해 고아 렌더러를 없앤다.
  const glRef = useRef<{ dispose?: () => void } | null>(null)
  useEffect(() => () => glRef.current?.dispose?.(), [])

  return (
    <div ref={ref} className={className} aria-hidden>
      {mounted && (
        <Canvas
          gl={glFactory}
          flat
          dpr={[1, 2]}
          frameloop={frameloop}
          onCreated={(state) => {
            glRef.current = state.gl as unknown as { dispose?: () => void }
            // async WebGPU init 이후 한 프레임을 보장한다 — demand 모드(reduced-motion)에서 마운트 시
            // invalidate가 init보다 먼저 끝나 첫 프레임을 놓치던 경우를 막는다.
            state.invalidate()
          }}
        >
          <FitCamera width={width} height={height} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[1.5, 2, 5]} intensity={2.4} />
          <pointLight position={[-3, -2, 4]} intensity={0.8} />
          <StarCanvasContext.Provider value={{ width, height }}>{children}</StarCanvasContext.Provider>
        </Canvas>
      )}
    </div>
  )
}
