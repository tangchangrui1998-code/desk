import { APPEARANCE_BY_ID, COMPANION_BY_ID } from './registry';
import type { AppState, CompanionId } from './types';

export function getActiveCompanion(state: AppState) {
  return COMPANION_BY_ID[state.activeCompanionId];
}

export function getCompanionName(state: AppState, companionId: CompanionId) {
  return state.companions[companionId].customName ?? COMPANION_BY_ID[companionId].defaultName;
}

export function getDialogueCharacterName(state: AppState, companionId = state.activeCompanionId) {
  const appearance = getActiveAppearance(state, companionId);
  return appearance.identityMode === 'roleplay' ? appearance.name : getCompanionName(state, companionId);
}

export function getActiveAppearance(state: AppState, companionId = state.activeCompanionId) {
  return APPEARANCE_BY_ID[state.companions[companionId].activeAppearanceId]
    ?? APPEARANCE_BY_ID[COMPANION_BY_ID[companionId].defaultAppearanceId];
}

export function getAppearancePersona(state: AppState, appearanceId: string) {
  const appearance = APPEARANCE_BY_ID[appearanceId];
  if (!appearance) return undefined;
  return state.appearancePersonaOverrides[appearanceId] ?? appearance.persona;
}

export function getActiveAppearancePersona(state: AppState, companionId = state.activeCompanionId) {
  const appearance = getActiveAppearance(state, companionId);
  return getAppearancePersona(state, appearance.id) ?? appearance.persona;
}
