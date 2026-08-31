import { COMPANION_BY_ID } from '../companions/registry';
import { getActiveAppearance, getActiveAppearancePersona } from '../companions/selectors';
import type { AppearancePersona, AppState, CompanionId, DayPeriod, Mood, VisualState } from '../companions/types';

export interface DialogueLine {
  id: string;
  companionId: CompanionId;
  text: string;
  tags: string[];
  minAffinity?: number;
  moods?: Mood[];
  periods?: DayPeriod[];
  visualState?: VisualState;
  cooldownMinutes?: number;
}

const lines = (companionId: CompanionId, entries: Array<Omit<DialogueLine, 'companionId'>>): DialogueLine[] => entries.map((entry) => ({ companionId, ...entry }));

export const LOCAL_DIALOGUE: DialogueLine[] = [
  ...lines('boy', [
    { id: 'boy-morning', text: '早呀。先把肩膀放松一点，今天慢慢开始。', tags: ['proactive'], periods: ['morning'], visualState: 'happy' },
    { id: 'boy-day', text: '我刚发现，认真做完一件小事也很了不起。', tags: ['proactive'], periods: ['day'] },
    { id: 'boy-night', text: '已经很晚了。剩下的事，明天也会在原地等你。', tags: ['proactive'], periods: ['night'], visualState: 'sleeping' },
    { id: 'boy-chat', text: '我听见了。你不用一次把所有话都整理好。', tags: ['chat'] },
  ]),
  ...lines('girl', [
    { id: 'girl-morning', text: '早上好。我给今天留了一小块柔软的开场。', tags: ['proactive'], periods: ['morning'], visualState: 'happy' },
    { id: 'girl-day', text: '我有个小想法：先喝口水，再继续和难题较量。', tags: ['proactive'], periods: ['day'] },
    { id: 'girl-evening', text: '灯亮起来以后，房间好像也变得更近了。', tags: ['proactive'], periods: ['evening'] },
    { id: 'girl-chat', text: '这句话我接住啦。你想继续说，我就在这里。', tags: ['chat'] },
  ]),
  ...lines('rabbit', [
    { id: 'rabbit-morning', text: '早安。今天的安排可以认真，但不必苛刻。', tags: ['proactive'], periods: ['morning'] },
    { id: 'rabbit-day', text: '坐得够久了。起来走两步，我替你看着桌面。', tags: ['proactive'], periods: ['day'] },
    { id: 'rabbit-night', text: '夜深之后，效率不是唯一值得保留的东西。', tags: ['proactive'], periods: ['night'], visualState: 'sleeping' },
    { id: 'rabbit-chat', text: '嗯，我在听。你可以说得直接一点。', tags: ['chat'] },
  ]),
  ...lines('mystery', [
    { id: 'mystery-morning', text: '门外已经亮了。今天仍有重新安排的余地。', tags: ['proactive'], periods: ['morning'] },
    { id: 'mystery-day', text: '你专注得太久。时间没有催你，先休息。', tags: ['proactive'], periods: ['day'] },
    { id: 'mystery-night', text: '夜色会替你守住未完成的部分。去睡吧。', tags: ['proactive'], periods: ['night'], visualState: 'sleeping' },
    { id: 'mystery-chat', text: '我记得这句话。继续，我不会打断。', tags: ['chat'] },
  ]),
];

export function getDayPeriod(date = new Date()): DayPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 18) return 'day';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

export function selectLocalDialogue(
  companionId: CompanionId,
  tag: string,
  options: { affinity?: number; mood?: Mood; period?: DayPeriod; seed?: number } = {},
) {
  const candidates = LOCAL_DIALOGUE.filter((line) => line.companionId === companionId
    && line.tags.includes(tag)
    && (line.minAffinity ?? 0) <= (options.affinity ?? 0)
    && (!line.moods || line.moods.includes(options.mood ?? 'calm'))
    && (!line.periods || line.periods.includes(options.period ?? getDayPeriod())));
  const fallback = LOCAL_DIALOGUE.filter((line) => line.companionId === companionId && line.tags.includes(tag));
  const pool = candidates.length ? candidates : fallback;
  return pool[Math.abs(options.seed ?? Date.now()) % Math.max(pool.length, 1)];
}

export function selectAppearanceDialogue(
  state: AppState,
  companionId: CompanionId,
  tag: 'chat' | 'proactive',
  options: { affinity?: number; mood?: Mood; period?: DayPeriod; seed?: number; query?: string } = {},
) {
  const appearance = getActiveAppearance(state, companionId);
  const persona = getActiveAppearancePersona(state, companionId);
  if (tag === 'chat' && options.query?.trim()) {
    const seed = options.seed ?? Date.now();
    return {
      id: `${appearance.id}-chat-${seed}`,
      companionId,
      text: buildNaturalLocalReply(persona, options.query),
      tags: ['chat'],
    } satisfies DialogueLine;
  }
  const shouldUsePersona = appearance.id !== COMPANION_BY_ID[companionId].defaultAppearanceId
    || Boolean(state.appearancePersonaOverrides[appearance.id]);
  if (shouldUsePersona && persona.dialogueLines.length) {
    const index = Math.abs(options.seed ?? Date.now()) % persona.dialogueLines.length;
    return { id: `${appearance.id}-${tag}-${index}`, companionId, text: persona.dialogueLines[index], tags: [tag] } satisfies DialogueLine;
  }
  return selectLocalDialogue(companionId, tag, options);
}

type PersonaTone = 'direct' | 'warm' | 'playful';

function buildNaturalLocalReply(persona: AppearancePersona, rawQuery: string) {
  const query = rawQuery.trim();
  const tone = getPersonaTone(persona);
  if (/^(你好|嗨|哈喽|在吗|早安|早上好|晚上好)[！!。.？?]*$/.test(query)) {
    return {
      direct: '在。你想聊什么？',
      warm: '在呀。今天想从哪里聊起？',
      playful: '在呢。今天带了什么话题来？',
    }[tone];
  }
  if (/(谢谢|多谢|谢啦)/.test(query)) {
    return tone === 'direct' ? '不用客气。有需要就继续说。' : '不用谢，我很高兴能帮上你。';
  }
  if (/(累|疲惫|没精神|想睡|困了)/.test(query)) {
    return '听起来你是真的累了。先停几分钟、喝点水；如果愿意，再告诉我是什么把你耗得这么厉害。';
  }
  if (/(难过|伤心|低落|想哭|失落)/.test(query)) {
    return '听起来这件事让你很难受。我先不急着劝你，你愿意说说刚刚发生了什么吗？';
  }
  if (/(焦虑|担心|紧张|害怕|不安)/.test(query)) {
    return '先把最确定的一件事说出来吧。我们可以把担心分成“现在能做的”和“暂时控制不了的”。';
  }
  if (/(生气|烦死|恼火|讨厌|气死)/.test(query)) {
    return '听得出来你现在很生气。先说最让你受不了的那一件事，我陪你理清楚。';
  }
  if (/(开心|高兴|成功|完成了|做到了)/.test(query)) {
    return tone === 'direct' ? '做得好，这值得高兴。最关键的一步是什么？' : '太好了，这确实值得开心。快告诉我，最顺利的是哪一步？';
  }
  if (/(怎么办|怎么做|如何|该怎么)/.test(query)) {
    return '先告诉我你的目标，以及目前卡住的具体步骤。我再陪你把它拆小一点。';
  }
  if (/[?？]$/.test(query) || /(为什么|是不是|能不能|可以吗)/.test(query)) {
    return '我明白你的问题了。你更需要一个直接结论，还是想一起把原因理清？';
  }
  return {
    direct: '我听明白了。你想让我给个意见，还是先听你把这件事说完？',
    warm: '我在听。这里面哪一部分最让你在意？',
    playful: '听起来有点意思。你想先说结果，还是从头讲？',
  }[tone];
}

function getPersonaTone(persona: AppearancePersona): PersonaTone {
  const traits = persona.personality.join('');
  if (/(活泼|机灵|幽默|顽皮|狡黠|爽朗)/.test(traits)) return 'playful';
  if (/(冷静|直接|果断|严谨|精准|克制|沉着|理性)/.test(traits)) return 'direct';
  return 'warm';
}
