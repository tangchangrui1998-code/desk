import { APPEARANCE_BY_ID, COMPANIONS, COMPANION_BY_ID } from '../companions/registry';
import type {
  AppState,
  AppearancePersona,
  BackendTheme,
  BehaviorState,
  CompanionId,
  CompanionState,
  MemoryEntry,
  Mood,
  VisualState,
} from '../companions/types';
import { LATEST_STATE_VERSION, migratePersistedState } from './migrations';

export const APP_STATE_STORAGE_KEY = 'foedesk-state-v1';

export function createInitialAppState(): AppState {
  const companions = Object.fromEntries(COMPANIONS.map((definition) => [
    definition.id,
    createInitialCompanionState(definition.id),
  ])) as Record<CompanionId, CompanionState>;
  return {
    version: LATEST_STATE_VERSION,
    activeCompanionId: 'boy',
    companions,
    memories: [],
    settings: {
      alwaysOnTop: true,
      remindersEnabled: true,
      backendTheme: 'follow',
      aiProviderId: 'local',
      aiModel: 'deepseek-chat',
    },
    unlocks: [],
    appearancePersonaOverrides: {},
  };
}

export function loadAppState(): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY) ?? 'null');
  } catch {
    localStorage.removeItem(APP_STATE_STORAGE_KEY);
    return createInitialAppState();
  }
  const migrated = migratePersistedState(parsed);
  return migrated ? sanitizeAppState(migrated) : createInitialAppState();
}

export function saveAppState(state: AppState) {
  localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state));
}

export function createInitialCompanionState(companionId: CompanionId): CompanionState {
  const definition = COMPANION_BY_ID[companionId];
  return {
    companionId,
    activeAppearanceId: definition.defaultAppearanceId,
    affinity: 0,
    trust: 0,
    mood: 'calm',
    energy: 80,
    attention: 50,
    lastInteractionAt: 0,
    lastSpokeAt: 0,
    lastMoodChangedAt: 0,
    currentBehavior: 'idle',
    visualState: 'idle',
    interactionCooldowns: {},
    unlockedAppearanceIds: definition.availableAppearanceIds.filter((id) => APPEARANCE_BY_ID[id].unlock.type === 'initial'),
    unlockedInteractionIds: [],
  };
}

function sanitizeAppState(input: unknown): AppState {
  const fallback = createInitialAppState();
  if (!isRecord(input)) return fallback;
  const activeCompanionId = isCompanionId(input.activeCompanionId) ? input.activeCompanionId : fallback.activeCompanionId;
  const rawCompanions = isRecord(input.companions) ? input.companions : {};
  const companions = Object.fromEntries(COMPANIONS.map(({ id }) => [
    id,
    sanitizeCompanionState(rawCompanions[id], fallback.companions[id]),
  ])) as Record<CompanionId, CompanionState>;
  const settings = isRecord(input.settings) ? input.settings : {};
  return {
    version: LATEST_STATE_VERSION,
    activeCompanionId,
    companions,
    memories: sanitizeMemories(input.memories),
    settings: {
      alwaysOnTop: typeof settings.alwaysOnTop === 'boolean' ? settings.alwaysOnTop : fallback.settings.alwaysOnTop,
      remindersEnabled: typeof settings.remindersEnabled === 'boolean' ? settings.remindersEnabled : fallback.settings.remindersEnabled,
      backendTheme: isBackendTheme(settings.backendTheme) ? settings.backendTheme : fallback.settings.backendTheme,
      aiProviderId: settings.aiProviderId === 'deepseek' ? 'deepseek' : 'local',
      aiModel: typeof settings.aiModel === 'string' && settings.aiModel.trim()
        ? settings.aiModel.trim().slice(0, 100)
        : fallback.settings.aiModel,
    },
    unlocks: stringArray(input.unlocks),
    appearancePersonaOverrides: sanitizeAppearancePersonaOverrides(input.appearancePersonaOverrides),
  };
}

function sanitizeAppearancePersonaOverrides(value: unknown): Record<string, AppearancePersona> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([appearanceId, candidate]) => {
    const appearance = APPEARANCE_BY_ID[appearanceId];
    if (!appearance || !isRecord(candidate)) return [];
    return [[appearanceId, normalizeAppearancePersona(candidate, appearance.persona)]];
  }));
}

function sanitizeCompanionState(input: unknown, fallback: CompanionState): CompanionState {
  if (!isRecord(input)) return fallback;
  const allowedAppearances = COMPANION_BY_ID[fallback.companionId].availableAppearanceIds;
  const persistedUnlocked = stringArray(input.unlockedAppearanceIds).filter((id) => allowedAppearances.includes(id));
  const unlockedAppearanceIds = [...new Set([...fallback.unlockedAppearanceIds, ...persistedUnlocked])];
  const activeAppearanceId = typeof input.activeAppearanceId === 'string'
    && unlockedAppearanceIds.includes(input.activeAppearanceId)
    && APPEARANCE_BY_ID[input.activeAppearanceId]?.companionId === fallback.companionId
    ? input.activeAppearanceId
    : fallback.activeAppearanceId;
  return {
    ...fallback,
    customName: typeof input.customName === 'string' ? normalizeName(input.customName) : undefined,
    activeAppearanceId,
    unlockedAppearanceIds,
    affinity: boundedNumber(input.affinity, fallback.affinity, 0, 100),
    trust: boundedNumber(input.trust, fallback.trust, 0, 100),
    energy: boundedNumber(input.energy, fallback.energy, 0, 100),
    attention: boundedNumber(input.attention, fallback.attention, 0, 100),
    mood: isMood(input.mood) ? input.mood : fallback.mood,
    currentBehavior: isBehaviorState(input.currentBehavior) ? input.currentBehavior : fallback.currentBehavior,
    visualState: isVisualState(input.visualState) ? input.visualState : fallback.visualState,
    lastInteractionAt: boundedNumber(input.lastInteractionAt, 0, 0, Number.MAX_SAFE_INTEGER),
    lastSpokeAt: boundedNumber(input.lastSpokeAt, 0, 0, Number.MAX_SAFE_INTEGER),
    lastMoodChangedAt: boundedNumber(input.lastMoodChangedAt, 0, 0, Number.MAX_SAFE_INTEGER),
    interactionCooldowns: numberRecord(input.interactionCooldowns),
    unlockedInteractionIds: stringArray(input.unlockedInteractionIds),
  };
}

function sanitizeMemories(value: unknown): MemoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): MemoryEntry[] => {
    if (!isRecord(entry)
      || typeof entry.id !== 'string'
      || !isCompanionId(entry.companionId)
      || !isMemoryType(entry.type)
      || typeof entry.content !== 'string'
      || !entry.content.trim()
      || typeof entry.createdAt !== 'number') return [];
    return [{
      id: entry.id,
      companionId: entry.companionId,
      type: entry.type,
      content: entry.content.slice(0, 4_000),
      importance: boundedNumber(entry.importance, 0, 0, 100),
      createdAt: boundedNumber(entry.createdAt, 0, 0, Number.MAX_SAFE_INTEGER),
      lastReferencedAt: typeof entry.lastReferencedAt === 'number' ? entry.lastReferencedAt : undefined,
      sourceMessageIds: stringArray(entry.sourceMessageIds),
    }];
  }).slice(-500);
}

export function normalizeName(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, 16);
  return normalized || undefined;
}

export function normalizeAppearancePersona(value: Partial<AppearancePersona>, fallback: AppearancePersona): AppearancePersona {
  const identity = typeof value.identity === 'string' ? value.identity.trim().replace(/\s+/g, ' ').slice(0, 300) : '';
  const story = typeof value.story === 'string' ? value.story.trim().replace(/\s+/g, ' ').slice(0, 1_200) : '';
  const speakingStyle = typeof value.speakingStyle === 'string' ? value.speakingStyle.trim().replace(/\s+/g, ' ').slice(0, 500) : '';
  const personality = Array.isArray(value.personality)
    ? value.personality.flatMap((entry) => typeof entry === 'string' && entry.trim() ? [entry.trim().slice(0, 30)] : []).slice(0, 8)
    : [];
  const dialogueLines = Array.isArray(value.dialogueLines)
    ? value.dialogueLines.flatMap((entry) => typeof entry === 'string' && entry.trim() ? [entry.trim().replace(/\s+/g, ' ').slice(0, 200)] : []).slice(0, 8)
    : [];
  return {
    identity: identity || fallback.identity,
    story: story || fallback.story,
    personality: personality.length ? personality : [...fallback.personality],
    speakingStyle: speakingStyle || fallback.speakingStyle,
    dialogueLines: dialogueLines.length ? dialogueLines : [...fallback.dialogueLines],
  };
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;
}
function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}
function numberRecord(value: unknown) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])));
}
function isCompanionId(value: unknown): value is CompanionId {
  return typeof value === 'string' && value in COMPANION_BY_ID;
}
function isMood(value: unknown): value is Mood {
  return value === 'calm' || value === 'happy' || value === 'bored' || value === 'tired' || value === 'annoyed' || value === 'shy';
}
function isBehaviorState(value: unknown): value is BehaviorState {
  return value === 'idle' || value === 'resting' || value === 'talking' || value === 'sleeping' || value === 'reacting';
}
function isVisualState(value: unknown): value is VisualState {
  return value === 'idle' || value === 'blink' || value === 'happy' || value === 'annoyed' || value === 'touched' || value === 'talking' || value === 'sleeping' || value === 'surprised';
}
function isMemoryType(value: unknown): value is MemoryEntry['type'] {
  return value === 'user_fact' || value === 'relationship_event' || value === 'conversation_summary';
}
function isBackendTheme(value: unknown): value is BackendTheme {
  return value === 'follow' || value === 'meadow' || value === 'crimson-mecha' || value === 'blue-mecha';
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
