import type { ChatProvider, ChatRequest, ChatResponse, ProviderStatus } from '../../core/dialogue/providers';
import { desktopInvoke } from './runtime';

export const deepSeekProvider: ChatProvider = {
  id: 'deepseek',
  getStatus: () => desktopInvoke<ProviderStatus>('get_deepseek_status'),
  saveCredential: (apiKey) => desktopInvoke<ProviderStatus>('save_deepseek_api_key', { apiKey: apiKey.trim() }),
  deleteCredential: () => desktopInvoke<ProviderStatus>('delete_deepseek_api_key'),
  test: (model) => desktopInvoke<ChatResponse>('test_deepseek_connection', { model: model.trim() }),
  complete: ({ model, messages }: ChatRequest) => desktopInvoke<ChatResponse>('chat_with_deepseek', { model, messages }),
};
