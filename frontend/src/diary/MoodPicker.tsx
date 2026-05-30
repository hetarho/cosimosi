import { type Mood, palettes, useMoodStore } from '../store/mood'

const moods: Mood[] = ['calm', 'joy', 'storm', 'melancholy', 'wonder']

const labels: Record<Mood, string> = {
  calm: '평온',
  joy: '기쁨',
  storm: '폭풍',
  melancholy: '쓸쓸함',
  wonder: '경이',
}

export function MoodPicker() {
  const mood = useMoodStore((s) => s.mood)
  const setMood = useMoodStore((s) => s.setMood)

  return (
    <div className="pointer-events-auto flex gap-2 rounded-full bg-black/40 px-3 py-2 backdrop-blur-md ring-1 ring-white/10">
      {moods.map((m) => {
        const p = palettes[m]
        const active = m === mood
        return (
          <button
            key={m}
            onClick={() => setMood(m)}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
              active ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: p.primary, boxShadow: `0 0 8px ${p.primary}` }}
            />
            {labels[m]}
          </button>
        )
      })}
    </div>
  )
}
