import {StyleSheet, Text, View} from 'react-native';

import {tokens} from '@cosimosi/ui';

import {useUniverseClockStore} from '../../../entities/universe-clock/index.ts';
import {m} from '../../../shared/i18n/index.ts';

export interface UniverseTimeHudProps {
  /** While the acceleration plays, the widget hands in the sweeping date; the store value resumes after. */
  overrideTime?: string | null;
}

// The persistent "우주의 시간" HUD ([T6]) — the RN fork of the web pill (§3.5, primitive differs:
// RN View/Text vs DOM). The last diary date, or the empty-universe line while the clock is unborn.
// A label and a value only — no control sits here ([I10][I11]).
export function UniverseTimeHud({overrideTime = null}: UniverseTimeHudProps) {
  const currentUniverseTime = useUniverseClockStore(state => state.currentUniverseTime);
  const shown = overrideTime ?? currentUniverseTime;
  return (
    <View style={styles.root} pointerEvents="none">
      <Text style={styles.label}>{m.universe_time_hud_label()}</Text>
      {shown ? (
        <Text style={styles.value}>{shown}</Text>
      ) : (
        <Text style={styles.empty}>{m.universe_time_hud_empty()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  label: {color: tokens.color['text-muted'], fontSize: 12},
  value: {color: tokens.color.text, fontSize: 14, fontVariant: ['tabular-nums']},
  empty: {color: tokens.color['text-subtle'], fontSize: 13},
});
