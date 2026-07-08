import {fireEvent, render} from '@testing-library/react-native';

import {defaultLocale, m, setActiveLocale} from '@cosimosi/i18n';

import {ConfirmTimeSyncDialog} from './ConfirmTimeSyncDialog.tsx';

// The live half of the [R1a] consent contract (the web side pins the copy + the promise contract
// without a DOM): the open modal states the consequence, 예 resolves proceed, 아니오 resolves
// cancel, dismissing equals 아니오 — and none of it touches the backend.
describe('ConfirmTimeSyncDialog (mobile)', () => {
  beforeEach(() => {
    setActiveLocale(defaultLocale);
  });

  it('states the consequence and returns both decisions without a transport call', () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const onAccept = jest.fn();
    const onReject = jest.fn();
    const view = render(<ConfirmTimeSyncDialog open onAccept={onAccept} onReject={onReject} />);

    expect(view.getByText(m.universe_time_sync_consent_body())).toBeTruthy();

    fireEvent.press(view.getByText(m.universe_time_sync_accept()));
    expect(onAccept).toHaveBeenCalledTimes(1);

    fireEvent.press(view.getByText(m.universe_time_sync_reject()));
    expect(onReject).toHaveBeenCalledTimes(1);

    // Dismissing (✕) is the same 아니오 — the clock never moves on an ambiguous exit.
    fireEvent.press(view.getByLabelText(m.common_dismiss()));
    expect(onReject).toHaveBeenCalledTimes(2);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('renders nothing while closed', () => {
    const view = render(<ConfirmTimeSyncDialog open={false} onAccept={jest.fn()} onReject={jest.fn()} />);
    expect(view.queryByText(m.universe_time_sync_consent_body())).toBeNull();
  });
});
