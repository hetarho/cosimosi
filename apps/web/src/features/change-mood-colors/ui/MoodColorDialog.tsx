import { useMemo, useState, type CSSProperties } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import {
  draftFromColor,
  draftFromOkLch,
  moodColorPresets,
  moodColorRisks,
  randomMoodColor,
  type Color,
  type Mood,
  type MoodColorConcern,
  type MoodColorPreset,
} from '@cosimosi/emotion'
import { moodColorPresetsQueryKey, readMoodColorPresets } from '@cosimosi/emotion/react'
import { Alert, Button, Dialog } from '@cosimosi/ui'

import {
  m,
  moodColorPresetDetail,
  moodColorPresetTitle,
  moodColorRiskText,
  moodLabel,
} from '../../../shared/i18n/index.ts'
import { RANDOM_MOOD_COLOR_SWATCH } from '../../../entities/mood-color/index.ts'
import { MoodColorPicker } from './MoodColorPicker.tsx'

export interface MoodColorDialogProps {
  mood: Mood
  /** The colour this feeling wears now — what the dialog opens on and what Cancel returns to. */
  current: Color
  /** What the other twelve feelings wear, so "too close to another feeling" can be said WHILE choosing
   *  rather than reported after the save. Keyed by mood; the edited one is ignored if present. */
  otherColors: Readonly<Partial<Record<Mood, Color>>>
  saving: boolean
  saveFailed: boolean
  onClose: () => void
  onSave: (color: Color) => void
}

/**
 * Editing one feeling's colour. `Dialog` renders as a centred modal on a wide screen and a bottom
 * sheet on a narrow one. Nothing writes until Save, so a colour can be tried against the one it
 * would replace and abandoned without the sky behind moving.
 */
export function MoodColorDialog({
  mood,
  current,
  otherColors,
  saving,
  saveFailed,
  onClose,
  onSave,
}: MoodColorDialogProps) {
  const transport = useTransport()
  const presetQuery = useQuery({
    queryKey: moodColorPresetsQueryKey(mood),
    queryFn: () => readMoodColorPresets(transport, mood),
    staleTime: Number.POSITIVE_INFINITY,
  })
  // The authored and random offers hold without the aggregate, so they render while it loads and
  // remain the whole row if the read fails.
  const presets = presetQuery.data ?? moodColorPresets(mood, [])

  // Seeded once; the host mounts this per feeling, so opening is what re-reads `current`. A failed
  // save must not snap the draft back to the rolled-back colour, since Save is what gets pressed next.
  const [draft, setDraft] = useState(() => draftFromColor(current))
  const [confirming, setConfirming] = useState(false)

  const risks = useMemo(
    () => moodColorRisks(mood, draft.color, otherColors),
    [mood, draft.color, otherColors],
  )

  const commit = () => {
    if (risks.length > 0 && !confirming) {
      setConfirming(true)
      return
    }
    onSave(draft.color)
  }

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={m.palette_dialog_title({ mood: moodLabel(mood) })}
        description={m.palette_dialog_body()}
        closeLabel={m.common_dismiss()}
      >
        <div className="flex flex-col gap-5">
          <ColorPreview current={current} chosen={draft.color} />
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => (
              <PresetButton
                key={preset.kind === 'POPULAR' ? preset.color : preset.kind}
                preset={preset}
                selected={preset.kind !== 'RANDOM' && preset.color === draft.color}
                disabled={saving}
                onChoose={(color) => setDraft(draftFromColor(color))}
                onRandom={() => setDraft(draftFromColor(randomMoodColor(mood)))}
              />
            ))}
          </div>
          <MoodColorPicker
            value={draft.lch}
            disabled={saving}
            onChange={(lch) => setDraft(draftFromOkLch(lch))}
          />
          {/* Live rather than on save, so the notice tracks the colour under the cursor. */}
          {risks.length > 0 ? <RiskNotice risks={risks} /> : null}
          {saveFailed ? <Alert variant="danger">{m.palette_save_failed()}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button color="neutral" variant="text" onClick={onClose} disabled={saving}>
              {m.common_cancel()}
            </Button>
            <Button onClick={commit} loading={saving}>
              {m.palette_save()}
            </Button>
          </div>
        </div>
      </Dialog>
      {/* Only opens when there is a risk to state; a clean colour saves on the first press. */}
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={m.palette_confirm_title()}
        description={m.palette_confirm_body({ mood: moodLabel(mood) })}
        closeLabel={m.common_dismiss()}
      >
        <div className="flex flex-col gap-4">
          <RiskNotice risks={risks} />
          <div className="flex justify-end gap-2">
            <Button color="neutral" variant="text" onClick={() => setConfirming(false)}>
              {m.common_cancel()}
            </Button>
            <Button
              loading={saving}
              onClick={() => {
                setConfirming(false)
                onSave(draft.color)
              }}
            >
              {m.palette_confirm_keep()}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}

// The sentences alone, with no heading over them. A caption naming the notice ("이 색이 감수하는 것")
// said nothing the sentences do not already say, in a voice nobody speaks — and a warning box is
// already legible as a warning without being announced.
function RiskNotice({ risks }: { risks: readonly MoodColorConcern[] }) {
  return (
    <Alert variant="warning" live="status">
      <ul className="flex flex-col gap-1">
        {risks.map((concern) => (
          <li key={concern.risk}>{moodColorRiskText(concern)}</li>
        ))}
      </ul>
    </Alert>
  )
}

/**
 * The colour it has now beside the colour it would have, both wearing a star's glow — glare and
 * dimness are what the warnings below are about, and a flat swatch shows neither.
 */
function ColorPreview({ current, chosen }: { current: Color; chosen: Color }) {
  return (
    <div className="flex items-center justify-center gap-8 rounded-xl bg-bg py-6">
      <PreviewSwatch color={current} label={m.palette_current_label()} />
      <PreviewSwatch color={chosen} label={m.palette_preview_label()} />
    </div>
  )
}

function PreviewSwatch({ color, label }: { color: Color; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span aria-hidden="true" className="size-12 rounded-full" style={glow(color)} />
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  )
}

function glow(color: Color): CSSProperties {
  return { backgroundColor: color, boxShadow: `0 0 1.5rem 0.25rem ${color}` }
}

function PresetButton({
  preset,
  selected,
  disabled,
  onChoose,
  onRandom,
}: {
  preset: MoodColorPreset
  selected: boolean
  disabled: boolean
  onChoose: (color: Color) => void
  onRandom: () => void
}) {
  const detail = moodColorPresetDetail(preset)

  return (
    <button
      type="button"
      aria-label={m.palette_preset_label()}
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => (preset.kind === 'RANDOM' ? onRandom() : onChoose(preset.color))}
      className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-3 text-center text-xs text-text-muted aria-pressed:border-text disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className="size-8 rounded-full border border-border"
        style={
          preset.kind === 'RANDOM' ? RANDOM_MOOD_COLOR_SWATCH : { backgroundColor: preset.color }
        }
      />
      <span className="font-medium text-text">{moodColorPresetTitle(preset)}</span>
      {detail ? <span>{detail}</span> : null}
    </button>
  )
}
