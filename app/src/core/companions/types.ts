export type CompanionId = 'boy' | 'girl' | 'rabbit' | 'mystery';
export type Mood = 'calm' | 'happy' | 'bored' | 'tired' | 'annoyed' | 'shy';
export type BehaviorState = 'idle' | 'resting' | 'talking' | 'sleeping' | 'reacting';
export type VisualState = 'idle' | 'blink' | 'happy' | 'annoyed' | 'touched' | 'talking' | 'sleeping' | 'surprised';
export type HitZone = 'head' | 'upperBody' | 'outside';
export type DayPeriod = 'morning' | 'day' | 'evening' | 'night';
export type BackendTheme = 'follow' | 'meadow' | 'crimson-mecha' | 'blue-mecha';

export interface PersonaDefinition {
  identity: string;
  background: string;
  outwardPersonality: string[];
  hiddenPersonality: string[];
  values: string[];
  boundaries: string[];
  speakingStyle: {
    rhythm: string;
    preferredExpressions: string[];
    forbiddenExpressions: string[];
  };
  likes: string[];
  dislikes: string[];
  dailyRoutine: string[];
  moodTriggers: Partial<Record<Mood, string[]>>;
}

export interface AppearancePersona {
  identity: string;
  story: string;
  personality: string[];
  speakingStyle: string;
  dialogueLines: string[];
}

export interface NormalizedRect { x: number; y: number; width: number; height: number }

export interface AppearanceRenderSpec {
  source: string;
  thumbnail: string;
  canvas: { width: number; height: number };
  anchor: { x: number; y: number };
  scale: number;
  mode: 'transparent' | 'backdrop';
  hitZones: { head: NormalizedRect; upperBody: NormalizedRect };
  states: Partial<Record<VisualState, string>>;
}

export type UnlockRule = { type: 'initial' } | { type: 'hidden-code'; codeId: string };

export interface AppearanceDefinition {
  id: string;
  companionId: CompanionId;
  name: string;
  description: string;
  identityMode: 'preserve' | 'roleplay';
  persona: AppearancePersona;
  render: AppearanceRenderSpec;
  themeId?: Exclude<BackendTheme, 'follow' | 'meadow'>;
  unlock: UnlockRule;
  tags: string[];
  colors: { primary: string; accent: string };
}

export interface CompanionDefinition {
  id: CompanionId;
  defaultName: string;
  displayName: string;
  agePresentation: 'child' | 'teen' | 'adult';
  persona: PersonaDefinition;
  defaultAppearanceId: string;
  availableAppearanceIds: string[];
  defaultDialoguePackId: string;
  colors: { primary: string; accent: string };
}

export interface CompanionState {
  companionId: CompanionId;
  customName?: string;
  activeAppearanceId: string;
  affinity: number;
  trust: number;
  mood: Mood;
  energy: number;
  attention: number;
  lastInteractionAt: number;
  lastSpokeAt: number;
  lastMoodChangedAt: number;
  currentBehavior: BehaviorState;
  visualState: VisualState;
  interactionCooldowns: Record<string, number>;
  unlockedAppearanceIds: string[];
  unlockedInteractionIds: string[];
}

export interface MemoryEntry {
  id: string;
  companionId: CompanionId;
  type: 'user_fact' | 'relationship_event' | 'conversation_summary';
  content: string;
  importance: number;
  createdAt: number;
  lastReferencedAt?: number;
  sourceMessageIds?: string[];
}

export interface AppSettings {
  alwaysOnTop: boolean;
  remindersEnabled: boolean;
  backendTheme: BackendTheme;
  aiProviderId: 'local' | 'deepseek';
  aiModel: string;
}

export interface AppState {
  version: number;
  activeCompanionId: CompanionId;
  companions: Record<CompanionId, CompanionState>;
  memories: MemoryEntry[];
  settings: AppSettings;
  unlocks: string[];
  appearancePersonaOverrides: Record<string, AppearancePersona>;
}

export interface CompanionReaction {
  companionId: CompanionId;
  text: string;
  visualState: VisualState;
  mood: Mood;
  zone?: HitZone;
  createdAt: number;
  expiresAt: number;
  affinityGained: number;
  trustGained: number;
}
