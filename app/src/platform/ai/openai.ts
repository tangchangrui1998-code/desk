import type { ChatProvider, ChatRequest, ChatResponse, ProviderStatus } from '../../core/dialogue/providers';
import { desktopInvoke } from './runtime';

export const openAiProvider: ChatProvider = {
  id: 'openai',
  getStatus: () => desktopInvoke<ProviderStatus>('get_openai_status'),
  saveCredential: (apiKey) => desktopInvoke<ProviderStatus>('save_openai_api_key', { apiKey: apiKey.trim() }),
  deleteCredential: () => desktopInvoke<ProviderStatus>('delete_openai_api_key'),
  test: (model) => desktopInvoke<ChatResponse>('test_openai_connection', { model: model.trim() }),
  complete: ({ model, messages }: ChatRequest) => desktopInvoke<ChatResponse>('chat_with_openai', { model, messages }),
};
