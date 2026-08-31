import { useEffect, useState } from 'react';
import { BackendShell } from '../features/backend/BackendShell';
import { DesktopPet } from '../features/pet-shell/DesktopPet';
import { useAppState } from '../core/persistence/store';
import { windowController } from '../platform/window/controller';
import type { PetScale } from '../platform/window/layout';
import { AppProviders } from './providers';
import type { AppMode } from './routes';

export function App() {
  return <AppProviders><AppContent /></AppProviders>;
}

function AppContent() {
  const { state, setAlwaysOnTop } = useAppState();
  const [mode, setMode] = useState<AppMode>(() => windowController.getMode());
  const [scale, setScale] = useState<PetScale>(() => windowController.getPetScale());

  useEffect(() => {
    void windowController.initialize().then((initialized) => {
      if (initialized) void windowController.setAlwaysOnTop(state.settings.alwaysOnTop);
    });
    return () => windowController.dispose();
  }, []);

  const changeMode = async (nextMode: AppMode) => {
    if (await windowController.setMode(nextMode)) setMode(nextMode);
  };

  const changeScale = async (nextScale: PetScale) => {
    if (await windowController.setPetScale(nextScale)) setScale(nextScale);
  };

  const changeAlwaysOnTop = async (enabled: boolean) => {
    if (await windowController.setAlwaysOnTop(enabled)) setAlwaysOnTop(enabled);
  };

  useEffect(() => {
    windowController.setBackendDismissHandler(() => void changeMode('pet'));
    return () => windowController.setBackendDismissHandler(null);
  }, []);

  const petMode = mode === 'chat' ? 'chat' : 'pet';

  return (
    <>
      <div
        className={`app-mode-layer ${mode === 'backend' ? 'is-hidden' : ''}`}
        aria-hidden={mode === 'backend'}
      >
        <DesktopPet
          mode={petMode}
          scale={scale}
          onModeChange={(nextMode) => void changeMode(nextMode)}
          onScaleChange={(nextScale) => void changeScale(nextScale)}
        />
      </div>
      {mode === 'backend' && (
      <BackendShell
        alwaysOnTop={state.settings.alwaysOnTop}
        onAlwaysOnTopChange={(enabled) => void changeAlwaysOnTop(enabled)}
        onReturnToDesktop={() => void changeMode('pet')}
      />
      )}
    </>
  );
}
