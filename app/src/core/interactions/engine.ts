import { selectAppearanceDialogue, getDayPeriod } from '../dialogue/localDialogue';
import type { AppState, CompanionId, CompanionReaction, CompanionState, HitZone, Mood, VisualState } from '../companions/types';
import type { InteractionEvent } from './events';

const CLICK_COOLDOWN_MS = 20_000;
const CHAT_COOLDOWN_MS = 120_000;

const CLICK_LINES: Record<CompanionId, Record<HitZone, string[]>> = {
  boy: {
    head: ['欸，头发要被你揉乱了。', '好啦，我知道你在。'],
    upperBody: ['收到。今天也一起慢慢来。', '我站稳啦。'],
    outside: ['我在这里。', '刚才是不是点偏了一点？'],
  },
  girl: {
    head: ['唔……这算是今天的摸摸吗？', '头发会记住你的手势哦。'],
    upperBody: ['我接到你的招呼啦。', '今天也可以轻一点。'],
    outside: ['差一点点。', '我看见你啦。'],
  },
  rabbit: {
    head: ['胆子不小。下次先打声招呼。', '好吧，这次不和你计较。'],
    upperBody: ['我在。说吧。', '别急，我没有走。'],
    outside: ['准头还有提升空间。', '是在确认我还在吗？'],
  },
  mystery: {
    head: ['……我允许这一次。', '动作很轻。我记住了。'],
    upperBody: ['我在门的这一侧。', '无需反复确认，我没有离开。'],
    outside: ['你触碰的是影子。', '再靠近一点。'],
  },
};

export function applyInteraction(state: AppState, event: InteractionEvent): { state: AppState; reaction: CompanionReaction } {
  const companionId = state.activeCompanionId;
  const current = recoverState(state.companions[companionId], event.at);
  const key = cooldownKey(event);
  const cooldown = event.type === 'chat_sent' ? CHAT_COOLDOWN_MS : CLICK_COOLDOWN_MS;
  const canProgress = !key || event.at - (current.interactionCooldowns[key] ?? 0) >= cooldown;
  const affinityGained = canProgress && (event.type === 'pet_clicked' || event.type === 'pet_double_clicked' || event.type === 'chat_sent') ? 1 : 0;
  const trustGained = canProgress && event.type === 'chat_sent' && current.affinity >= 10 ? 1 : 0;
  const mood = moodFor(event, current.mood);
  const visualState = visualFor(event);
  const nextCompanion: CompanionState = {
    ...current,
    affinity: Math.min(100, current.affinity + affinityGained),
    trust: Math.min(100, current.trust + trustGained),
    mood,
    lastMoodChangedAt: mood === current.mood ? current.lastMoodChangedAt : event.at,
    lastInteractionAt: event.type === 'idle_elapsed' ? current.lastInteractionAt : event.at,
    lastSpokeAt: event.type === 'chat_sent' ? event.at : current.lastSpokeAt,
    currentBehavior: visualState === 'sleeping' ? 'sleeping' : visualState === 'talking' ? 'talking' : 'reacting',
    visualState,
    interactionCooldowns: key && canProgress ? { ...current.interactionCooldowns, [key]: event.at } : current.interactionCooldowns,
  };
  const nextState = { ...state, companions: { ...state.companions, [companionId]: nextCompanion } };
  const reaction = makeReaction(nextState, companionId, nextCompanion, event, affinityGained, trustGained);
  return { state: nextState, reaction };
}

export function recoverState(state: CompanionState, at: number): CompanionState {
  if (!state.lastInteractionAt) return state;
  const elapsedHours = Math.max(0, (at - state.lastInteractionAt) / 3_600_000);
  if (elapsedHours < 1) return state;
  return {
    ...state,
    mood: elapsedHours >= 4 ? 'calm' : state.mood,
    energy: Math.min(100, state.energy + Math.floor(elapsedHours * 4)),
    attention: Math.min(100, state.attention + Math.floor(elapsedHours * 3)),
    currentBehavior: 'idle',
    visualState: 'idle',
  };
}

function makeReaction(
  appState: AppState,
  companionId: CompanionId,
  state: CompanionState,
  event: InteractionEvent,
  affinityGained: number,
  trustGained: number,
): CompanionReaction {
  const zone = 'zone' in event ? event.zone : undefined;
  let text: string;
  if (event.type === 'chat_sent') {
    text = selectAppearanceDialogue(appState, companionId, 'chat', { affinity: state.affinity, mood: state.mood, seed: event.at, query: event.content })?.text ?? '我在听。';
  } else if (event.type === 'scheduled_prompt') {
    text = event.content;
  } else if (event.type === 'idle_elapsed' || event.type === 'day_period_changed') {
    text = selectAppearanceDialogue(appState, companionId, 'proactive', { affinity: state.affinity, mood: state.mood, period: getDayPeriod(), seed: event.at })?.text ?? '我在这里。';
  } else if (zone) {
    const pool = CLICK_LINES[companionId][zone];
    text = pool[event.at % pool.length];
  } else {
    text = '我在这里。';
  }
  return { companionId, text, visualState: state.visualState, mood: state.mood, zone, createdAt: event.at, expiresAt: event.at + 7_000, affinityGained, trustGained };
}

function cooldownKey(event: InteractionEvent) {
  if (event.type === 'pet_clicked' || event.type === 'pet_double_clicked') return `${event.type}:${event.zone}`;
  if (event.type === 'chat_sent') return 'chat_sent';
  return '';
}
function moodFor(event: InteractionEvent, current: Mood): Mood {
  if (event.type === 'pet_clicked' && event.zone === 'head') return 'happy';
  if (event.type === 'pet_double_clicked') return 'shy';
  if (event.type === 'pet_dragged' && event.distance > 180) return 'annoyed';
  if ((event.type === 'idle_elapsed' || event.type === 'day_period_changed') && getDayPeriod() === 'night') return 'tired';
  if (event.type === 'chat_sent') return 'happy';
  return current;
}
function visualFor(event: InteractionEvent): VisualState {
  if (event.type === 'pet_clicked') return event.zone === 'head' ? 'touched' : event.zone === 'upperBody' ? 'happy' : 'blink';
  if (event.type === 'pet_double_clicked') return 'surprised';
  if (event.type === 'pet_dragged') return event.distance > 180 ? 'annoyed' : 'idle';
  if (event.type === 'chat_sent') return 'talking';
  if (getDayPeriod() === 'night') return 'sleeping';
  return 'idle';
}
