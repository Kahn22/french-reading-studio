export const MASTERY_MIN = 1;
export const MASTERY_MAX = 8;

export type MasteryRecord = Record<string, number>;

export const vocabularyKey = (surfaceFormId: string, senseId: string) => `${surfaceFormId}:${senseId}`;

export function clampMastery(value: number): number {
  return Math.max(MASTERY_MIN, Math.min(MASTERY_MAX, Math.trunc(value)));
}

export function advanceMastery(current: number, remembered: boolean): number {
  return remembered ? clampMastery(current + 1) : MASTERY_MIN;
}
