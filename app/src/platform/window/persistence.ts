import { normalizePetScale, type PetScale } from './layout';

const STORAGE_PREFIX = 'foedesk';
const PET_POSITION_KEY = `${STORAGE_PREFIX}-window-position-v1`;
const PET_SCALE_KEY = `${STORAGE_PREFIX}-pet-scale-v1`;

export interface StoredPosition {
  x: number;
  y: number;
}

export function readPetScale(): PetScale {
  return normalizePetScale(Number(localStorage.getItem(PET_SCALE_KEY)));
}

export function writePetScale(scale: PetScale) {
  localStorage.setItem(PET_SCALE_KEY, String(scale));
}

export function readPetPosition(): StoredPosition | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(PET_POSITION_KEY) ?? 'null') as Partial<StoredPosition> | null;
    if (typeof parsed?.x === 'number' && Number.isFinite(parsed.x)
      && typeof parsed.y === 'number' && Number.isFinite(parsed.y)) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // Invalid persisted positions are discarded below.
  }
  localStorage.removeItem(PET_POSITION_KEY);
  return null;
}

export function writePetPosition(position: StoredPosition) {
  localStorage.setItem(PET_POSITION_KEY, JSON.stringify(position));
}

export function clearPetPosition() {
  localStorage.removeItem(PET_POSITION_KEY);
}

