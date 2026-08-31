export interface ScheduledPrompt {
  id: string;
  intervalMs: number;
  enabled: boolean;
  nextAt: number;
  messagePool: string[];
}

const STORAGE_KEY = 'foedesk-scheduled-prompts-v1';
const INTERVAL_MS = 30 * 60 * 1_000;

export function claimDuePrompt(at = Date.now()): string | null {
  const prompts = loadPrompts(at);
  const due = prompts.find((prompt) => prompt.enabled && prompt.nextAt <= at);
  if (!due) return null;
  const index = Math.floor(at / due.intervalMs) % due.messagePool.length;
  due.nextAt = at + due.intervalMs;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
  return due.messagePool[index];
}

function loadPrompts(at: number): ScheduledPrompt[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as ScheduledPrompt[] | null;
    if (Array.isArray(parsed) && parsed.every(validPrompt)) return parsed;
  } catch { /* Reset invalid scheduler state. */ }
  const prompts: ScheduledPrompt[] = [{
    id: 'wellbeing-break-v1',
    intervalMs: INTERVAL_MS,
    enabled: true,
    nextAt: at + INTERVAL_MS,
    messagePool: ['喝口水吧，水杯不会自己走近的。', '坐得有点久了，起来活动一下肩膀和双腿。'],
  }];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
  return prompts;
}

function validPrompt(value: unknown): value is ScheduledPrompt {
  return Boolean(value && typeof value === 'object'
    && typeof (value as ScheduledPrompt).id === 'string'
    && typeof (value as ScheduledPrompt).intervalMs === 'number'
    && typeof (value as ScheduledPrompt).nextAt === 'number'
    && Array.isArray((value as ScheduledPrompt).messagePool));
}
