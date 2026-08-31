export interface ProviderStatus { configured: boolean }
export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface ChatRequest { model: string; messages: ChatMessage[] }
export interface ChatResponse { content: string; promptTokens?: number; completionTokens?: number; totalTokens?: number }

export interface ChatProvider {
  id: string;
  getStatus(): Promise<ProviderStatus>;
  saveCredential(value: string): Promise<ProviderStatus>;
  deleteCredential(): Promise<ProviderStatus>;
  test(model: string): Promise<ChatResponse>;
  complete(request: ChatRequest): Promise<ChatResponse>;
}
