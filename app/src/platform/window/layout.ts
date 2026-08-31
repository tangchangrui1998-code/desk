import type { AppMode } from '../../app/routes';

export const PET_SCALE_STEPS = [0.85, 1, 1.15, 1.3, 1.45, 1.6, 1.8, 2] as const;
export type PetScale = (typeof PET_SCALE_STEPS)[number];

const PET_BASE_SIZE = { width: 240, height: 310 };
const PET_BASE_MIN_SIZE = { width: 220, height: 280 };

export const FIXED_WINDOW_LAYOUTS: Record<Exclude<AppMode, 'pet'>, {
  size: { width: number; height: number };
  minSize: { width: number; height: number } | null;
}> = {
  chat: { size: { width: 620, height: 420 }, minSize: null },
  backend: { size: { width: 1040, height: 700 }, minSize: { width: 920, height: 620 } },
};

export function normalizePetScale(value: number): PetScale {
  return PET_SCALE_STEPS.includes(value as PetScale) ? value as PetScale : 1;
}

export function getPetWindowSize(scale: number) {
  return scaleSize(PET_BASE_SIZE, scale);
}

export function getPetWindowMinSize(scale: number) {
  return scaleSize(PET_BASE_MIN_SIZE, scale);
}

export function clampPosition(
  desired: { x: number; y: number },
  windowSize: { width: number; height: number },
  workArea: { x: number; y: number; width: number; height: number },
) {
  return {
    x: Math.round(Math.min(Math.max(desired.x, workArea.x), workArea.x + workArea.width - windowSize.width)),
    y: Math.round(Math.min(Math.max(desired.y, workArea.y), workArea.y + workArea.height - windowSize.height)),
  };
}

function scaleSize(size: { width: number; height: number }, scale: number) {
  return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
}
