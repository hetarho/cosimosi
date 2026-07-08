import {act, fireEvent, render} from '@testing-library/react-native';

import {defaultLocale, m, setActiveLocale} from '@cosimosi/i18n';
import {useUniverseClockStore} from '@cosimosi/universe';

import {useLaunchedNeuronsStore} from '../../../features/launch-stars/index.ts';
import {useAdvanceAnnouncementStore} from '../../../features/accelerate-time/index.ts';
import {requestTimeSyncConsent, useTimeSyncConsentStore} from '../../../features/confirm-time-sync/index.ts';
import {UniverseTimeOverlay} from './UniverseTimeOverlay.tsx';

// Overlay sequencing over the real machine + stores. requestAnimationFrame is captured (not run by
// the RN polyfill's chained 0-delay timeouts), so a sweep is driven to completion synchronously by
// invoking the queued callback with synthetic timestamps — deterministic, no wall-clock wait.
type RafCallback = (time: number) => void;

describe('UniverseTimeOverlay (mobile)', () => {
  let rafQueue: RafCallback[];

  beforeEach(() => {
    setActiveLocale(defaultLocale);
    useUniverseClockStore.getState().clear();
    useLaunchedNeuronsStore.getState().announce([]);
    useAdvanceAnnouncementStore.getState().take();
    useTimeSyncConsentStore.getState().settle('cancel');
    rafQueue = [];
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: RafCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Drive the captured sweep: frame 0 latches the start, a frame past the cap completes it.
  function runSweep() {
    act(() => {
      rafQueue.shift()?.(0);
    });
    act(() => {
      rafQueue.shift()?.(10_000);
    });
  }

  it('plays the acceleration, then reveals — the awaken announce lands after the transition', () => {
    render(<UniverseTimeOverlay />);
    act(() => {
      useAdvanceAnnouncementStore.getState().announce({
        interval: {previous: '2026-07-07', current: '2026-07-08'},
        revealNeuronIds: ['n1'],
      });
    });

    // Accelerating: the seam is consumed but the reveal has not landed yet.
    expect(useAdvanceAnnouncementStore.getState().pending).toBeNull();
    expect(useLaunchedNeuronsStore.getState().newNeuronIds).toEqual([]);

    runSweep();

    expect(useLaunchedNeuronsStore.getState().newNeuronIds).toEqual(['n1']);
    expect(useUniverseClockStore.getState().currentUniverseTime).toBe('2026-07-08');
  });

  it('never accelerates an empty interval — the reveal releases immediately', () => {
    render(<UniverseTimeOverlay />);
    act(() => {
      useAdvanceAnnouncementStore.getState().announce({
        interval: {previous: '2026-07-08', current: '2026-07-08'},
        revealNeuronIds: ['n2'],
      });
    });
    expect(useLaunchedNeuronsStore.getState().newNeuronIds).toEqual(['n2']);
  });

  it('loses nothing when the overlay unmounts mid-sweep — the interrupted reveal still releases', () => {
    const view = render(<UniverseTimeOverlay />);
    act(() => {
      useAdvanceAnnouncementStore.getState().announce({
        interval: {previous: '2026-07-07', current: '2026-07-08'},
        revealNeuronIds: ['n3'],
      });
    });
    // Unmount before any sweep frame runs.
    act(() => {
      view.unmount();
    });
    expect(useLaunchedNeuronsStore.getState().newNeuronIds).toEqual(['n3']);
    expect(useUniverseClockStore.getState().currentUniverseTime).toBe('2026-07-08');
  });

  it('opens the consent modal on request; 아니오 cancels with the clock unmoved', async () => {
    const view = render(<UniverseTimeOverlay />);
    let decision: Promise<'proceed' | 'cancel'> | null = null;
    act(() => {
      decision = requestTimeSyncConsent();
    });

    const reject = await view.findByText(m.universe_time_sync_reject());
    fireEvent.press(reject);

    await expect(decision).resolves.toBe('cancel');
    expect(useUniverseClockStore.getState().currentUniverseTime).toBeNull();
    expect(view.queryByText(m.universe_time_sync_consent_body())).toBeNull();
  });

  it('resolves 예 → proceed and closes, leaving the acceleration to the committed interval', async () => {
    const view = render(<UniverseTimeOverlay />);
    let decision: Promise<'proceed' | 'cancel'> | null = null;
    act(() => {
      decision = requestTimeSyncConsent();
    });

    const accept = await view.findByText(m.universe_time_sync_accept());
    fireEvent.press(accept);

    await expect(decision).resolves.toBe('proceed');
    // No acceleration yet — it plays only when Epic C announces the committed sync interval.
    expect(useUniverseClockStore.getState().currentUniverseTime).toBeNull();
  });

  it('cancels a pending consent when the overlay unmounts — an awaiting caller never hangs', async () => {
    const view = render(<UniverseTimeOverlay />);
    let decision: Promise<'proceed' | 'cancel'> | null = null;
    act(() => {
      decision = requestTimeSyncConsent();
    });
    act(() => {
      view.unmount();
    });
    await expect(decision).resolves.toBe('cancel');
  });
});
