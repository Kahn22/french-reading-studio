import type { ContentBundle } from "../domain/model.js";
import type { ExpressionCatalog } from "../domain/expression-content.js";
import { createDeliveryPackages, type DeliveryManifest, type ReadingSectionPackage } from "../delivery/content-packages.js";
import { appBundle, appExpressionCatalog } from "./content.js";
import { ContentLoader } from "./content-loader.js";

const embedsPreparedContent = import.meta.env.VITE_EMBED_CONTENT;
const contentBaseUrl = import.meta.env.DEV
  ? `${import.meta.env.BASE_URL}content`
  : new URL("../content/", import.meta.url).href;

export const contentLoader = new ContentLoader(contentBaseUrl);
export let manifest: DeliveryManifest;
export const expressionCatalog: ExpressionCatalog = embedsPreparedContent
  ? appExpressionCatalog
  : { identities: [], occurrences: [], preparedQuizzes: [] };
export const bundle: ContentBundle = embedsPreparedContent ? appBundle : {
  authors: [], collections: [], books: [], works: [], sources: [], units: [], lemmas: [], senses: [], surfaceForms: [],
  occurrences: [], exclusions: [], expressions: [], notes: [], quizItems: [], readiness: [],
};
const embeddedPackages = embedsPreparedContent ? createDeliveryPackages(bundle, expressionCatalog) : undefined;

export async function initializeAppShell(): Promise<void> {
  if (embeddedPackages) {
    manifest = embeddedPackages.manifest;
    return;
  }
  manifest = await contentLoader.manifest();
  Object.assign(bundle, manifest.catalog);
  Object.assign(expressionCatalog, manifest.expressionCatalog);
}

export async function loadReadingSection(workId: string, index: number): Promise<ReadingSectionPackage> {
  const section = embeddedPackages?.readingSections.find((item) => item.workId === workId && item.index === index)
    ?? await contentLoader.section(workId, index);
  mergeById(bundle.units, section.units);
  mergeById(bundle.occurrences, section.occurrences);
  mergeById(bundle.lemmas, section.lemmas);
  mergeById(bundle.senses, section.senses);
  mergeById(bundle.surfaceForms, section.surfaceForms);
  mergeById(bundle.expressions, section.expressions);
  mergeById(bundle.notes, section.notes);
  return section;
}

export async function loadQuizForIdentity(identity: string): Promise<void> {
  if (embeddedPackages) return;
  const index = manifest.quizBatchForIdentity[identity];
  if (index === undefined) return;
  const batch = await contentLoader.quizBatch(index);
  mergeById(bundle.quizItems, batch.quizItems);
}

function mergeById<T extends { id: string }>(target: T[], additions: readonly T[]): void {
  const existing = new Set(target.map((item) => item.id));
  for (const item of additions) if (!existing.has(item.id)) { target.push(item); existing.add(item.id); }
}
