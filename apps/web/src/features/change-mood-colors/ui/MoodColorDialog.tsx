import { useMemo, useState, type CSSProperties } from 'react'

import { useTransport } from '@connectrpc/connect-query'
import { useQuery } from '@tanstack/react-query'

import {
  clampChromaToGamut,
  draftFromColor,
  draftFromOkLch,
  moodColorPresets,
  moodColorRisks,
  okLchToColor,
  randomMoodColor,
  type Color,
  type Mood,
  type MoodColorPreset,
  type MoodColorRisk,
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
import { MoodColorPicker } from './MoodColorPicker.tsx'

export interface MoodColorDialogProps {
  mood: Mood
  /** The colour this feeling wears now — what the dialog opens on and what Cancel returns to. */
  current: Color
  saving: boolean
  onClose: () => void
  onSave: (color: Color) => void
}

/**
 * Editing one feeling's colour. `Dialog` renders as a centred modal on a wide screen and a bottom
 * sheet on a narrow one. Nothing writes until Save, so a colour can be tried against the one it
 * would replace and abandoned without the sky behind moving.
 */
export function MoodColorDialog({ mood, current, saving, onClose, onSave }: MoodColorDialogProps) {
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

  const risks = useMemo(() => moodColorRisks(mood, draft.color), [mood, draft.color])

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
          {risks.length > 0 ? <RiskNotice risks={risks} titled /> : null}
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

function RiskNotice({ risks, titled }: { risks: readonly MoodColorRisk[]; titled?: boolean }) {
  return (
    <Alert variant="warning" live="status">
      {titled ? <h3 className="font-medium">{m.palette_risk_label()}</h3> : null}
      <ul className="flex flex-col gap-1">
        {risks.map((risk) => (
          <li key={risk}>{moodColorRiskText(risk)}</li>
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
        style={preset.kind === 'RANDOM' ? RANDOM_SWATCH : { backgroundColor: preset.color }}
      />
      <span className="font-medium text-text">{moodColorPresetTitle(preset)}</span>
      {detail ? <span>{detail}</span> : null}
    </button>
  )
}

// Random has no colour to show, so it shows all of them. Drawn through the same OkLCH seam every
// emotion colour goes through, so the wheel holds colours a feeling could actually get.
const RANDOM_SWATCH: CSSProperties = {
  backgroundImage: `conic-gradient(${Array.from({ length: 13 }, (_, index) =>
    okLchToColor(clampChromaToGamut({ l: 0.72, c: 0.2, h: (index * 360) / 12 })),
  ).join(', ')})`,
}
