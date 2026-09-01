import { invoke } from '@tauri-apps/api/core';

export function isDesktopRuntime() {
  return '__TAURI_INTERNALS__' in window;
}

export async function desktopInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isDesktopRuntime()) throw new Error('AI 凭据和联网对话只能在桌面应用中使用。');
  return invoke<T>(command, args);
}

export function readableProviderError(error: unknown) {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return '对话请求失败，请稍后再试。';
}
