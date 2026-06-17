import { createContext } from 'react'

/** 자식 Star3D가 논리 좌표(SVG viewBox와 동일, y-down) → 월드 좌표 변환에 쓰는 박스 크기. */
export const StarCanvasContext = createContext<{ width: number; height: number }>({ width: 100, height: 100 })
