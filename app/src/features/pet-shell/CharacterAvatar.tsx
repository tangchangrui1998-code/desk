import { useEffect, useState } from 'react';
import type { AppearanceDefinition, CompanionDefinition, VisualState } from '../../core/companions/types';
import { PlaceholderCompanion } from './PlaceholderCompanion';

export function CharacterAvatar({
  companion,
  appearance,
  visualState = 'idle',
  compact = false,
}: {
  companion: CompanionDefinition;
  appearance: AppearanceDefinition;
  visualState?: VisualState;
  compact?: boolean;
}) {
  const source = appearance.render.states[visualState] ?? appearance.render.states.idle ?? appearance.render.source;
  const [failedSource, setFailedSource] = useState<string | null>(null);

  useEffect(() => setFailedSource(null), [source]);

  if (failedSource === source) return <PlaceholderCompanion />;

  return (
    <div
      className={`companion-avatar is-${visualState} ${appearance.render.mode === 'backdrop' ? 'has-backdrop' : ''} ${compact ? 'is-compact' : ''}`}
      style={{
        '--appearance-scale': appearance.render.scale,
        '--appearance-anchor-x': `${appearance.render.anchor.x * 100}%`,
        '--appearance-anchor-y': `${appearance.render.anchor.y * 100}%`,
      } as React.CSSProperties}
      aria-label={`${companion.displayName}，${appearance.name}`}
    >
      <img src={source} alt="" draggable={false} onError={() => setFailedSource(source)} />
    </div>
  );
}
