export const MILLING_STAGES = ["wheat", "grinding", "packing", "delivery", "shelf"] as const;

export function clampProgress(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export function phase(progress: number, start: number, end: number) {
  return clampProgress((progress - start) / (end - start));
}

export function smoothPhase(progress: number, start: number, end: number) {
  const t = phase(progress, start, end);
  return t * t * (3 - 2 * t);
}

export function millingStage(progress: number) {
  return MILLING_STAGES[Math.min(4, Math.floor(clampProgress(progress) * 5))];
}
