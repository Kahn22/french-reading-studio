import { ContentBundleSchema, type ContentBundle, vocabularyIdentityKey } from "./model.js";

export interface Diagnostic { code: string; path: string; message: string }
export interface ValidationResult { ok: boolean; diagnostics: Diagnostic[] }

const readyStates = new Set(["learning_ready", "published"]);

export function validateContentBundle(input: unknown): ValidationResult {
  const parsed = ContentBundleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, diagnostics: parsed.error.issues.map((i) => ({
      code: "schema.invalid", path: i.path.join("."), message: i.message,
    })).sort(byDiagnostic) };
  }
  const b = parsed.data;
  const diagnostics: Diagnostic[] = [];
  uniqueIds(b, diagnostics);
  const authors = ids(b.authors), collections = ids(b.collections), books = ids(b.books), works = ids(b.works);
  const units = ids(b.units), lemmas = ids(b.lemmas), senses = ids(b.senses), surfaces = ids(b.surfaceForms);
  b.collections.forEach((x) => reference(authors, x.authorId, `collections.${x.id}.authorId`, diagnostics));
  b.books.forEach((x) => reference(collections, x.collectionId, `books.${x.id}.collectionId`, diagnostics));
  b.works.forEach((x) => reference(books, x.bookId, `works.${x.id}.bookId`, diagnostics));
  b.sources.forEach((x) => reference(works, x.workId, `sources.${x.workId}.workId`, diagnostics));
  b.units.forEach((x) => reference(works, x.workId, `units.${x.id}.workId`, diagnostics));
  b.senses.forEach((x) => reference(lemmas, x.lemmaId, `senses.${x.id}.lemmaId`, diagnostics));
  b.surfaceForms.forEach((x) => reference(lemmas, x.lemmaId, `surfaceForms.${x.id}.lemmaId`, diagnostics));
  const senseById = new Map(b.senses.map((x) => [x.id, x]));
  const surfaceById = new Map(b.surfaceForms.map((x) => [x.id, x]));
  const quizKeys = new Set(b.quizItems.map((x) => vocabularyIdentityKey(x.surfaceFormId, x.senseId)));
  for (const occurrence of b.occurrences) {
    reference(works, occurrence.workId, `occurrences.${occurrence.id}.workId`, diagnostics);
    reference(units, occurrence.unitId, `occurrences.${occurrence.id}.unitId`, diagnostics);
    const unit = b.units.find((x) => x.id === occurrence.unitId);
    if (unit && unit.workId !== occurrence.workId) add(diagnostics, "occurrence.work_mismatch", `occurrences.${occurrence.id}`, "Occurrence and unit must belong to the same work");
    const sense = senseById.get(occurrence.senseId), surface = surfaceById.get(occurrence.surfaceFormId);
    if (!sense) reference(senses, occurrence.senseId, `occurrences.${occurrence.id}.senseId`, diagnostics);
    if (!surface) reference(surfaces, occurrence.surfaceFormId, `occurrences.${occurrence.id}.surfaceFormId`, diagnostics);
    if (sense && surface && sense.lemmaId !== surface.lemmaId) add(diagnostics, "vocabulary.lemma_mismatch", `occurrences.${occurrence.id}`, "Surface form and sense must belong to the same lemma");
    if (unit && (occurrence.end > unit.french.length || occurrence.start >= occurrence.end)) add(diagnostics, "occurrence.invalid_span", `occurrences.${occurrence.id}`, "Occurrence span must be inside its thought unit");
  }
  for (const quiz of b.quizItems) {
    const sense = senseById.get(quiz.senseId), surface = surfaceById.get(quiz.surfaceFormId);
    if (!sense) reference(senses, quiz.senseId, `quizItems.${quiz.id}.senseId`, diagnostics);
    if (!surface) reference(surfaces, quiz.surfaceFormId, `quizItems.${quiz.id}.surfaceFormId`, diagnostics);
    if (sense && surface && sense.lemmaId !== surface.lemmaId) add(diagnostics, "vocabulary.lemma_mismatch", `quizItems.${quiz.id}`, "Surface form and sense must belong to the same lemma");
  }
  for (const work of b.works.filter((x) => readyStates.has(x.publicationState))) {
    const status = b.readiness.find((x) => x.workId === work.id);
    if (!status?.thoughtUnitsComplete || !status.occurrencesReviewed || status.unresolvedLearnerTokens.length) add(diagnostics, "publication.incomplete", `works.${work.id}`, "Learning-ready and published works require complete, reviewed content with no unresolved learner tokens");
    if (!b.sources.some((x) => x.workId === work.id) || !b.units.some((x) => x.workId === work.id)) add(diagnostics, "publication.missing_content", `works.${work.id}`, "Learning-ready and published works require source text and thought units");
    const missingQuiz = b.occurrences.filter((x) => x.workId === work.id).some((x) => !quizKeys.has(vocabularyIdentityKey(x.surfaceFormId, x.senseId)));
    if (missingQuiz) add(diagnostics, "publication.missing_quiz", `works.${work.id}`, "Every vocabulary identity must have prepared quiz content before learner use");
  }
  validateOrdinals(b.books, "collectionId", diagnostics);
  validateOrdinals(b.works, "bookId", diagnostics);
  validateOrdinals(b.units, "workId", diagnostics);
  return { ok: diagnostics.length === 0, diagnostics: diagnostics.sort(byDiagnostic) };
}

function ids(items: { id: string }[]): Set<string> { return new Set(items.map((x) => x.id)); }
function add(items: Diagnostic[], code: string, path: string, message: string): void { items.push({ code, path, message }); }
function reference(values: Set<string>, value: string, path: string, diagnostics: Diagnostic[]): void {
  if (!values.has(value)) add(diagnostics, "reference.missing", path, `Unknown reference: ${value}`);
}
function byDiagnostic(a: Diagnostic, b: Diagnostic): number {
  return a.path.localeCompare(b.path) || a.code.localeCompare(b.code) || a.message.localeCompare(b.message);
}
function uniqueIds(bundle: ContentBundle, diagnostics: Diagnostic[]): void {
  const groups = [bundle.authors, bundle.collections, bundle.books, bundle.works, bundle.units, bundle.lemmas,
    bundle.senses, bundle.surfaceForms, bundle.occurrences, bundle.expressions, bundle.notes, bundle.quizItems];
  const seen = new Set<string>();
  for (const item of groups.flat()) {
    if (seen.has(item.id)) add(diagnostics, "id.duplicate", item.id, "Stable IDs must be globally unique");
    seen.add(item.id);
  }
}
function validateOrdinals<T extends { id: string; ordinal: number }>(items: T[], parentKey: keyof T, diagnostics: Diagnostic[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${String(item[parentKey])}:${item.ordinal}`;
    if (seen.has(key)) add(diagnostics, "ordinal.duplicate", item.id, "Ordinals must be unique within their parent");
    seen.add(key);
  }
}
