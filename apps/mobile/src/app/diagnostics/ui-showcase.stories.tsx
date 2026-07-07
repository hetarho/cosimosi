import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
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
  VisuallyHidden,
  tokens,
  useTheme,
} from '@cosimosi/ui';

// Dev surface to eyeball every primitive on React Native. The `.stories.tsx` name
// keeps its demo copy out of the i18n raw-string lint.

function Section({title, children}: {title: string; children: ReactNode}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

export function UiShowcase() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(false);
  const {theme, background, setBackground} = useTheme();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>@cosimosi/ui — native</Text>

      <Section title="Button">
        <Button color="primary">Primary</Button>
        <Button color="secondary">Secondary</Button>
        <Button color="tertiary">Tertiary</Button>
        <Button color="neutral">Neutral</Button>
        <Button variant="text" color="neutral">Ghost</Button>
        <Button color="danger">Danger</Button>
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
      </Section>

      <Section title="IconButton">
        <IconButton label="Add" icon={<Text style={styles.glyph}>+</Text>} color="primary" />
        <IconButton label="Add" icon={<Text style={styles.glyph}>+</Text>} color="secondary" />
        <IconButton label="Add" icon={<Text style={styles.glyph}>+</Text>} color="neutral" />
        <IconButton label="Loading" icon={<Text style={styles.glyph}>+</Text>} loading />
      </Section>

      <Section title="Fields">
        <View style={styles.field}>
          <TextField label="Email" placeholder="you@example.com" description="Work address" />
        </View>
        <View style={styles.field}>
          <TextField label="Email" defaultValue="nope" error="Enter a valid email" />
        </View>
        <View style={styles.field}>
          <TextArea label="Note" placeholder="Write something…" />
        </View>
      </Section>

      <Section title="Toggles">
        <Switch label="Wi-Fi" checked={on} onCheckedChange={setOn} />
        <Checkbox label="Subscribe" checked={checked} onCheckedChange={setChecked} />
      </Section>

      <Section title="Overlays">
        <Button onPress={() => setDialogOpen(true)}>Open dialog</Button>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Delete engram?"
          description="This cannot be undone."
          closeLabel="Close">
          <View style={styles.dialogActions}>
            <Button variant="text" color="neutral" onPress={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button color="danger" onPress={() => setDialogOpen(false)}>
              Delete
            </Button>
          </View>
        </Dialog>
        <Tooltip content="Saved to your universe">
          <Button color="neutral">Trigger</Button>
        </Tooltip>
        <Button onPress={() => setToastOpen(true)}>Show toast</Button>
      </Section>

      <Section title="Status">
        <Badge variant="neutral">Neutral</Badge>
        <Badge variant="primary">Primary</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="danger">Danger</Badge>
      </Section>

      <Section title="Skeleton">
        <Skeleton width={200} height={16} />
        <Skeleton width={48} height={48} rounded="full" />
      </Section>

      <Section title="Theme seam (presentation only)">
        <Text style={styles.note}>
          theme: {theme} · background: {background.tone}
        </Text>
        <Button
          color="neutral"
          onPress={() => setBackground({tone: background.tone === 'cosmos' ? 'plain' : 'cosmos'})}>
          Toggle background
        </Button>
      </Section>

      <VisuallyHidden>End of showcase</VisuallyHidden>

      <View style={styles.toast}>
        <Toast open={toastOpen} onOpenChange={setToastOpen} variant="success" durationMs={3000}>
          Engram saved.
        </Toast>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: tokens.color.bg},
  content: {padding: 20, gap: 8},
  heading: {color: tokens.color.text, fontSize: 24, fontWeight: '600'},
  section: {gap: 12, borderBottomWidth: 1, borderBottomColor: tokens.color.border, paddingVertical: 20},
  sectionTitle: {color: tokens.color['text-muted'], fontSize: 12, fontWeight: '600', textTransform: 'uppercase'},
  row: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12},
  field: {width: '100%'},
  glyph: {color: tokens.color['primary-foreground'], fontSize: 18},
  dialogActions: {flexDirection: 'row', justifyContent: 'flex-end', gap: 8},
  note: {color: tokens.color['text-muted'], fontSize: 14},
  toast: {marginTop: 16},
});
