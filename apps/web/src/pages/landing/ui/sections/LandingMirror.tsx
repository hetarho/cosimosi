import { moodColor } from '@cosimosi/emotion'
import { Card } from '@cosimosi/ui'

import { m } from '../../../../shared/i18n/index.ts'
import { ILLUSTRATIVE_MOODS, ILLUSTRATIVE_REVISIT_WEIGHTS } from '../../config/illustration.ts'

// The one definition a new user must not get wrong: the universe's colour is not the average of your
// feelings, it is a mirror of the ones you keep returning to.
//
// It is a required section rather than a paragraph because the cost of the misunderstanding is long: a
// user who believes the sky averages their feelings will read their own universe wrong for months. It is
// also the rare case where the honest sentence is the interesting one.
//
// The two rows beside it are ILLUSTRATION and say so on screen. They are built from invented moods in
// invented proportions — never anyone's data, and never a reading of the visitor's own anything, which
// they could not be anyway: this page has no session and no way to obtain one.
export function LandingMirror() {
  const averaged = ILLUSTRATIVE_MOODS.map((mood) => ({ mood, weight: 1 }))
  const weighted = ILLUSTRATIVE_MOODS.map((mood) => ({
    mood,
    weight: ILLUSTRATIVE_REVISIT_WEIGHTS[mood] ?? 1,
  }))

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-medium text-text">{m.landing_mirror_title()}</h2>
        <p className="text-base leading-7 text-text-muted">{m.landing_mirror_body()}</p>
      </div>
      <Card variant="glass" className="flex flex-col gap-4">
        <SwatchRow label={m.landing_mirror_averaged_label()} slices={averaged} />
        <SwatchRow label={m.landing_mirror_weighted_label()} slices={weighted} />
        <p className="text-xs text-text-subtle">{m.landing_mirror_illustration_note()}</p>
      </Card>
    </section>
  )
}

function SwatchRow({
  label,
  slices,
}: {
  label: string
  slices: readonly { mood: string; weight: number }[]
}) {
  const total = slices.reduce((sum, slice) => sum + slice.weight, 0)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-text-muted">{label}</p>
      {/* aria-hidden: the row carries no information the labelled text above it does not already say,
          and thirteen unnamed colour stops read aloud would be noise. */}
      <div aria-hidden className="flex h-8 w-full overflow-hidden rounded-md">
        {slices.map((slice) => (
          <div
            key={slice.mood}
            style={{
              backgroundColor: moodColor(slice.mood as Parameters<typeof moodColor>[0]),
              flexGrow: slice.weight / total,
            }}
          />
        ))}
      </div>
    </div>
  )
}
