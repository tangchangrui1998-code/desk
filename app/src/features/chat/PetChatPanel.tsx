import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AppearanceDefinition, CompanionId } from '../../core/companions/types';
import { useAppState } from '../../core/persistence/store';
import { useCompanionChat } from './useCompanionChat';

export function PetChatPanel({ companionId, companionName, appearance, onClose }: {
  companionId: CompanionId;
  companionName: string;
  appearance: AppearanceDefinition;
  onClose: () => void;
}) {
  const { state } = useAppState();
  const [draft, setDraft] = useState('');
  const { messages, busy, error, send, clear } = useCompanionChat(companionId);
  const messagesRef = useRef<HTMLDivElement>(null);
  const followLatestRef = useRef(true);
  const hasPositionedRef = useRef(false);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container || !followLatestRef.current) return;
    const behavior = hasPositionedRef.current ? 'smooth' : 'auto';
    const frame = window.requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior });
      hasPositionedRef.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [appearance.id, busy, error, messages.length]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    followLatestRef.current = true;
    setDraft('');
    await send(content);
  };

  return (
    <section className="pet-chat-panel" aria-label="人物对话面板">
      <header data-tauri-drag-region>
        <span className="pet-chat-panel__portrait"><img src={appearance.render.thumbnail} alt="" /></span>
        <div>
          <strong>{companionName}</strong>
          <small>{appearance.name} · {state.settings.aiProviderId === 'deepseek' ? 'DeepSeek · ' + state.settings.aiModel : '离线基础模式'}</small>
        </div>
        <button type="button" className="pet-chat-panel__clear" onClick={() => clear(false)}>清空</button>
        <button type="button" className="pet-chat-panel__close" aria-label="关闭对话" onClick={onClose}>×</button>
      </header>
      <div
        ref={messagesRef}
        className="pet-chat-messages"
        aria-live="polite"
        onScroll={(event) => {
          const container = event.currentTarget;
          const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
          followLatestRef.current = distanceToBottom < 72;
        }}
      >
        {messages.length === 0 && <p className="pet-chat-empty">现在可以直接聊天；未配置模型时会使用人物自己的离线对白。</p>}
        {messages.map((message) => (
          <article key={message.id} className={'pet-chat-message ' + (message.role === 'user' ? 'is-user' : '')}>
            <strong>{message.role === 'user' ? '你' : companionName}</strong>
            <p>{message.content}</p>
          </article>
        ))}
        {busy && <p className="pet-chat-empty">正在想怎么回答……</p>}
        {error && <p className="pet-chat-error" role="alert">{error}</p>}
      </div>
      <form className="pet-chat-composer" onSubmit={(event) => void submit(event)}>
        <textarea
          value={draft}
          maxLength={2_000}
          placeholder="说点什么…"
          aria-label="对话内容"
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div><small>{draft.length}/2000</small><button type="submit" disabled={!draft.trim() || busy}>发送</button></div>
      </form>
    </section>
  );
}
