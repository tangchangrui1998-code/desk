import { getCurrentWindow } from '@tauri-apps/api/window';

export function isTauriRuntime() {
  return '__TAURI_INTERNALS__' in window;
}

export function currentAppWindow() {
  return getCurrentWindow();
}

export async function minimizeWindow() {
  if (!isTauriRuntime()) return;
  try {
    await currentAppWindow().minimize();
  } catch (error) {
    console.error('[window] Failed to minimize.', error);
  }
}

export async function closeWindow() {
  if (!isTauriRuntime()) return;
  try {
    await currentAppWindow().close();
  } catch (error) {
    console.error('[window] Failed to close.', error);
  }
}

export async function startWindowDragging() {
  if (!isTauriRuntime()) return;
  try {
    await currentAppWindow().startDragging();
  } catch (error) {
    console.error('[window] Failed to start dragging.', error);
  }
}

