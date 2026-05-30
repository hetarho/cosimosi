import { useEffect, useState } from 'react'
import { MoodScene } from './scene/MoodScene'
import { MoodPicker } from './diary/MoodPicker'
import { api } from './api/client'

export default function App() {
  const [apiStatus, setApiStatus] = useState<'idle' | 'ok' | 'down'>('idle')

  useEffect(() => {
    api
      .health()
      .then(() => setApiStatus('ok'))
      .catch(() => setApiStatus('down'))
  }, [])

  return (
    <div className="relative h-full w-full">
      <MoodScene />

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <header className="flex items-start justify-between p-6">
          <div>
            <h1 className="text-2xl font-light tracking-wide text-white/90">cosimosi</h1>
            <p className="text-sm text-white/50">오늘의 기분을 아트로 기록하기</p>
          </div>
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs backdrop-blur-md ring-1 ring-white/10">
            <span
              className={`h-2 w-2 rounded-full ${
                apiStatus === 'ok'
                  ? 'bg-emerald-400'
                  : apiStatus === 'down'
                    ? 'bg-rose-400'
                    : 'bg-amber-400'
              }`}
            />
            <span className="text-white/70">
              api: {apiStatus === 'idle' ? '확인 중…' : apiStatus}
            </span>
          </div>
        </header>

        <div className="mt-auto flex justify-center p-6">
          <MoodPicker />
        </div>
      </div>
    </div>
  )
}
