export interface DragGesture {
  pointerId: number;
  startX: number;
  startY: number;
  dragged: boolean;
}

export const DRAG_THRESHOLD_PX = 5;

export function createDragGesture(pointerId: number, screenX: number, screenY: number): DragGesture {
  return { pointerId, startX: screenX, startY: screenY, dragged: false };
}

export function crossedDragThreshold(gesture: DragGesture, screenX: number, screenY: number) {
  return Math.hypot(screenX - gesture.startX, screenY - gesture.startY) >= DRAG_THRESHOLD_PX;
}

