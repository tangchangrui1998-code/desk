import { useEffect, useMemo, useState } from 'react';
import { buildSystemPrompt } from '../../core/dialogue/contextBuilder';
import { selectAppearanceDialogue } from '../../core/dialogue/localDialogue';
import type { CompanionId } from '../../core/companions/types';
import { APPEARANCE_BY_ID, COMPANION_BY_ID } from '../../core/companions/registry';
import { extractUserFact, makeFirstChatMemory } from '../../core/memory/extraction';
import { useAppState } from '../../core/persistence/store';
import { deepSeekProvider, readableProviderError } from '../../platform/ai/deepseek';

const HISTORY_KEY = 'foedesk-chat-history-v1';
const MAX_MESSAGES = 40;
const MAX_CONTEXT_MESSAGES = 12;

export interface LocalChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

type Histories = Record<string, LocalChatMessage[]>;

export function useCompanionChat(companionId: CompanionId) {
  const { state, interact, addMemory, clearAppearanceMemories } = useAppState();
  const [histories, setHistories] = useState<Histories>(loadHistories);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const appearanceId = state.companions[companionId].activeAppearanceId;
  const messages = histories[appearanceId] ?? [];

  useEffect(() => localStorage.setItem(HISTORY_KEY, JSON.stringify(histories)), [histories]);

  const send = async (rawContent: string) => {
    const content = rawContent.trim().slice(0, 2_000);
    if (!content || busy) return false;
    const at = Date.now();
    const userMessage: LocalChatMessage = { id: messageId(), role: 'user', content, createdAt: at };
    const previous = histories[appearanceId] ?? [];
    const next = [...previous, userMessage].slice(-MAX_MESSAGES);
    setHistories((current) => ({ ...current, [appearanceId]: next }));
    interact({ type: 'chat_sent', content, at });
    if (!previous.length) addMemory(makeFirstChatMemory(companionId, appearanceId, at));
    const fact = extractUserFact(companionId, appearanceId, content, userMessage.id);
    if (fact) addMemory(fact);
    setBusy(true);
    setError('');
    try {
      let responseContent: string;
      if (state.settings.aiProviderId === 'deepseek') {
        const response = await deepSeekProvider.complete({
          model: state.settings.aiModel,
          messages: [
            { role: 'system', content: buildSystemPrompt(state, companionId, content) },
            ...next.slice(-MAX_CONTEXT_MESSAGES).map((message) => ({ role: message.role, content: message.content } as const)),
          ],
        });
        responseContent = response.content.trim();
      } else {
        responseContent = selectAppearanceDialogue(state, companionId, 'chat', {
          affinity: state.companions[companionId].affinity,
          mood: state.companions[companionId].mood,
          seed: at,
          query: content,
        })?.text ?? '我在听。';
      }
      const assistant: LocalChatMessage = { id: messageId(), role: 'assistant', content: responseContent, createdAt: Date.now() };
      const completed = [...next, assistant].slice(-MAX_MESSAGES);
      setHistories((current) => ({ ...current, [appearanceId]: completed }));
      if (completed.length >= 20 && completed.length % 10 === 0) {
        addMemory({
          id: `summary-${companionId}-${appearanceId}-${Math.floor(completed.length / 10)}`,
          companionId,
          appearanceId,
          type: 'conversation_summary',
          content: `近期对话摘要：${completed.slice(-6).map((entry) => entry.content).join('；').slice(0, 800)}`,
          importance: 45,
          createdAt: Date.now(),
          sourceMessageIds: completed.slice(-6).map(({ id }) => id),
        });
      }
      return true;
    } catch (caught) {
      setError(readableProviderError(caught));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return useMemo(() => ({
    messages,
    busy,
    error,
    send,
    clear: (includeMemories = false) => {
      setHistories((current) => ({ ...current, [appearanceId]: [] }));
      if (includeMemories) clearAppearanceMemories(appearanceId);
      setError('');
    },
  }), [appearanceId, busy, companionId, error, messages, state]);
}

function loadHistories(): Histories {
  try {
    const input = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '{}') as Record<string, unknown>;
    const histories: Histories = {};
    for (const [persistedId, entries] of Object.entries(input)) {
      if (!Array.isArray(entries)) continue;
      const appearanceId = persistedId in COMPANION_BY_ID
        ? COMPANION_BY_ID[persistedId as CompanionId].defaultAppearanceId
        : persistedId;
      if (!APPEARANCE_BY_ID[appearanceId]) continue;
      histories[appearanceId] = entries
        .filter((entry): entry is LocalChatMessage => Boolean(entry && typeof entry === 'object'
          && typeof entry.id === 'string'
          && (entry.role === 'user' || entry.role === 'assistant')
          && typeof entry.content === 'string'
          && typeof entry.createdAt === 'number'))
        .slice(-MAX_MESSAGES);
    }
    return histories;
  } catch { return {}; }
}

function messageId() {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
