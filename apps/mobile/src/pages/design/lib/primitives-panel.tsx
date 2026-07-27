import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Dialog,
  IconButton,
  Skeleton,
  Switch,
  TextArea,
  TextField,
  Toast,
  Tooltip,
  tokens,
  type BadgeVariant,
  type ButtonColor,
  type ButtonVariant,
  type ControlSize,
} from '@cosimosi/ui'

import { T } from './showcase-copy.ts'
import { Section, Specimen, Stage } from './showcase-shell.tsx'

/**
 * Every primitive sibling, in the states a touch surface can hold.
 *
 * The two axes are shown as a matrix for the same reason the web catalogue does it: a screen should
 * never need a one-off control, and the only way to see that is to see every appearance against
 * every colour at once.
 */

const VARIANTS: readonly ButtonVariant[] = ['contained', 'outlined', 'text']
const COLORS: readonly ButtonColor[] = ['primary', 'secondary', 'tertiary', 'neutral', 'danger']
const SIZES: readonly ControlSize[] = ['sm', 'md', 'lg']
// The variant name is the specimen's own label, so it reads from the list rather than being written
// out five times — and the catalogue cannot fall behind the type.
const BADGES: readonly BadgeVariant[] = ['neutral', 'primary', 'success', 'warning', 'danger']

export function PrimitivesPanel() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const [wifi, setWifi] = useState(true)
  const [remember, setRemember] = useState(false)

  return (
    <Section title={T.primitivesTitle}>
      <Specimen label={T.buttonLabel} note={T.touchStatesNote}>
        <Stage>
          {VARIANTS.map((variant) => (
            <View key={variant} style={styles.matrixRow}>
              <Text style={styles.rowLabel}>{variant}</Text>
              <View style={styles.rowItems}>
                {COLORS.map((color) => (
                  <Button key={color} variant={variant} color={color} size="sm">
                    {color}
                  </Button>
                ))}
              </View>
            </View>
          ))}
          <View style={styles.matrixRow}>
            <Text style={styles.rowLabel}>{T.stateDefault}</Text>
            <View style={styles.rowItems}>
              {SIZES.map((size) => (
                <Button key={size} size={size}>
                  {size}
                </Button>
              ))}
            </View>
          </View>
          <View style={styles.matrixRow}>
            <Text style={styles.rowLabel}>{T.stateDisabled}</Text>
            <View style={styles.rowItems}>
              <Button disabled>{T.stateDisabled}</Button>
              <Button loading>{T.stateLoading}</Button>
              <Button variant="outlined" disabled>
                {T.stateDisabled}
              </Button>
            </View>
          </View>
        </Stage>
      </Specimen>

      <Specimen label={T.iconButtonLabel}>
        <Stage row>
          {COLORS.map((color) => (
            <IconButton
              key={color}
              label={color}
              color={color}
              variant="contained"
              icon={<Text style={styles.glyph}>+</Text>}
            />
          ))}
          <IconButton label={T.stateLoading} loading icon={<Text style={styles.glyph}>+</Text>} />
          <IconButton label={T.stateDisabled} disabled icon={<Text style={styles.glyph}>+</Text>} />
        </Stage>
      </Specimen>

      <Specimen label={T.badgeLabel}>
        <Stage row>
          {BADGES.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </Stage>
      </Specimen>

      {/* All four alert roles together: the rim is the only thing that changes, so no variant can
          end up louder than the copy it carries. */}
      <Specimen label={T.alertLabel}>
        <Stage>
          <Alert variant="danger">{T.alertDanger}</Alert>
          <Alert variant="warning" live="status">
            {T.alertWarning}
          </Alert>
          <Alert variant="info" live="status">
            {T.alertInfo}
          </Alert>
          <Alert variant="success" live="status">
            {T.alertSuccess}
          </Alert>
        </Stage>
      </Specimen>

      <Specimen label={T.fieldLabel}>
        <Stage>
          <TextField
            label={T.fieldEmail}
            placeholder={T.fieldEmailPlaceholder}
            description={T.fieldEmailHint}
          />
          <TextField label={T.fieldEmail} defaultValue="nope" error={T.fieldEmailError} />
          <TextArea label={T.fieldNote} placeholder={T.fieldNotePlaceholder} />
          <TextField label={T.fieldEmail} editable={false} value={T.stateDisabled} />
        </Stage>
      </Specimen>

      <Specimen label={T.toggleLabel}>
        <Stage>
          <Switch label={T.switchLabel} checked={wifi} onCheckedChange={setWifi} />
          <Switch label={T.stateDisabled} checked={false} disabled />
          <Checkbox label={T.checkboxLabel} checked={remember} onCheckedChange={setRemember} />
          <Checkbox label={T.stateDisabled} checked disabled />
        </Stage>
      </Specimen>

      <Specimen label={T.overlayLabel}>
        <Stage row>
          <Button color="neutral" onPress={() => setDialogOpen(true)}>
            {T.dialogTrigger}
          </Button>
          <Button color="neutral" onPress={() => setToastOpen(true)}>
            {T.toastTrigger}
          </Button>
          <Tooltip content={T.tooltipContent}>
            <Button variant="outlined" color="neutral">
              {T.tooltipTrigger}
            </Button>
          </Tooltip>
        </Stage>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title={T.dialogTitle}
          description={T.dialogBody}
          closeLabel={T.dialogClose}
        >
          <View style={styles.dialogActions}>
            <Button variant="text" color="neutral" onPress={() => setDialogOpen(false)}>
              {T.dialogCancel}
            </Button>
            <Button color="danger" onPress={() => setDialogOpen(false)}>
              {T.dialogConfirm}
            </Button>
          </View>
        </Dialog>
        <Toast open={toastOpen} onOpenChange={setToastOpen} variant="success" durationMs={3000}>
          {T.toastBody}
        </Toast>
      </Specimen>

      <Specimen label={T.feedbackLabel}>
        <Stage>
          <View style={styles.skeletonRow}>
            <Skeleton width={40} height={40} rounded="full" />
            <View style={styles.skeletonLines}>
              <Skeleton width="70%" height={14} />
              <Skeleton width="45%" height={12} />
            </View>
          </View>
          <Skeleton width="100%" height={12} />
        </Stage>
      </Specimen>
    </Section>
  )
}

const styles = StyleSheet.create({
  matrixRow: { gap: tokens.spacing[2] },
  rowLabel: {
    color: tokens.color['text-subtle'],
    fontSize: tokens.fontSize.xs,
    textTransform: 'uppercase',
  },
  rowItems: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing[2] },
  glyph: { color: tokens.color.text, fontSize: tokens.fontSize.lg },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.spacing[2],
  },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[3] },
  skeletonLines: { flex: 1, gap: tokens.spacing[2] },
})
