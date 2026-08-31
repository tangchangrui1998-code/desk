import { invoke } from '@tauri-apps/api/core';
import type { ChatProvider, ChatRequest, ChatResponse, ProviderStatus } from '../../core/dialogue/providers';

export const deepSeekProvider: ChatProvider = {
  id: 'deepseek',
  getStatus: () => desktopInvoke<ProviderStatus>('get_deepseek_status'),
  saveCredential: (apiKey) => desktopInvoke<ProviderStatus>('save_deepseek_api_key', { apiKey: apiKey.trim() }),
  deleteCredential: () => desktopInvoke<ProviderStatus>('delete_deepseek_api_key'),
  test: (model) => desktopInvoke<ChatResponse>('test_deepseek_connection', { model: model.trim() }),
  complete: ({ model, messages }: ChatRequest) => desktopInvoke<ChatResponse>('chat_with_deepseek', { model, messages }),
};

export function isDesktopRuntime() {
  return '__TAURI_INTERNALS__' in window;
}

async function desktopInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isDesktopRuntime()) throw new Error('AI 凭据和联网对话只能在桌面应用中使用。');
  return invoke<T>(command, args);
}

export function readableProviderError(error: unknown) {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return '对话请求失败，请稍后再试。';
}
