import type { ContentBundle } from "./model.js";
import { vocabularyIdentityKey } from "./model.js";
import { validateContentBundle } from "./validate.js";

export interface LearnerVocabularyIdentity {
  surfaceFormId: string;
  senseId: string;
}

/** Vocabulary publication is derived rather than stored. */
export function isVocabularyIdentityLearnerPublished(
  bundle: ContentBundle,
  surfaceFormId: string,
  senseId: string,
): boolean {
  const surface = bundle.surfaceForms.find((item) => item.id === surfaceFormId);
  const sense = bundle.senses.find((item) => item.id === senseId);
  const preparedLevels = new Set(bundle.quizItems
    .filter((quiz) => quiz.surfaceFormId === surfaceFormId && quiz.senseId === senseId)
    .map((quiz) => quiz.masteryLevel));
  return Boolean(
    surface
    && sense
    && surface.lemmaId === sense.lemmaId
    && preparedLevels.size === 8,
  );
}

/** Returns automatically published identities only from a learner-safe work. */
export function learnerVocabularyForWork(bundle: ContentBundle, workId: string): LearnerVocabularyIdentity[] {
  const validation = validateContentBundle(bundle);
  if (!validation.ok) throw new Error(`Cannot expose invalid content: ${validation.diagnostics[0]?.code ?? "unknown"}`);
  const work = bundle.works.find((item) => item.id === workId);
  if (!work || !["learning_ready", "published"].includes(work.publicationState)) return [];

  const identities = new Map<string, LearnerVocabularyIdentity>();
  for (const occurrence of bundle.occurrences.filter((item) => item.workId === workId)) {
    if (!isVocabularyIdentityLearnerPublished(bundle, occurrence.surfaceFormId, occurrence.senseId)) continue;
    const identity = { surfaceFormId: occurrence.surfaceFormId, senseId: occurrence.senseId };
    identities.set(vocabularyIdentityKey(identity.surfaceFormId, identity.senseId), identity);
  }
  return [...identities.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, identity]) => identity);
}
