import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { VALUES } from '@cosimosi/config'

import {
  blendEmotionColors,
  packEmotionUniforms,
  rgba,
  type EmotionSlice,
} from './emotion-field.ts'
import { composeFragment } from './shader-effect.ts'

// A minimal raw-WebGL2 host for the emotion backdrops. It renders a single
// full-screen triangle (no vertex buffer — positions come from gl_VertexID) and
// runs the effect's `renderEffect` fragment body against the shared emotion
// uniforms. Deliberately NOT three.js: `three` is confined to @cosimosi/3d-renderer
// (ARCHITECTURE §3.3), and a 2D full-screen fragment pass needs none of it.
//
// Lifecycle notes:
//   • The WebGL2 context is created once per canvas and reused; switching effects
//     only recompiles the program (no context churn, stays under the browser's
//     ~16-context ceiling when several tiles are mounted).
//   • DPR is capped at rendering.max_pixel_ratio — the shared performance floor.
//   • Offscreen tiles pause via IntersectionObserver; reduced motion freezes uTime
//     at a developed phase and stops the rAF loop entirely (one static frame).
//   • If WebGL2 is unavailable or the shader fails to compile, the canvas hides and
//     a CSS weighted-tint gradient shows through, so a tile is never blank.

const FROZEN_TIME = 12.0 // a developed phase for the reduced-motion static frame

const VERTEX_SHADER = /* glsl */ `#version 300 es
out vec2 vUv;
void main(){
  // Full-screen triangle: id 0→(0,0) 1→(2,0) 2→(0,2) in UV; positions cover the clip box.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`

export interface ShaderCanvasProps {
  /** GLSL body of `vec3 renderEffect(vec2 uv)`. */
  readonly body: string
  /** 1..13 emotions, primary-first. */
  readonly emotions: readonly EmotionSlice[]
  /** Freeze animation to a single static frame when true. */
  readonly reducedMotion: boolean
  readonly className?: string
}

interface LoopControl {
  readonly start: () => void
  readonly stop: () => void
  readonly redrawFrozen: () => void
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[shader-canvas] shader compile failed:\n', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

export function ShaderCanvas({ body, emotions, reducedMotion, className }: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const uniforms = useMemo(() => packEmotionUniforms(emotions), [emotions])
  const uniformsRef = useRef(uniforms)
  const reducedRef = useRef(reducedMotion)
  const controlRef = useRef<LoopControl | null>(null)
  const [glEpoch, setGlEpoch] = useState(0) // bumped on context-restored to rebuild

  const fallbackStyle = useMemo<CSSProperties>(() => {
    const base = blendEmotionColors(emotions)
    return {
      backgroundColor: '#05050a',
      backgroundImage: `radial-gradient(120% 90% at 50% 42%, ${rgba(base, 0.5)} 0%, #05050a 82%)`,
    }
  }, [emotions])

  // The shared program build + render loop, rebuilt when the effect (body) changes.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: 'low-power',
    })
    if (!gl) {
      canvas.style.display = 'none'
      return
    }
    canvas.style.display = 'block'

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, composeFragment(body))
    const program = vs && fs ? gl.createProgram() : null
    if (!program || !vs || !fs) {
      canvas.style.display = 'none'
      if (vs) gl.deleteShader(vs)
      if (fs) gl.deleteShader(fs)
      return
    }
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[shader-canvas] program link failed:\n', gl.getProgramInfoLog(program))
      canvas.style.display = 'none'
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteProgram(program)
      return
    }

    const vao = gl.createVertexArray()
    const loc = {
      time: gl.getUniformLocation(program, 'uTime'),
      res: gl.getUniformLocation(program, 'uResolution'),
      reduced: gl.getUniformLocation(program, 'uReducedMotion'),
      count: gl.getUniformLocation(program, 'uCount'),
      colors: gl.getUniformLocation(program, 'uColors'),
      weights: gl.getUniformLocation(program, 'uWeights'),
      base: gl.getUniformLocation(program, 'uBase'),
    }
    const maxDpr = VALUES.rendering.maxPixelRatio
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)

    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    const draw = (seconds: number) => {
      resize()
      const u = uniformsRef.current
      gl.useProgram(program)
      gl.bindVertexArray(vao)
      gl.uniform1f(loc.time, seconds)
      gl.uniform2f(loc.res, canvas.width, canvas.height)
      gl.uniform1f(loc.reduced, reducedRef.current ? 1 : 0)
      gl.uniform1i(loc.count, u.count)
      gl.uniform3fv(loc.colors, u.colors)
      gl.uniform1fv(loc.weights, u.weights)
      gl.uniform3f(loc.base, u.base[0], u.base[1], u.base[2])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const start = performance.now()
    let raf = 0
    let running = false
    let visible = true

    const frame = (now: number) => {
      if (!running || !visible) {
        running = false
        return
      }
      draw((now - start) / 1000)
      raf = requestAnimationFrame(frame)
    }
    const control: LoopControl = {
      start: () => {
        if (running || !visible || reducedRef.current) {
          if (reducedRef.current) draw(FROZEN_TIME)
          return
        }
        running = true
        raf = requestAnimationFrame(frame)
      },
      stop: () => {
        running = false
        cancelAnimationFrame(raf)
      },
      redrawFrozen: () => {
        if (!running) draw(reducedRef.current ? FROZEN_TIME : (performance.now() - start) / 1000)
      },
    }
    controlRef.current = control

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        visible = entry ? entry.isIntersecting : true
        if (visible) control.start()
        else control.stop()
      },
      { threshold: 0 },
    )
    io.observe(canvas)

    const onLost = (event: Event) => {
      event.preventDefault()
      control.stop()
    }
    const onRestored = () => setGlEpoch((value) => value + 1)
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)

    draw(reducedRef.current ? FROZEN_TIME : 0) // paint immediately (no blank flash)
    control.start()

    return () => {
      control.stop()
      controlRef.current = null
      io.disconnect()
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      if (vao) gl.deleteVertexArray(vao)
    }
  }, [body, glEpoch])

  useEffect(() => {
    uniformsRef.current = uniforms
    controlRef.current?.redrawFrozen()
  }, [uniforms])

  useEffect(() => {
    reducedRef.current = reducedMotion
    const control = controlRef.current
    if (!control) return
    if (reducedMotion) {
      control.stop()
      control.redrawFrozen()
    } else {
      control.start()
    }
  }, [reducedMotion])

  return (
    <div
      aria-hidden
      className={className}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...fallbackStyle }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  )
}
