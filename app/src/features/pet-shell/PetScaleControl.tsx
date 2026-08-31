import { PET_SCALE_STEPS, type PetScale } from '../../platform/window/layout';

export function PetScaleControl({ scale, interactive, onChange }: {
  scale: PetScale;
  interactive: boolean;
  onChange: (scale: PetScale) => void;
}) {
  const index = PET_SCALE_STEPS.indexOf(scale);
  return (
    <div
      className="pet-scale-control"
      aria-label="桌宠大小"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <button type="button" tabIndex={interactive ? 0 : -1} disabled={index <= 0} aria-label="缩小桌宠" onClick={() => onChange(PET_SCALE_STEPS[index - 1])}>−</button>
      <span>{Math.round(scale * 100)}%</span>
      <button type="button" tabIndex={interactive ? 0 : -1} disabled={index >= PET_SCALE_STEPS.length - 1} aria-label="放大桌宠" onClick={() => onChange(PET_SCALE_STEPS[index + 1])}>+</button>
    </div>
  );
}

