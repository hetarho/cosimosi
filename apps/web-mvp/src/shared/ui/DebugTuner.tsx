// 라이브 셰이더 튜너 패널(dev 전용) — 떠다니는 슬라이더 묶음. 각 슬라이더가 TUNE uniform의 `.value`를
// 갱신하면 별/나 셰이더가 다음 프레임에 즉시 반영한다(rebuild·하드새로고침 불필요). 좋은 값을 찾으면 "값 복사"로
// JSON을 받아 셰이더 상수에 다시 굽고 이 패널·tuner 모듈을 지운다(스캐폴딩). HomePage가 import.meta.env.DEV에서만 마운트.
import { useState } from 'react'
import { TUNE_KNOBS, getTune, setTune, resetTune, tuneSnapshot, type TuneKnob } from '@/shared/lib/r3f'

// group → knobs (선언 순서 보존).
function grouped(): { group: string; knobs: TuneKnob[] }[] {
  const out: { group: string; knobs: TuneKnob[] }[] = []
  for (const k of TUNE_KNOBS) {
    let g = out.find((o) => o.group === k.group)
    if (!g) {
      g = { group: k.group, knobs: [] }
      out.push(g)
    }
    g.knobs.push(k)
  }
  return out
}

export function DebugTuner() {
  const [open, setOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  // 슬라이더 표시값은 tuner의 getTune이 단일 출처 — 강제 리렌더만 트리거한다.
  const [, force] = useState(0)
  const rerender = () => force((n) => n + 1)
  const groups = grouped()

  const copyValues = () => {
    const json = JSON.stringify(tuneSnapshot(), null, 2)
    void navigator.clipboard?.writeText(json).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      },
      () => {},
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 9999,
        width: open ? 280 : 'auto',
        maxHeight: '80vh',
        overflowY: 'auto',
        background: 'rgba(10,12,20,0.86)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 10,
        backdropFilter: 'blur(8px)',
        color: 'rgba(255,255,255,0.9)',
        font: '11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
        padding: open ? '10px 12px' : '6px 10px',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700, padding: 0 }}
        >
          {open ? '▾' : '▸'} 셰이더 튜너
        </button>
        {open && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={copyValues} style={btn}>
              {copied ? '복사됨' : '값 복사'}
            </button>
            <button
              type="button"
              onClick={() => {
                resetTune()
                rerender()
              }}
              style={btn}
            >
              리셋
            </button>
          </div>
        )}
      </div>

      {open &&
        groups.map((g) => (
          <div key={g.group} style={{ marginTop: 10 }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: 0.4, marginBottom: 4 }}>
              {g.group}
            </div>
            {g.knobs.map((k) => {
              const v = getTune(k.key)
              return (
                <label key={k.key} style={{ display: 'block', marginBottom: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{k.label}</span>
                    <span style={{ color: 'rgba(140,200,255,0.95)' }}>{v.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={k.min}
                    max={k.max}
                    step={k.step}
                    value={v}
                    onChange={(e) => {
                      setTune(k.key, Number(e.target.value))
                      rerender()
                    }}
                    style={{ width: '100%', accentColor: '#6aa6ff', marginTop: 2 }}
                  />
                </label>
              )
            })}
          </div>
        ))}
    </div>
  )
}

const btn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 6,
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 10,
  padding: '2px 7px',
}
