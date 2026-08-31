import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { AppMode } from '../../app/routes';
import { getActiveAppearance, getActiveCompanion, getCompanionName, getDialogueCharacterName } from '../../core/companions/selectors';
import { buildProactiveSystemPrompt } from '../../core/dialogue/contextBuilder';
import { resolveHitZone } from '../../core/interactions/hitZones';
import type { AppearanceDefinition } from '../../core/companions/types';
import { claimDuePrompt } from '../../core/schedule/prompts';
import { useAppState } from '../../core/persistence/store';
import { createDragGesture, crossedDragThreshold, type DragGesture } from '../../platform/window/drag';
import { deepSeekProvider } from '../../platform/ai/deepseek';
import type { PetScale } from '../../platform/window/layout';
import { closeWindow, startWindowDragging } from '../../platform/window/runtime';
import { PetChatPanel } from '../chat/PetChatPanel';
import { CharacterAvatar } from './CharacterAvatar';
import { PetQuickMenu } from './PetQuickMenu';

export function DesktopPet({ mode, scale, onModeChange, onScaleChange }: {
  mode: Extract<AppMode, 'pet' | 'chat'>;
  scale: PetScale;
  onModeChange: (mode: AppMode) => void;
  onScaleChange: (scale: PetScale) => void;
}) {
  const { state, reaction, interact, clearReaction } = useAppState();
  const [menuOpen, setMenuOpen] = useState(false);
  const dragGesture = useRef<DragGesture | null>(null);
  const latestState = useRef(state);
  const latestInteract = useRef(interact);
  const proactiveRequestInFlight = useRef(false);
  latestState.current = state;
  latestInteract.current = interact;
  const chatting = mode === 'chat';
  const companion = getActiveCompanion(state);
  const appearance = getActiveAppearance(state);
  const companionName = getCompanionName(state, companion.id);
  const dialogueCharacterName = getDialogueCharacterName(state, companion.id);
  const activeReaction = reaction?.companionId === companion.id ? reaction : null;

  useEffect(() => {
    if (!activeReaction) return;
    const delay = Math.max(0, activeReaction.expiresAt - Date.now());
    const timer = window.setTimeout(clearReaction, delay);
    return () => window.clearTimeout(timer);
  }, [activeReaction, clearReaction]);

  useEffect(() => {
    if (!state.settings.remindersEnabled) return;
    const triggerProactiveGreeting = async () => {
      const snapshot = latestState.current;
      const at = Date.now();
      if (snapshot.settings.aiProviderId !== 'deepseek') {
        latestInteract.current({ type: 'idle_elapsed', minutes: 5, at });
        return;
      }
      if (proactiveRequestInFlight.current) return;
      proactiveRequestInFlight.current = true;
      const companionId = snapshot.activeCompanionId;
      try {
        const response = await deepSeekProvider.complete({
          model: snapshot.settings.aiModel,
          messages: [
            { role: 'system', content: buildProactiveSystemPrompt(snapshot, companionId, new Date(at)) },
            { role: 'user', content: '现在自然地向用户主动说一句话。只输出问候正文。' },
          ],
        });
        const current = latestState.current;
        if (!current.settings.remindersEnabled
          || current.settings.aiProviderId !== 'deepseek'
          || current.activeCompanionId !== companionId) return;
        const content = normalizeProactiveGreeting(response.content);
        latestInteract.current(content
          ? { type: 'scheduled_prompt', content, at: Date.now() }
          : { type: 'idle_elapsed', minutes: 5, at: Date.now() });
      } catch (error) {
        console.warn('[proactive] Failed to generate a greeting; using local dialogue.', error);
        const current = latestState.current;
        if (current.settings.remindersEnabled && current.activeCompanionId === companionId) {
          latestInteract.current({ type: 'idle_elapsed', minutes: 5, at: Date.now() });
        }
      } finally {
        proactiveRequestInFlight.current = false;
      }
    };
    const proactiveTimer = window.setInterval(() => void triggerProactiveGreeting(), 5 * 60 * 1000);
    const reminderTimer = window.setInterval(() => {
      const content = claimDuePrompt();
      if (content) latestInteract.current({ type: 'scheduled_prompt', content, at: Date.now() });
    }, 30_000);
    return () => { window.clearInterval(proactiveTimer); window.clearInterval(reminderTimer); };
  }, [state.settings.remindersEnabled]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || chatting) return;
    dragGesture.current = createDragGesture(event.pointerId, event.screenX, event.screenY);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = dragGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.dragged || !(event.buttons & 1)) return;
    if (!crossedDragThreshold(gesture, event.screenX, event.screenY)) return;
    gesture.dragged = true;
    setMenuOpen(false);
    void startWindowDragging();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const gesture = dragGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.dragged) {
      interact({ type: 'pet_dragged', distance: Math.hypot(event.screenX - gesture.startX, event.screenY - gesture.startY), at: Date.now() });
    } else if (!chatting) {
      interact({ type: 'pet_clicked', zone: hitZone(appearance, event.currentTarget, event.clientX, event.clientY), at: Date.now() });
      setMenuOpen((current) => !current);
    }
    dragGesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleDoubleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (chatting) return;
    interact({ type: 'pet_double_clicked', zone: hitZone(appearance, event.currentTarget, event.clientX, event.clientY), at: Date.now() });
  };

  return (
    <main className={`desktop-pet-root ${menuOpen ? 'has-menu' : ''} ${chatting ? 'is-chatting' : ''}`} style={{ '--pet-scale': scale } as React.CSSProperties}>
      {chatting && <PetChatPanel companionId={companion.id} companionName={dialogueCharacterName} appearance={appearance} onClose={() => onModeChange('pet')} />}
      <PetQuickMenu
        open={menuOpen}
        scale={scale}
        onBackend={() => { setMenuOpen(false); onModeChange('backend'); }}
        onChat={() => { setMenuOpen(false); onModeChange('chat'); }}
        onExit={() => void closeWindow()}
        onScaleChange={onScaleChange}
      />
      <button
        className={`pet-hitbox ${menuOpen ? 'has-menu' : ''}`}
        aria-label={menuOpen ? '收起桌宠菜单' : '展开桌宠菜单；按住并移动可拖动人物'}
        onClick={(event) => { if (event.detail === 0 && !chatting) setMenuOpen((current) => !current); }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onPointerCancel={() => { dragGesture.current = null; }}
      >
        <span className="pet-bubble" aria-live="polite">
          <strong>{companionName}</strong>
          {activeReaction?.text ?? (chatting ? '我会留在这里陪你。' : '点一下试试，按住可以拖动我。')}
        </span>
        <CharacterAvatar companion={companion} appearance={appearance} visualState={activeReaction?.visualState ?? state.companions[companion.id].visualState} />
      </button>
    </main>
  );
}

function hitZone(appearance: AppearanceDefinition, target: HTMLButtonElement, clientX: number, clientY: number) {
  const avatar = target.querySelector<HTMLElement>('.companion-avatar');
  if (!avatar) return 'outside' as const;
  const rect = avatar.getBoundingClientRect();
  return resolveHitZone(appearance, { x: clientX - rect.left, y: clientY - rect.top }, { width: rect.width, height: rect.height });
}

function normalizeProactiveGreeting(content: string) {
  return [...content
    .trim()
    .replace(/^```(?:text)?\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/^[-*]\s*/, '')
    .replace(/^[“"]|[”"]$/g, '')
    .replace(/\s+/g, ' ')]
    .slice(0, 100)
    .join('')
    .trim();
}
