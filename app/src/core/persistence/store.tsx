import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { APPEARANCE_BY_ID, COMPANION_BY_ID } from '../companions/registry';
import type { AppState, AppearancePersona, BackendTheme, CompanionId, CompanionReaction, MemoryEntry } from '../companions/types';
import { applyInteraction } from '../interactions/engine';
import type { InteractionEvent } from '../interactions/events';
import { parseHiddenCodes } from '../unlocks/hiddenCodes';
import { loadAppState, normalizeAppearancePersona, normalizeName, saveAppState } from './schema';

export interface UnlockResult {
  recognized: number;
  newlyUnlocked: number;
  ignored: number;
  message: string;
}

interface AppStateContextValue {
  state: AppState;
  reaction: CompanionReaction | null;
  selectCompanion: (companionId: CompanionId) => void;
  selectAppearance: (companionId: CompanionId, appearanceId: string) => void;
  setCompanionName: (companionId: CompanionId, name: string) => void;
  setAppearancePersona: (appearanceId: string, persona: AppearancePersona) => void;
  resetAppearancePersona: (appearanceId: string) => void;
  setAlwaysOnTop: (enabled: boolean) => void;
  setRemindersEnabled: (enabled: boolean) => void;
  setBackendTheme: (theme: BackendTheme) => void;
  setAiSettings: (providerId: 'local' | 'deepseek', model?: string) => void;
  interact: (event: InteractionEvent) => CompanionReaction;
  clearReaction: () => void;
  redeemHiddenCodes: (input: string) => UnlockResult | null;
  addMemory: (entry: MemoryEntry) => void;
  clearCompanionMemories: (companionId: CompanionId) => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(loadAppState);
  const [reaction, setReaction] = useState<CompanionReaction | null>(null);

  useEffect(() => saveAppState(state), [state]);

  const value = useMemo<AppStateContextValue>(() => ({
    state,
    reaction,
    selectCompanion: (companionId) => {
      if (!COMPANION_BY_ID[companionId]) return;
      setState((current) => current.activeCompanionId === companionId ? current : { ...current, activeCompanionId: companionId });
      setReaction(null);
    },
    selectAppearance: (companionId, appearanceId) => {
      const companion = state.companions[companionId];
      if (!companion || companion.activeAppearanceId === appearanceId
        || !companion.unlockedAppearanceIds.includes(appearanceId)
        || APPEARANCE_BY_ID[appearanceId]?.companionId !== companionId) return;
      setState((current) => ({
        ...current,
        activeCompanionId: companionId,
        companions: {
          ...current.companions,
          [companionId]: { ...current.companions[companionId], activeAppearanceId: appearanceId },
        },
      }));
      setReaction({ companionId, text: `换成“${APPEARANCE_BY_ID[appearanceId].name}”了。`, visualState: 'happy', mood: 'happy', createdAt: Date.now(), expiresAt: Date.now() + 7_000, affinityGained: 0, trustGained: 0 });
    },
    setCompanionName: (companionId, name) => setState((current) => ({
      ...current,
      companions: {
        ...current.companions,
        [companionId]: { ...current.companions[companionId], customName: normalizeName(name) },
      },
    })),
    setAppearancePersona: (appearanceId, persona) => {
      const appearance = APPEARANCE_BY_ID[appearanceId];
      if (!appearance) return;
      setState((current) => ({
        ...current,
        appearancePersonaOverrides: {
          ...current.appearancePersonaOverrides,
          [appearanceId]: normalizeAppearancePersona(persona, appearance.persona),
        },
      }));
    },
    resetAppearancePersona: (appearanceId) => setState((current) => {
      if (!(appearanceId in current.appearancePersonaOverrides)) return current;
      const appearancePersonaOverrides = { ...current.appearancePersonaOverrides };
      delete appearancePersonaOverrides[appearanceId];
      return { ...current, appearancePersonaOverrides };
    }),
    setAlwaysOnTop: (enabled) => setState((current) => current.settings.alwaysOnTop === enabled ? current : { ...current, settings: { ...current.settings, alwaysOnTop: enabled } }),
    setRemindersEnabled: (enabled) => setState((current) => ({ ...current, settings: { ...current.settings, remindersEnabled: enabled } })),
    setBackendTheme: (theme) => setState((current) => ({ ...current, settings: { ...current.settings, backendTheme: theme } })),
    setAiSettings: (providerId, model) => setState((current) => ({
      ...current,
      settings: { ...current.settings, aiProviderId: providerId, aiModel: model?.trim().slice(0, 100) || current.settings.aiModel },
    })),
    interact: (event) => {
      const result = applyInteraction(state, event);
      setState(result.state);
      setReaction(result.reaction);
      return result.reaction;
    },
    clearReaction: () => setReaction(null),
    redeemHiddenCodes: (input) => {
      const parsed = parseHiddenCodes(input);
      if (!parsed) return null;
      let newlyUnlocked = 0;
      let next = state;
      for (const definition of parsed.codes) {
        const companion = next.companions[definition.companionId];
        const alreadyUnlocked = companion.unlockedAppearanceIds.includes(definition.appearanceId);
        if (!alreadyUnlocked) newlyUnlocked += 1;
        next = {
          ...next,
          activeCompanionId: definition.companionId,
          unlocks: next.unlocks.includes(definition.id) ? next.unlocks : [...next.unlocks, definition.id],
          companions: {
            ...next.companions,
            [definition.companionId]: {
              ...companion,
              activeAppearanceId: definition.appearanceId,
              unlockedAppearanceIds: alreadyUnlocked
                ? companion.unlockedAppearanceIds
                : [...companion.unlockedAppearanceIds, definition.appearanceId],
            },
          },
        };
      }
      setState(next);
      const last = parsed.codes.at(-1)!;
      const message = parsed.codes.length === 1
        ? (newlyUnlocked ? last.unlockedMessage : last.activatedMessage)
        : `批量暗号完成：识别 ${parsed.codes.length} 条，新解锁 ${newlyUnlocked} 套${parsed.ignoredCount ? `，忽略 ${parsed.ignoredCount} 个片段` : ''}。`;
      setReaction({ companionId: last.companionId, text: message, visualState: 'surprised', mood: 'happy', createdAt: Date.now(), expiresAt: Date.now() + 10_000, affinityGained: 0, trustGained: 0 });
      return { recognized: parsed.codes.length, newlyUnlocked, ignored: parsed.ignoredCount, message };
    },
    addMemory: (entry) => setState((current) => current.memories.some(({ id }) => id === entry.id)
      ? current
      : { ...current, memories: [...current.memories, entry].slice(-500) }),
    clearCompanionMemories: (companionId) => setState((current) => ({ ...current, memories: current.memories.filter((entry) => entry.companionId !== companionId) })),
  }), [reaction, state]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used inside AppStateProvider.');
  return context;
}
