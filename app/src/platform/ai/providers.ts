import type { AiProviderId } from '../../core/companions/types';
import type { ChatProvider } from '../../core/dialogue/providers';
import { deepSeekProvider } from './deepseek';
import { openAiProvider } from './openai';

export type RemoteAiProviderId = Exclude<AiProviderId, 'local'>;

export const remoteAiProviders: Record<RemoteAiProviderId, ChatProvider> = {
  deepseek: deepSeekProvider,
  openai: openAiProvider,
};
