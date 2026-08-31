import manifest from '../companions/legacy-appearance-manifest.json';
import type { CompanionId } from '../companions/types';

export interface HiddenCodeDefinition {
  id: string;
  code: string;
  badge: string;
  appearanceId: string;
  companionId: CompanionId;
  unlockedMessage: string;
  activatedMessage: string;
}

interface ManifestCodeEntry {
  id: string;
  companionId: CompanionId;
  cheatCode?: {
    id: string;
    code: string;
    badge: string;
    unlockedMessage: string;
    activatedMessage: string;
  };
}

export const HIDDEN_CODES: HiddenCodeDefinition[] = (manifest.appearances as ManifestCodeEntry[]).flatMap((entry) => entry.cheatCode ? [{
  id: entry.cheatCode.id,
  code: entry.cheatCode.code,
  badge: entry.cheatCode.badge,
  appearanceId: entry.id,
  companionId: entry.companionId,
  unlockedMessage: entry.cheatCode.unlockedMessage,
  activatedMessage: entry.cheatCode.activatedMessage,
}] : []);

export interface HiddenCodeBatch {
  codes: HiddenCodeDefinition[];
  ignoredCount: number;
}

export function parseHiddenCodes(input: string): HiddenCodeBatch | null {
  const tokens = normalize(input).match(/[A-Z0-9]+(?:-[A-Z0-9]+)*/g) ?? [];
  const byCode = new Map(HIDDEN_CODES.map((entry) => [normalize(entry.code), entry]));
  const seen = new Set<string>();
  const codes: HiddenCodeDefinition[] = [];
  let ignoredCount = 0;
  for (const token of tokens) {
    const definition = byCode.get(token);
    if (!definition) { ignoredCount += 1; continue; }
    if (seen.has(definition.id)) continue;
    seen.add(definition.id);
    codes.push(definition);
  }
  return codes.length ? { codes, ignoredCount } : null;
}

function normalize(value: string) {
  return value.trim().normalize('NFKC').toUpperCase();
}
