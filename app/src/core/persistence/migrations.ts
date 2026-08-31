type UnknownRecord = Record<string, unknown>;

export const LATEST_STATE_VERSION = 3;

export function migratePersistedState(input: unknown): unknown {
  if (!isRecord(input)) return null;
  const version = typeof input.version === 'number' ? input.version : 0;
  if (version === LATEST_STATE_VERSION) return input;
  if (version === 2) {
    return { ...input, version: 3, appearancePersonaOverrides: {} };
  }
  if (version === 1) {
    return {
      ...input,
      version: 3,
      appearancePersonaOverrides: {},
      settings: {
        alwaysOnTop: true,
        remindersEnabled: true,
        backendTheme: 'follow',
        aiProviderId: 'local',
        aiModel: 'deepseek-chat',
        ...(isRecord(input.settings) ? input.settings : {}),
      },
    };
  }
  // The pre-state-model shell had no companion state worth importing.
  return null;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
