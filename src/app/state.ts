export { clampMastery } from "../learner/scheduler.js";
export { vocabularyIdentityKey as vocabularyKey } from "../domain/model.js";

/** Stable presentation order prevents the authored correct-first convention leaking into the UI. */
export function orderedChoices(choices: string[], quizId: string): string[] {
  if (choices.length < 2) return [...choices];
  const rotation = [...quizId].reduce((total, character) => total + character.codePointAt(0)!, 0) % choices.length;
  return [...choices.slice(rotation), ...choices.slice(0, rotation)];
}
