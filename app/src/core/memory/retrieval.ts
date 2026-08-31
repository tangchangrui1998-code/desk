import type { CompanionId, MemoryEntry } from '../companions/types';

export function retrieveMemories(entries: MemoryEntry[], companionId: CompanionId, appearanceId: string, query: string, limit = 6) {
  const terms = new Set(query.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []);
  return entries
    .filter((entry) => entry.companionId === companionId && entry.appearanceId === appearanceId)
    .map((entry) => ({
      entry,
      score: entry.importance + recencyScore(entry.createdAt)
        + [...terms].reduce((score, term) => score + (entry.content.toLowerCase().includes(term) ? 20 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry }) => entry);
}

function recencyScore(createdAt: number) {
  const days = Math.max(0, (Date.now() - createdAt) / 86_400_000);
  return Math.max(0, 15 - days);
}
