import {render} from '@testing-library/react-native';

import {defaultLocale, m, setActiveLocale} from '@cosimosi/i18n';
import {useUniverseClockStore} from '@cosimosi/universe';

import {UniverseTimeHud} from './UniverseTimeHud.tsx';

// The RN counterpart of the web UniverseTimeHud test — the same [T6] contract on the fork: the
// universe time is always shown; an unborn clock shows the empty-universe line, never a date.
describe('UniverseTimeHud (mobile)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale);
    useUniverseClockStore.getState().clear();
  });

  it('shows the current universe time (= the last diary date)', () => {
    useUniverseClockStore.getState().setCurrent('2026-07-08');
    const view = render(<UniverseTimeHud />);
    expect(view.getByText(m.universe_time_hud_label())).toBeTruthy();
    expect(view.getByText('2026-07-08')).toBeTruthy();
  });

  it('shows the empty-universe affordance, not a date, while the clock is unborn', () => {
    const view = render(<UniverseTimeHud />);
    expect(view.getByText(m.universe_time_hud_empty())).toBeTruthy();
    expect(view.queryByText(/\d{4}-\d{2}-\d{2}/)).toBeNull();
  });

  it('prefers the acceleration override over the store value while a sweep runs', () => {
    useUniverseClockStore.getState().setCurrent('2026-07-08');
    const view = render(<UniverseTimeHud overrideTime="2026-07-03" />);
    expect(view.getByText('2026-07-03')).toBeTruthy();
    expect(view.queryByText('2026-07-08')).toBeNull();
  });
});
