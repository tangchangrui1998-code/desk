import type { CompanionId, MemoryEntry } from '../companions/types';

export function extractUserFact(companionId: CompanionId, appearanceId: string, content: string, sourceMessageId: string): MemoryEntry | null {
  const normalized = content.trim();
  const fact = normalized.match(/(?:我叫|叫我|我的名字是)\s*([^，。！？,.!?]{1,20})/u)?.[0]
    ?? normalized.match(/我(?:很)?喜欢\s*([^，。！？,.!?]{1,40})/u)?.[0]
    ?? normalized.match(/我(?:不喜欢|讨厌)\s*([^，。！？,.!?]{1,40})/u)?.[0]
    ?? normalized.match(/我(?:通常|一般|每天)\s*([^，。！？,.!?]{2,50})/u)?.[0];
  if (!fact) return null;
  return {
    id: `fact-${appearanceId}-${stableHash(fact)}`,
    companionId,
    appearanceId,
    type: 'user_fact',
    content: fact,
    importance: 65,
    createdAt: Date.now(),
    sourceMessageIds: [sourceMessageId],
  };
}

export function makeFirstChatMemory(companionId: CompanionId, appearanceId: string, at: number): MemoryEntry {
  return { id: `first-chat-${appearanceId}`, companionId, appearanceId, type: 'relationship_event', content: '第一次在 FoeDesk 中认真聊天。', importance: 80, createdAt: at };
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}
