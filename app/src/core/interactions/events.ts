import type { HitZone } from '../companions/types';

export type InteractionEvent =
  | { type: 'pet_clicked'; zone: HitZone; at: number }
  | { type: 'pet_double_clicked'; zone: HitZone; at: number }
  | { type: 'pet_dragged'; distance: number; at: number }
  | { type: 'chat_sent'; content: string; at: number }
  | { type: 'appearance_changed'; appearanceId: string; at: number }
  | { type: 'idle_elapsed'; minutes: number; at: number }
  | { type: 'scheduled_prompt'; content: string; at: number }
  | { type: 'day_period_changed'; period: 'morning' | 'day' | 'evening' | 'night'; at: number };
