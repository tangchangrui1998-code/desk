import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { APPEARANCE_BY_ID, COMPANIONS } from '../../core/companions/registry';
import { getAppearancePersona, getCompanionName } from '../../core/companions/selectors';
import type { AppearanceDefinition, AppearancePersona } from '../../core/companions/types';
import { useAppState } from '../../core/persistence/store';
import { getRelationshipStage, relationshipStageLabel } from '../../core/relationship/progression';

export function CompanionPanel() {
  const {
    state,
    selectAppearance,
    setCompanionName,
    setAppearancePersona,
    resetAppearancePersona,
  } = useAppState();
  const activeDefinition = COMPANIONS.find(({ id }) => id === state.activeCompanionId)!;
  const activeState = state.companions[state.activeCompanionId];
  const [panelTab, setPanelTab] = useState<'profile' | 'wardrobe'>('profile');
  const [nameDraft, setNameDraft] = useState(getCompanionName(state, state.activeCompanionId));
  const unlockedAppearances = useMemo(() => activeDefinition.availableAppearanceIds
    .filter((id) => activeState.unlockedAppearanceIds.includes(id))
    .map((id) => APPEARANCE_BY_ID[id]), [activeDefinition, activeState.unlockedAppearanceIds]);
  const activeAppearance = APPEARANCE_BY_ID[activeState.activeAppearanceId];
  const activePersona = getAppearancePersona(state, activeAppearance.id) ?? activeAppearance.persona;

  useEffect(() => {
    setNameDraft(getCompanionName(state, state.activeCompanionId));
  }, [state.activeCompanionId]);

  const saveName = (event: FormEvent) => {
    event.preventDefault();
    setCompanionName(state.activeCompanionId, nameDraft);
  };
  return (
    <>
      <div className="companion-panel-tabs" role="tablist" aria-label="人物管理">
        <button type="button" role="tab" aria-selected={panelTab === 'profile'} className={panelTab === 'profile' ? 'is-active' : ''} onClick={() => setPanelTab('profile')}>人物设定</button>
        <button type="button" role="tab" aria-selected={panelTab === 'wardrobe'} className={panelTab === 'wardrobe' ? 'is-active' : ''} onClick={() => setPanelTab('wardrobe')}>皮肤展示</button>
      </div>

      {panelTab === 'profile' && (
        <div role="tabpanel" className="companion-panel-tab-content">
          <div className="relationship-strip" aria-label="关系状态">
            <span><small>亲密度</small><strong>{activeState.affinity}</strong></span>
            <span><small>信任度</small><strong>{activeState.trust}</strong></span>
            <span><small>心情</small><strong>{moodLabel(activeState.mood)}</strong></span>
            <span><small>能量</small><strong>{activeState.energy}</strong></span>
            <span><small>关系</small><strong>{relationshipStageLabel(getRelationshipStage(activeState))}</strong></span>
          </div>

          <form className="companion-name-form" onSubmit={saveName}>
            <label htmlFor="companion-name">自定义称呼</label>
            <div>
              <input id="companion-name" value={nameDraft} maxLength={16} onChange={(event) => setNameDraft(event.target.value)} />
              <button type="submit">保存</button>
              <button type="button" onClick={() => { setNameDraft(activeDefinition.defaultName); setCompanionName(activeDefinition.id, ''); }}>恢复默认</button>
            </div>
          </form>

          <AppearancePersonaEditor
            key={activeAppearance.id}
            appearance={activeAppearance}
            persona={activePersona}
            customized={Boolean(state.appearancePersonaOverrides[activeAppearance.id])}
            onSave={(persona) => setAppearancePersona(activeAppearance.id, persona)}
            onReset={() => resetAppearancePersona(activeAppearance.id)}
          />
        </div>
      )}

      {panelTab === 'wardrobe' && (
        <div role="tabpanel" className="companion-panel-tab-content">
          <div className="wardrobe-heading">
            <div><strong>{getCompanionName(state, activeDefinition.id)}的衣柜</strong><small>{unlockedAppearances.length}/{activeDefinition.availableAppearanceIds.length} 已解锁</small></div>
          </div>
          <div className="appearance-grid" aria-label={`${activeDefinition.displayName}的外观`}>
            {unlockedAppearances.map((appearance) => {
              const active = appearance.id === activeState.activeAppearanceId;
              return (
                <button
                  key={appearance.id}
                  type="button"
                  className={active ? 'is-active' : ''}
                  aria-pressed={active}
                  onClick={() => selectAppearance(activeDefinition.id, appearance.id)}
                >
                  <span className={`appearance-preview ${appearance.render.mode === 'backdrop' ? 'has-backdrop' : ''}`} style={{ background: `linear-gradient(145deg, ${appearance.colors.accent}, #fff)` }}>
                    <img src={appearance.render.thumbnail} alt="" />
                  </span>
                  <strong>{appearance.name}</strong>
                  <small>{appearance.description}</small>
                  <em>{state.appearancePersonaOverrides[appearance.id]
                    ? '已自定义人设'
                    : appearance.unlock.type === 'hidden-code'
                      ? '暗号专属人设'
                      : appearance.identityMode === 'roleplay' ? '独立人设' : '角色本体'}</em>
                </button>
              );
            })}
          </div>

        </div>
      )}
    </>
  );
}

export function RedemptionPanel() {
  const { redeemHiddenCodes } = useAppState();
  const [codeDraft, setCodeDraft] = useState('');
  const [codeMessage, setCodeMessage] = useState('');

  const redeem = (event: FormEvent) => {
    event.preventDefault();
    const result = redeemHiddenCodes(codeDraft);
    if (!result) {
      setCodeMessage('没有识别到有效兑换码。可一次粘贴多条，以空格或换行分隔。');
      return;
    }
    setCodeMessage(result.message);
    setCodeDraft('');
  };

  return (
    <>
      <p className="section-kicker">隐藏内容</p>
      <h1>兑换码</h1>
      <p className="section-lead">输入兑换码解锁隐藏人物皮肤，支持单条或批量粘贴。</p>
      <form className="hidden-code-card is-standalone" onSubmit={redeem}>
        <div><strong>兑换隐藏皮肤</strong><small>重复兑换码会直接切换到对应角色与皮肤。</small></div>
        <textarea value={codeDraft} onChange={(event) => setCodeDraft(event.target.value)} placeholder="输入兑换码…" rows={4} />
        <button type="submit" disabled={!codeDraft.trim()}>确认兑换</button>
        {codeMessage && <p role="status">{codeMessage}</p>}
      </form>
    </>
  );
}

function AppearancePersonaEditor({ appearance, persona, customized, onSave, onReset }: {
  appearance: AppearanceDefinition;
  persona: AppearancePersona;
  customized: boolean;
  onSave: (persona: AppearancePersona) => void;
  onReset: () => void;
}) {
  const [identity, setIdentity] = useState(persona.identity);
  const [story, setStory] = useState(persona.story);
  const [personality, setPersonality] = useState(persona.personality.join('、'));
  const [speakingStyle, setSpeakingStyle] = useState(persona.speakingStyle);
  const [dialogueLines, setDialogueLines] = useState(persona.dialogueLines.join('\n'));
  const [message, setMessage] = useState('');

  const save = (event: FormEvent) => {
    event.preventDefault();
    onSave({
      identity,
      story,
      personality: personality.split(/[、，,\n]/).map((entry) => entry.trim()).filter(Boolean),
      speakingStyle,
      dialogueLines: dialogueLines.split('\n').map((entry) => entry.trim()).filter(Boolean),
    });
    setMessage('已保存，当前皮肤后续对话会使用这套人设。');
  };

  const reset = () => {
    onReset();
    setIdentity(appearance.persona.identity);
    setStory(appearance.persona.story);
    setPersonality(appearance.persona.personality.join('、'));
    setSpeakingStyle(appearance.persona.speakingStyle);
    setDialogueLines(appearance.persona.dialogueLines.join('\n'));
    setMessage('已恢复内置人设。');
  };

  return (
    <form className="appearance-persona-editor" onSubmit={save}>
      <header>
        <div>
          <span>当前皮肤人设</span>
          <strong>{appearance.name}</strong>
        </div>
        <em>{customized ? '已自定义' : appearance.unlock.type === 'hidden-code' ? '暗号专属预设' : '内置预设'}</em>
      </header>
      <label>
        <span>身份设定</span>
        <textarea rows={2} maxLength={300} value={identity} onChange={(event) => setIdentity(event.target.value)} />
      </label>
      <label>
        <span>简短故事</span>
        <textarea rows={3} maxLength={1_200} value={story} onChange={(event) => setStory(event.target.value)} />
      </label>
      <div className="appearance-persona-editor__split">
        <label>
          <span>性格关键词 <small>用顿号或逗号分隔</small></span>
          <textarea rows={2} maxLength={240} value={personality} onChange={(event) => setPersonality(event.target.value)} />
        </label>
        <label>
          <span>说话方式</span>
          <textarea rows={2} maxLength={500} value={speakingStyle} onChange={(event) => setSpeakingStyle(event.target.value)} />
        </label>
      </div>
      <label>
        <span>主动对白 <small>每行一条，仅用于桌宠主动冒泡</small></span>
        <textarea rows={3} maxLength={1_600} value={dialogueLines} onChange={(event) => setDialogueLines(event.target.value)} />
      </label>
      <footer>
        {message && <p role="status">{message}</p>}
        <button type="button" disabled={!customized} onClick={reset}>恢复内置人设</button>
        <button type="submit">保存人设</button>
      </footer>
    </form>
  );
}

function moodLabel(mood: string) {
  return ({ calm: '平静', happy: '开心', bored: '无聊', tired: '疲惫', annoyed: '不悦', shy: '害羞' } as Record<string, string>)[mood] ?? mood;
}
