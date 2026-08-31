import { APPEARANCE_BY_ID, COMPANIONS } from '../../core/companions/registry';
import { getCompanionName } from '../../core/companions/selectors';
import { useAppState } from '../../core/persistence/store';

export function CompanionRail() {
  const { state, selectCompanion } = useAppState();
  const activeCompanion = COMPANIONS.find(({ id }) => id === state.activeCompanionId)!;
  const activeState = state.companions[activeCompanion.id];
  const activeAppearance = APPEARANCE_BY_ID[activeState.activeAppearanceId];

  return (
    <section className="companion-rail" aria-label="角色展示">
      <header className="companion-rail__header">
        <span>角色展示</span>
        <strong>当前伙伴</strong>
      </header>
      <div
        className={`companion-stage ${activeAppearance.render.mode === 'backdrop' ? 'has-backdrop' : ''}`}
        style={{
          background: `radial-gradient(circle at 50% 26%, ${activeAppearance.colors.accent} 0, transparent 56%), linear-gradient(165deg, rgba(255,255,255,.72), ${activeAppearance.colors.primary}30)`,
        }}
      >
        <div className="companion-stage__halo" aria-hidden="true" />
        <img src={activeAppearance.render.source} alt={`${getCompanionName(state, activeCompanion.id)}，${activeAppearance.name}`} />
        <footer>
          <span>当前立绘</span>
          <strong>{getCompanionName(state, activeCompanion.id)}</strong>
          <small>{activeAppearance.name} · {activeState.unlockedAppearanceIds.length} 套外观</small>
        </footer>
      </div>
      <p className="companion-rail__switch-label">切换角色</p>
      <div className="companion-rail__list" role="tablist" aria-label="人物">
        {COMPANIONS.map((companion) => {
          const active = companion.id === state.activeCompanionId;
          return (
            <button
              key={companion.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={active ? 'is-active' : ''}
              onClick={() => selectCompanion(companion.id)}
            >
              <strong>{getCompanionName(state, companion.id)}</strong>
              <i aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
