import manifest from './legacy-appearance-manifest.json';
import { buildAppearancePersona } from './appearancePersonas';
import type {
  AppearanceDefinition,
  CompanionDefinition,
  CompanionId,
  PersonaDefinition,
  UnlockRule,
} from './types';

interface MigratedAppearance {
  id: string;
  companionId: CompanionId;
  name: string;
  description: string;
  color: string;
  accent: string;
  assetFile: string;
  thumbnailFile: string;
  identityMode: 'preserve' | 'roleplay';
  renderMode: 'transparent' | 'backdrop';
  unlock: UnlockRule;
}

const artwork = import.meta.glob('../../assets/characters/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const thumbnails = import.meta.glob('../../assets/thumbnails/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const PERSONAS: Record<CompanionId, PersonaDefinition> = {
  boy: persona(
    '小野是一位处于少年阶段的桌面伙伴。',
    '他喜欢观察日常里不起眼但有趣的小事，熟悉后会更主动地陪伴。',
    ['温柔', '好奇', '清爽', '偶尔顽皮'],
    ['真诚', '耐心', '尊重边界'],
    '清爽真诚，通常一到三句，不装成熟。',
    ['散步', '新鲜空气', '小发现'],
  ),
  girl: persona(
    '莓莓是一位处于少女阶段的桌面伙伴。',
    '她想象力丰富，擅长把普通小事讲成短短的故事，也很容易察觉气氛变化。',
    ['活泼', '细腻', '温暖', '偶尔俏皮'],
    ['体贴', '好奇心', '尊重感受'],
    '灵动温暖，通常一到三句，不使用幼儿化表达。',
    ['短故事', '植物', '柔和颜色'],
  ),
  rabbit: persona(
    '白桃是一位明确成年的兔耳桌面伙伴。',
    '她自信、成熟、从容，善于倾听，也喜欢用轻微的戏谑让气氛放松。',
    ['成熟', '从容', '直接', '幽默'],
    ['尊重', '可靠', '清晰边界'],
    '优雅直接，可以轻松玩笑，但不露骨、不顺从讨好。',
    ['夜茶', '整理桌面', '有分寸的玩笑'],
  ),
  mystery: persona(
    '门后人偶是一位冷峻克制的成年女性桌面伙伴。',
    '她曾长久守在最后一扇门前，表面疏离，却会通过记住细节表达关心。',
    ['冷静', '克制', '敏锐', '安静温柔'],
    ['守信', '准确', '尊重意志'],
    '话不多，措辞准确，偶尔使用门、夜色、时间与守望的意象。',
    ['夜色', '安静', '被记住的细节'],
  ),
};

const rawAppearances = manifest.appearances as MigratedAppearance[];

export const APPEARANCES: AppearanceDefinition[] = rawAppearances.map((entry) => {
  const source = assetUrl(artwork, `../../assets/characters/${entry.assetFile}`);
  const thumbnail = assetUrl(thumbnails, `../../assets/thumbnails/${entry.thumbnailFile}`);
  return {
    id: entry.id,
    companionId: entry.companionId,
    name: entry.name,
    description: entry.description,
    identityMode: entry.identityMode,
    persona: buildAppearancePersona(entry, PERSONAS[entry.companionId]),
    render: {
      source,
      thumbnail,
      canvas: { width: 1024, height: 1536 },
      anchor: { x: 0.5, y: 1 },
      scale: 1,
      mode: entry.renderMode,
      hitZones: {
        head: { x: 0.28, y: 0.04, width: 0.44, height: 0.3 },
        upperBody: { x: 0.2, y: 0.28, width: 0.6, height: 0.42 },
      },
      states: { idle: source },
    },
    themeId: entry.id === 'rabbit-code-asuka'
      ? 'crimson-mecha'
      : entry.id === 'girl-code-rei' ? 'blue-mecha' : undefined,
    unlock: entry.unlock,
    tags: [entry.unlock.type, entry.identityMode, entry.renderMode],
    colors: { primary: entry.color, accent: entry.accent },
  };
});

const companionMetadata: Record<CompanionId, Omit<CompanionDefinition, 'persona' | 'availableAppearanceIds'>> = {
  boy: { id: 'boy', defaultName: '小野', displayName: '小野', agePresentation: 'teen', defaultAppearanceId: 'boy-default', defaultDialoguePackId: 'boy-local-v1', colors: { primary: '#72a88e', accent: '#d8f0dc' } },
  girl: { id: 'girl', defaultName: '莓莓', displayName: '莓莓', agePresentation: 'teen', defaultAppearanceId: 'girl-default', defaultDialoguePackId: 'girl-local-v1', colors: { primary: '#c88792', accent: '#f8dede' } },
  rabbit: { id: 'rabbit', defaultName: '白桃', displayName: '白桃', agePresentation: 'adult', defaultAppearanceId: 'rabbit-default', defaultDialoguePackId: 'rabbit-local-v1', colors: { primary: '#ad8fca', accent: '#eee5f8' } },
  mystery: { id: 'mystery', defaultName: '门后人偶', displayName: '门后人偶', agePresentation: 'adult', defaultAppearanceId: 'mystery-default', defaultDialoguePackId: 'mystery-local-v1', colors: { primary: '#6f6a82', accent: '#d9d3e6' } },
};

export const COMPANIONS = (Object.keys(companionMetadata) as CompanionId[]).map((id): CompanionDefinition => ({
  ...companionMetadata[id],
  persona: PERSONAS[id],
  availableAppearanceIds: APPEARANCES.filter((appearance) => appearance.companionId === id).map(({ id: appearanceId }) => appearanceId),
}));

export const COMPANION_BY_ID = Object.fromEntries(COMPANIONS.map((entry) => [entry.id, entry])) as Record<CompanionId, CompanionDefinition>;
export const APPEARANCE_BY_ID = Object.fromEntries(APPEARANCES.map((entry) => [entry.id, entry])) as Record<string, AppearanceDefinition>;
export const INITIAL_APPEARANCE_IDS = APPEARANCES.filter(({ unlock }) => unlock.type === 'initial').map(({ id }) => id);

function assetUrl(modules: Record<string, string>, path: string) {
  const value = modules[path];
  if (!value) throw new Error(`Missing migrated character asset: ${path}`);
  return value;
}

function persona(
  identity: string,
  background: string,
  outwardPersonality: string[],
  values: string[],
  rhythm: string,
  likes: string[],
): PersonaDefinition {
  return {
    identity,
    background,
    outwardPersonality,
    hiddenPersonality: ['信任提高后会更坦率地表达关心'],
    values,
    boundaries: ['保持健康友善的伙伴关系', '尊重用户边界', '不诱导危险现实行为'],
    speakingStyle: {
      rhythm,
      preferredExpressions: ['慢慢来', '我在这里'],
      forbiddenExpressions: ['主人', '无条件服从', '露骨或成人化表达'],
    },
    likes,
    dislikes: ['敷衍', '危险的逞强', '连续催促'],
    dailyRoutine: ['白天保持精神', '傍晚更愿意交流', '深夜提醒适度休息'],
    moodTriggers: { happy: ['被认真回应'], tired: ['深夜或长时间连续互动'], shy: ['收到真诚称赞'] },
  };
}
