import type { PropsWithChildren } from 'react';
import { AppStateProvider } from '../core/persistence/store';

export function AppProviders({ children }: PropsWithChildren) {
  return <AppStateProvider>{children}</AppStateProvider>;
}
