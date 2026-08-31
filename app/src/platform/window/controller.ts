import {
  availableMonitors,
  currentMonitor,
  LogicalPosition,
  LogicalSize,
  PhysicalPosition,
  type Monitor,
} from '@tauri-apps/api/window';
import type { UnlistenFn } from '@tauri-apps/api/event';
import type { AppMode } from '../../app/routes';
import {
  clampPosition,
  FIXED_WINDOW_LAYOUTS,
  getPetWindowMinSize,
  getPetWindowSize,
  normalizePetScale,
  type PetScale,
} from './layout';
import {
  clearPetPosition,
  readPetPosition,
  readPetScale,
  writePetPosition,
  writePetScale,
  type StoredPosition,
} from './persistence';
import { currentAppWindow, isTauriRuntime } from './runtime';

export const DISPLAY_SCALE_CHANGED_EVENT = 'foedesk-display-scale-changed';

class WindowModeController {
  private mode: AppMode = 'pet';
  private scale: PetScale = readPetScale();
  private petPosition: StoredPosition | null = null;
  private unlisteners: UnlistenFn[] = [];
  private scaleChangeTimer: number | null = null;
  private pendingScaleFactor: number | null = null;
  private backendBlurTimer: number | null = null;
  private backendDismissHandler: (() => void) | null = null;
  private initialized = false;
  private lifecycle = 0;

  getMode() {
    return this.mode;
  }

  getPetScale() {
    return this.scale;
  }

  setBackendDismissHandler(handler: (() => void) | null) {
    this.backendDismissHandler = handler;
  }

  async initialize() {
    if (this.initialized) return true;
    this.initialized = true;
    const lifecycle = ++this.lifecycle;
    if (!isTauriRuntime()) return true;

    try {
      const appWindow = currentAppWindow();
      await appWindow.setAlwaysOnTop(true);
      await this.applyPetSize();
      if (!await this.restorePetPosition()) await this.placeAtDesktopCorner();
      if (lifecycle !== this.lifecycle) return false;

      const unlistenMoved = await appWindow.onMoved(({ payload }) => {
        if (this.mode === 'pet') writePetPosition({ x: payload.x, y: payload.y });
        if (this.pendingScaleFactor !== null) this.scheduleScaleReapply();
      });
      if (lifecycle !== this.lifecycle) {
        unlistenMoved();
        return false;
      }
      this.unlisteners.push(unlistenMoved);

      const unlistenScaleChanged = await appWindow.onScaleChanged(({ payload }) => {
        this.pendingScaleFactor = payload.scaleFactor;
        this.scheduleScaleReapply();
      });
      if (lifecycle !== this.lifecycle) {
        unlistenScaleChanged();
        return false;
      }
      this.unlisteners.push(unlistenScaleChanged);

      const unlistenFocusChanged = await appWindow.onFocusChanged(({ payload: focused }) => {
        if (focused) {
          this.clearBackendBlurTimer();
          return;
        }
        if (this.mode !== 'backend') return;
        this.clearBackendBlurTimer();
        this.backendBlurTimer = window.setTimeout(() => {
          this.backendBlurTimer = null;
          if (this.mode === 'backend') this.backendDismissHandler?.();
        }, 120);
      });
      if (lifecycle !== this.lifecycle) {
        unlistenFocusChanged();
        return false;
      }
      this.unlisteners.push(unlistenFocusChanged);
      return true;
    } catch (error) {
      if (lifecycle === this.lifecycle) this.initialized = false;
      console.error('[window] Failed to initialize the desktop companion window.', error);
      return false;
    }
  }

  async setMode(nextMode: AppMode) {
    if (nextMode === this.mode) return true;
    const previousMode = this.mode;
    if (!isTauriRuntime()) {
      this.mode = nextMode;
      return true;
    }

    try {
      const appWindow = currentAppWindow();
      if (previousMode === 'pet') {
        const position = await appWindow.outerPosition();
        this.petPosition = { x: position.x, y: position.y };
        writePetPosition(this.petPosition);
      }

      if (nextMode !== 'pet') this.mode = nextMode;

      if (nextMode === 'pet') {
        await this.applyPetSize();
        if (this.petPosition) {
          await appWindow.setPosition(new PhysicalPosition(this.petPosition.x, this.petPosition.y));
        } else if (!await this.restorePetPosition()) {
          await this.placeAtDesktopCorner();
        }
        this.petPosition = null;
        const position = await appWindow.outerPosition();
        writePetPosition({ x: position.x, y: position.y });
      } else if (nextMode === 'chat') {
        await this.applyChatLayout();
      } else {
        await this.applyBackendLayout(true);
      }

      this.mode = nextMode;
      return true;
    } catch (error) {
      this.mode = previousMode;
      console.error(`[window] Failed to change mode from ${previousMode} to ${nextMode}.`, error);
      return false;
    }
  }

  async setPetScale(value: number) {
    const nextScale = normalizePetScale(value);
    if (nextScale === this.scale) return true;
    const previousScale = this.scale;
    this.scale = nextScale;
    writePetScale(nextScale);
    if (!isTauriRuntime() || this.mode !== 'pet') return true;

    try {
      const appWindow = currentAppWindow();
      const originalPosition = await appWindow.outerPosition();
      const monitor = await currentMonitor();
      const scaleFactor = monitor?.scaleFactor ?? await appWindow.scaleFactor();
      const logicalPosition = originalPosition.toLogical(scaleFactor);
      const previousSize = getPetWindowSize(previousScale);
      const nextSize = getPetWindowSize(nextScale);
      const desired = {
        x: logicalPosition.x - (nextSize.width - previousSize.width),
        y: logicalPosition.y - (nextSize.height - previousSize.height),
      };
      const position = monitor
        ? clampPosition(desired, nextSize, logicalWorkArea(monitor, scaleFactor))
        : { x: Math.round(desired.x), y: Math.round(desired.y) };

      await this.applyPetSize();
      await appWindow.setPosition(new LogicalPosition(position.x, position.y));
      const physicalPosition = await appWindow.outerPosition();
      writePetPosition({ x: physicalPosition.x, y: physicalPosition.y });
      return true;
    } catch (error) {
      this.scale = previousScale;
      writePetScale(previousScale);
      console.error('[window] Failed to resize the companion window.', error);
      return false;
    }
  }

  async setAlwaysOnTop(enabled: boolean) {
    if (!isTauriRuntime()) return true;
    try {
      await currentAppWindow().setAlwaysOnTop(enabled);
      return true;
    } catch (error) {
      console.error('[window] Failed to update always-on-top.', error);
      return false;
    }
  }

  dispose() {
    this.lifecycle += 1;
    for (const unlisten of this.unlisteners.splice(0)) unlisten();
    if (this.scaleChangeTimer !== null) window.clearTimeout(this.scaleChangeTimer);
    this.clearBackendBlurTimer();
    this.scaleChangeTimer = null;
    this.pendingScaleFactor = null;
    this.initialized = false;
  }

  private scheduleScaleReapply() {
    if (this.scaleChangeTimer !== null) window.clearTimeout(this.scaleChangeTimer);
    this.scaleChangeTimer = window.setTimeout(() => {
      this.scaleChangeTimer = null;
      const scaleFactor = this.pendingScaleFactor;
      this.pendingScaleFactor = null;
      if (scaleFactor !== null) void this.reapplyLayout(scaleFactor);
    }, 260);
  }

  private async applyPetSize() {
    const appWindow = currentAppWindow();
    const size = getPetWindowSize(this.scale);
    const minSize = getPetWindowMinSize(this.scale);
    await appWindow.setMinSize(null);
    await appWindow.setMaxSize(null);
    await appWindow.setSize(new LogicalSize(size.width, size.height));
    await appWindow.setMinSize(new LogicalSize(minSize.width, minSize.height));
  }

  private async applyChatLayout() {
    const appWindow = currentAppWindow();
    const { size } = FIXED_WINDOW_LAYOUTS.chat;
    const originalPosition = await appWindow.outerPosition();
    const monitor = await currentMonitor();
    const scaleFactor = monitor?.scaleFactor ?? await appWindow.scaleFactor();
    const current = originalPosition.toLogical(scaleFactor);
    const petSize = getPetWindowSize(this.scale);
    const desired = {
      x: current.x - (size.width - petSize.width),
      y: current.y - (size.height - petSize.height),
    };
    const position = monitor
      ? clampPosition(desired, size, logicalWorkArea(monitor, scaleFactor))
      : { x: Math.round(desired.x), y: Math.round(desired.y) };

    await appWindow.setMinSize(null);
    await appWindow.setMaxSize(null);
    await appWindow.setSize(new LogicalSize(size.width, size.height));
    await appWindow.setPosition(new LogicalPosition(position.x, position.y));
  }

  private async applyBackendLayout(centerOnMonitor: boolean) {
    const appWindow = currentAppWindow();
    const { size } = FIXED_WINDOW_LAYOUTS.backend;
    const monitor = await currentMonitor();
    await appWindow.setMinSize(null);
    await appWindow.setMaxSize(null);
    await appWindow.setSize(new LogicalSize(size.width, size.height));

    if (monitor) {
      const currentPosition = await appWindow.outerPosition();
      const actualSize = await appWindow.outerSize();
      const workArea = monitor.workArea;
      const desired = centerOnMonitor
        ? {
            x: workArea.position.x + (workArea.size.width - actualSize.width) / 2,
            y: workArea.position.y + (workArea.size.height - actualSize.height) / 2,
          }
        : currentPosition;
      const position = clampPosition(desired, actualSize, {
        x: workArea.position.x,
        y: workArea.position.y,
        width: workArea.size.width,
        height: workArea.size.height,
      });
      await appWindow.setPosition(new PhysicalPosition(position.x, position.y));
    }

    const fixedSize = new LogicalSize(size.width, size.height);
    await appWindow.setMinSize(fixedSize);
    await appWindow.setMaxSize(fixedSize);
  }

  private async placeAtDesktopCorner() {
    const appWindow = currentAppWindow();
    const monitor = await currentMonitor();
    if (!monitor) return;
    const workArea = logicalWorkArea(monitor, monitor.scaleFactor);
    const size = getPetWindowSize(this.scale);
    await appWindow.setPosition(new LogicalPosition(
      Math.round(workArea.x + workArea.width - size.width - 24),
      Math.round(workArea.y + workArea.height - size.height - 20),
    ));
  }

  private async restorePetPosition() {
    const saved = readPetPosition();
    if (!saved) return false;
    const monitors = await availableMonitors();
    const monitor = monitors.find(({ workArea }) => saved.x >= workArea.position.x
      && saved.x < workArea.position.x + workArea.size.width
      && saved.y >= workArea.position.y
      && saved.y < workArea.position.y + workArea.size.height);
    if (!monitor) {
      clearPetPosition();
      return false;
    }

    const size = getPetWindowSize(this.scale);
    const physicalSize = {
      width: Math.round(size.width * monitor.scaleFactor),
      height: Math.round(size.height * monitor.scaleFactor),
    };
    const position = clampPosition(saved, physicalSize, {
      x: monitor.workArea.position.x,
      y: monitor.workArea.position.y,
      width: monitor.workArea.size.width,
      height: monitor.workArea.size.height,
    });
    await currentAppWindow().setPosition(new PhysicalPosition(position.x, position.y));
    return true;
  }

  private async reapplyLayout(scaleFactor: number) {
    try {
      if (this.mode === 'pet') await this.applyPetSize();
      if (this.mode === 'chat') {
        const { size } = FIXED_WINDOW_LAYOUTS.chat;
        const appWindow = currentAppWindow();
        await appWindow.setMinSize(null);
        await appWindow.setMaxSize(null);
        await appWindow.setSize(new LogicalSize(size.width, size.height));
      }
      if (this.mode === 'backend') await this.applyBackendLayout(false);
      window.dispatchEvent(new CustomEvent(DISPLAY_SCALE_CHANGED_EVENT, { detail: { scaleFactor } }));
    } catch (error) {
      console.error('[window] Failed to reapply the layout after a display scale change.', error);
    }
  }

  private clearBackendBlurTimer() {
    if (this.backendBlurTimer !== null) window.clearTimeout(this.backendBlurTimer);
    this.backendBlurTimer = null;
  }
}

function logicalWorkArea(monitor: Monitor, scaleFactor: number) {
  const position = monitor.workArea.position.toLogical(scaleFactor);
  const size = monitor.workArea.size.toLogical(scaleFactor);
  return { x: position.x, y: position.y, width: size.width, height: size.height };
}

export const windowController = new WindowModeController();
