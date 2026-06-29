import {type ReactNode} from 'react';

import {createActorContext} from '../../shared/model/index.ts';
import {appShellMachine} from '../model/app-shell.machine.ts';

/**
 * App-wide XState actors mount here (ARCHITECTURE §3.2). Phase 1 hosts the
 * shell-lifecycle actor; later app-wide actors join the same provider so feature
 * slices select from a single, documented boundary instead of spawning their own
 * long-lived actors. `AppShellActor` exposes the typed Provider + hooks.
 */
export const AppShellActor = createActorContext(appShellMachine);

export function MachineActorsProvider({children}: {children?: ReactNode}) {
  return <AppShellActor.Provider>{children}</AppShellActor.Provider>;
}
