import type { AppearanceDefinition, HitZone, NormalizedRect } from '../companions/types';

export function resolveHitZone(
  appearance: AppearanceDefinition,
  point: { x: number; y: number },
  bounds: { width: number; height: number },
): HitZone {
  if (bounds.width <= 0 || bounds.height <= 0) return 'outside';
  const normalized = { x: point.x / bounds.width, y: point.y / bounds.height };
  if (inside(normalized, appearance.render.hitZones.head)) return 'head';
  if (inside(normalized, appearance.render.hitZones.upperBody)) return 'upperBody';
  return 'outside';
}

function inside(point: { x: number; y: number }, rect: NormalizedRect) {
  return point.x >= rect.x && point.x <= rect.x + rect.width
    && point.y >= rect.y && point.y <= rect.y + rect.height;
}
