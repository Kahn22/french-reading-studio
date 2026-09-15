import type { ContentBundle } from "../domain/model.js";
import type { ExpressionCatalog } from "../domain/expression-content.js";
import { vocabularyIdentityKey } from "../domain/model.js";

export const READING_SECTION_SIZE = 1;
export const QUIZ_BATCH_SIZE = 10;
export const QUIZ_PREFETCH_REMAINING = 3;

type Unit = ContentBundle["units"][number];
type Occurrence = ContentBundle["occurrences"][number];

export interface ReadingSectionPackage {
  workId: string;
  index: number;
  unit: Unit;
  occurrences: Occurrence[];
  lemmas: ContentBundle["lemmas"];
  senses: ContentBundle["senses"];
  surfaceForms: ContentBundle["surfaceForms"];
  expressions: ContentBundle["expressions"];
  notes: ContentBundle["notes"];
}

export interface QuizBatchPackage {
  index: number;
  identityKeys: string[];
  quizItems: ContentBundle["quizItems"];
}

export interface DeliveryManifest {
  version: 1;
  readingSectionSize: 1;
  quizBatchSize: 10;
  quizPrefetchRemaining: 3;
  catalog: Pick<ContentBundle, "authors" | "collections" | "books" | "works">;
  expressionCatalog: ExpressionCatalog;
  works: Record<string, { sectionCount: number }>;
  quizBatchForIdentity: Record<string, number>;
  identityLocations: Record<string, { workId: string; sectionIndex: number }[]>;
}

export interface DeliveryPackages {
  manifest: DeliveryManifest;
  readingSections: ReadingSectionPackage[];
  quizBatches: QuizBatchPackage[];
}

/** Builds deterministic, cacheable payloads without duplicating derivable records globally. */
export function createDeliveryPackages(bundle: ContentBundle, expressionCatalog: ExpressionCatalog = { identities: [], occurrences: [], preparedQuizzes: [] }): DeliveryPackages {
  const readingSections = bundle.works.flatMap((work) => bundle.units
    .filter((unit) => unit.workId === work.id)
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((unit, index) => createReadingSection(bundle, work.id, unit, index)));

  const quizByIdentity = new Map<string, ContentBundle["quizItems"]>();
  for (const quiz of bundle.quizItems) {
    const key = vocabularyIdentityKey(quiz.surfaceFormId, quiz.senseId);
    const items = quizByIdentity.get(key) ?? [];
    items.push(quiz);
    quizByIdentity.set(key, items);
  }
  const identities = [...quizByIdentity].sort(([a], [b]) => a.localeCompare(b));
  const quizBatches: QuizBatchPackage[] = [];
  const quizBatchForIdentity: Record<string, number> = {};
  const identityLocations: DeliveryManifest["identityLocations"] = {};
  for (const section of readingSections) {
    for (const occurrence of section.occurrences) {
      const key = vocabularyIdentityKey(occurrence.surfaceFormId, occurrence.senseId);
      const locations = identityLocations[key] ?? [];
      if (!locations.some((location) => location.workId === section.workId && location.sectionIndex === section.index)) {
        locations.push({ workId: section.workId, sectionIndex: section.index });
      }
      identityLocations[key] = locations;
    }
  }
  for (let offset = 0; offset < identities.length; offset += QUIZ_BATCH_SIZE) {
    const group = identities.slice(offset, offset + QUIZ_BATCH_SIZE);
    const index = quizBatches.length;
    for (const [key] of group) quizBatchForIdentity[key] = index;
    quizBatches.push({ index, identityKeys: group.map(([key]) => key), quizItems: group.flatMap(([, items]) => items) });
  }
  return {
    manifest: {
      version: 1,
      readingSectionSize: READING_SECTION_SIZE,
      quizBatchSize: QUIZ_BATCH_SIZE,
      quizPrefetchRemaining: QUIZ_PREFETCH_REMAINING,
      catalog: { authors: bundle.authors, collections: bundle.collections, books: bundle.books, works: bundle.works },
      expressionCatalog,
      works: Object.fromEntries(bundle.works.map((work) => [work.id, {
        sectionCount: readingSections.filter((section) => section.workId === work.id).length,
      }])),
      quizBatchForIdentity,
      identityLocations,
    },
    readingSections,
    quizBatches,
  };
}

function createReadingSection(bundle: ContentBundle, workId: string, unit: Unit, index: number): ReadingSectionPackage {
  const occurrences = bundle.occurrences.filter((occurrence) => occurrence.unitId === unit.id);
  const surfaceIds = new Set(occurrences.map((occurrence) => occurrence.surfaceFormId));
  const senseIds = new Set(occurrences.map((occurrence) => occurrence.senseId));
  const lemmaIds = new Set([
    ...bundle.surfaceForms.filter((surface) => surfaceIds.has(surface.id)).map((surface) => surface.lemmaId),
    ...bundle.senses.filter((sense) => senseIds.has(sense.id)).map((sense) => sense.lemmaId),
  ]);
  return {
    workId,
    index,
    unit,
    occurrences,
    lemmas: bundle.lemmas.filter((lemma) => lemmaIds.has(lemma.id)),
    senses: bundle.senses.filter((sense) => senseIds.has(sense.id)),
    surfaceForms: bundle.surfaceForms.filter((surface) => surfaceIds.has(surface.id)),
    expressions: bundle.expressions.filter((expression) => expression.unitId === unit.id),
    notes: bundle.notes.filter((note) => note.workId === workId && (note.unitId === undefined || note.unitId === unit.id)),
  };
}

/** Returns at most ten due identities and never duplicates an identity within a batch. */
export function nextQuizIdentityBatch(dueIdentityKeys: readonly string[], consumed: ReadonlySet<string>): string[] {
  return [...new Set(dueIdentityKeys)].filter((key) => !consumed.has(key)).slice(0, QUIZ_BATCH_SIZE);
}

export function shouldPrefetchNextQuizBatch(remaining: number): boolean {
  return remaining <= QUIZ_PREFETCH_REMAINING;
}
