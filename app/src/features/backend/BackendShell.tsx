import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getActiveAppearance } from '../../core/companions/selectors';
import { useAppState } from '../../core/persistence/store';
import type { BackendTheme } from '../../core/companions/types';
import { closeWindow, startWindowDragging } from '../../platform/window/runtime';
import { remoteAiProviders, type RemoteAiProviderId } from '../../platform/ai/providers';
import { readableProviderError } from '../../platform/ai/runtime';
import { CompanionPanel, RedemptionPanel } from '../companions/CompanionPanel';
import { CompanionRail } from '../companions/CompanionRail';

export function BackendShell({ alwaysOnTop, onAlwaysOnTopChange, onReturnToDesktop }: {
  alwaysOnTop: boolean;
  onAlwaysOnTopChange: (enabled: boolean) => void;
  onReturnToDesktop: () => void;
}) {
  const { state } = useAppState();
  const appearance = getActiveAppearance(state);
  const resolvedTheme = state.settings.backendTheme === 'follow' ? appearance.themeId ?? 'meadow' : state.settings.backendTheme;
  const [activeSection, setActiveSection] = useState<'companions' | 'codes' | 'window' | 'ai'>('companions');
  return (
    <main className={`backend-shell theme-${resolvedTheme}`}>
      <header className="titlebar">
        <button className="titlebar__brand" type="button" onPointerDown={() => void startWindowDragging()}>
          <span className="brand-mark">F</span><span>FoeDesk</span>
        </button>
        <div className="titlebar__drag" data-tauri-drag-region />
        <button className="window-button is-return" type="button" aria-label="返回桌面" onClick={onReturnToDesktop}>返回桌面</button>
        <button className="window-button is-close" type="button" aria-label="关闭" onClick={() => void closeWindow()}>×</button>
      </header>
      <div className="backend-body">
        <aside>
          <p className="backend-eyebrow">桌面伙伴控制台</p>
          <nav aria-label="后台导航">
            <button className={activeSection === 'companions' ? 'is-active' : ''} onClick={() => setActiveSection('companions')}>人物与外观</button>
            <button className={activeSection === 'codes' ? 'is-active' : ''} onClick={() => setActiveSection('codes')}>兑换码</button>
            <button className={activeSection === 'window' ? 'is-active' : ''} onClick={() => setActiveSection('window')}>窗口设置</button>
            <button className={activeSection === 'ai' ? 'is-active' : ''} onClick={() => setActiveSection('ai')}>对话服务</button>
          </nav>
        </aside>
        <CompanionRail />
        <section className="backend-content">
          {activeSection === 'companions' && <CompanionPanel />}
          {activeSection === 'codes' && <RedemptionPanel />}
          {activeSection === 'window' && <Settings alwaysOnTop={alwaysOnTop} onAlwaysOnTopChange={onAlwaysOnTopChange} />}
          {activeSection === 'ai' && <AiSettings />}
        </section>
      </div>
    </main>
  );
}

function Settings({ alwaysOnTop, onAlwaysOnTopChange }: {
  alwaysOnTop: boolean;
  onAlwaysOnTopChange: (enabled: boolean) => void;
}) {
  const { state, setRemindersEnabled, setBackendTheme } = useAppState();
  return (
    <>
      <p className="section-kicker">窗口设置</p>
      <h1>保持桌伴触手可及</h1>
      <div className="settings-card">
        <div><strong>始终置顶</strong><small>让人物显示在其他普通窗口上方。</small></div>
        <button className={`switch ${alwaysOnTop ? 'is-on' : ''}`} type="button" role="switch" aria-checked={alwaysOnTop} onClick={() => onAlwaysOnTopChange(!alwaysOnTop)}><span /></button>
      </div>
      <div className="settings-card">
        <div><strong>主动对白与提醒</strong><small>启用联网模型时由模型生成问候，否则使用本地人物对白。</small></div>
        <button className={`switch ${state.settings.remindersEnabled ? 'is-on' : ''}`} type="button" role="switch" aria-checked={state.settings.remindersEnabled} onClick={() => setRemindersEnabled(!state.settings.remindersEnabled)}><span /></button>
      </div>
      <div className="theme-settings">
        <strong>后台主题</strong>
        <div>{(['follow', 'meadow', 'crimson-mecha', 'blue-mecha'] as BackendTheme[]).map((theme) => <button key={theme} className={state.settings.backendTheme === theme ? 'is-active' : ''} onClick={() => setBackendTheme(theme)}>{themeLabel(theme)}</button>)}</div>
      </div>
      <p className="settings-note">窗口位置和桌宠缩放仅保存在 `foedesk-*` 命名空间，不会读取“旅迹”的设置。</p>
    </>
  );
}

function AiSettings() {
  const { state, setAiSettings } = useAppState();
  const apiKeyInput = useRef<HTMLInputElement>(null);
  const [editingProvider, setEditingProvider] = useState<RemoteAiProviderId>(
    state.settings.aiProviderId === 'local' ? 'deepseek' : state.settings.aiProviderId,
  );
  const [models, setModels] = useState(state.settings.aiModels);
  const [configured, setConfigured] = useState<Record<RemoteAiProviderId, boolean>>({ deepseek: false, openai: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const provider = remoteAiProviders[editingProvider];
  const providerName = providerLabel(editingProvider);
  const model = models[editingProvider];

  useEffect(() => {
    void Promise.all([
      remoteAiProviders.deepseek.getStatus().catch(() => ({ configured: false })),
      remoteAiProviders.openai.getStatus().catch(() => ({ configured: false })),
    ]).then(([deepseek, openai]) => setConfigured({ deepseek: deepseek.configured, openai: openai.configured }));
  }, []);

  useEffect(() => {
    if (apiKeyInput.current) apiKeyInput.current.value = '';
    setMessage('');
  }, [editingProvider]);

  const saveAndTest = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage('');
    try {
      const apiKey = apiKeyInput.current?.value.trim() ?? '';
      if (apiKey) await provider.saveCredential(apiKey);
      await provider.test(model);
      setConfigured((current) => ({ ...current, [editingProvider]: true }));
      setAiSettings(editingProvider, model);
      if (apiKeyInput.current) apiKeyInput.current.value = '';
      setMessage(`连接成功，已启用 ${providerName} 对话。`);
    } catch (error) { setMessage(readableProviderError(error)); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setMessage('');
    try {
      await provider.deleteCredential();
      setConfigured((current) => ({ ...current, [editingProvider]: false }));
      if (state.settings.aiProviderId === editingProvider) setAiSettings('local');
      setMessage(`${providerName} API Key 已从系统凭据库删除。`);
    }
    catch (error) { setMessage(readableProviderError(error)); }
    finally { setBusy(false); }
  };

  const selectRemoteProvider = (providerId: RemoteAiProviderId) => {
    setEditingProvider(providerId);
    if (configured[providerId]) setAiSettings(providerId, models[providerId]);
  };

  return (
    <>
      <p className="section-kicker">对话服务</p>
      <h1>离线可用，联网可选</h1>
      <p className="section-lead">本地规则始终维护人物关系、情绪和解锁。DeepSeek 或 OpenAI 只生成语言，API Key 分别保存在系统凭据库。</p>
      <div className="provider-choice">
        <button className={state.settings.aiProviderId === 'local' ? 'is-active' : ''} disabled={busy} onClick={() => setAiSettings('local')}><strong>离线基础模式</strong><small>无需 Key，四名人物均可聊天</small></button>
        {(['deepseek', 'openai'] as RemoteAiProviderId[]).map((providerId) => (
          <button
            key={providerId}
            className={`${state.settings.aiProviderId === providerId ? 'is-active' : ''} ${editingProvider === providerId ? 'is-editing' : ''}`}
            disabled={busy}
            onClick={() => selectRemoteProvider(providerId)}
          >
            <strong>{providerLabel(providerId)}</strong>
            <small>{configured[providerId] ? '系统凭据库已配置' : '点击进行配置'}</small>
          </button>
        ))}
      </div>
      <form className="provider-form" onSubmit={(event) => void saveAndTest(event)}>
        <strong className="provider-form__title">配置 {providerName}</strong>
        <label>模型<input value={model} maxLength={100} onChange={(event) => setModels((current) => ({ ...current, [editingProvider]: event.target.value }))} /></label>
        <label>API Key<input ref={apiKeyInput} type="password" autoComplete="off" placeholder={configured[editingProvider] ? '留空可测试已有 Key' : `输入 ${providerName} API Key`} /></label>
        <div><button type="submit" disabled={busy || !model.trim()}>{busy ? '处理中…' : '保存并测试'}</button><button type="button" disabled={busy || !configured[editingProvider]} onClick={() => void remove()}>删除 Key</button></div>
        {message && <p role="status">{message}</p>}
      </form>
    </>
  );
}

function providerLabel(providerId: RemoteAiProviderId) {
  return providerId === 'openai' ? 'OpenAI' : 'DeepSeek';
}

function themeLabel(theme: BackendTheme) {
  return ({ follow: '跟随外观', meadow: '柔和原野', 'crimson-mecha': '赤红机甲', 'blue-mecha': '蓝色机甲' })[theme];
}
