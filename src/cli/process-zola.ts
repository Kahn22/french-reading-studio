import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { assembleZolaDraft } from "../content/preparation/zola-bundle.js";
import { zolaSourceAcquisition } from "../content/fixtures/zola.js";
import { createZolaPreparedExpressionCatalog } from "../content/preparation/zola-prepared-expressions.js";
import { prepareIngestionManifest, serializeManifest } from "../ingestion/prepare.js";
import { runAutonomousPublicationPipeline } from "../pipeline/run.js";

const root = resolve(import.meta.dirname, "../..");
const output = resolve(root, "content/pipeline/wrk_zola_jaccuse");
const learningOutput = resolve(root, "content/learning");
const review = JSON.parse(readFileSync(resolve(root, "content/review/wrk_zola_jaccuse.exclusions.json"), "utf8"));
const draft = assembleZolaDraft(prepareIngestionManifest(zolaSourceAcquisition, "wrk_zola_jaccuse"), review);
const expressionCatalog = createZolaPreparedExpressionCatalog();
const result = await runAutonomousPublicationPipeline(zolaSourceAcquisition, {
  workId: "wrk_zola_jaccuse",
  publicDomainEvidence: { publicationYear: 1898, basis: "us_publication_before_1931" },
  preparedContent: {
    bundle: draft,
    expressionCatalog,
    authoring: { method: "codex_offline_review", canonicalWordingPreserved: true, distractorsCheckedForAmbiguity: true },
  },
});
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, "lexical-manifest.json"), serializeManifest(result.manifest), "utf8");
writeFileSync(resolve(output, "pipeline-report.json"), `${JSON.stringify(result.report, null, 2)}\n`, "utf8");
if (result.report.outcome !== "published" || !result.expressionCatalog) throw new Error(`J’Accuse publication pipeline did not complete: ${result.report.diagnostics[0]?.code ?? "unknown"}`);
mkdirSync(learningOutput, { recursive: true });
writeFileSync(resolve(learningOutput, "jaccuse.json"), `${JSON.stringify(result.bundle)}\n`, "utf8");
writeFileSync(resolve(learningOutput, "jaccuse-expressions.json"), `${JSON.stringify(result.expressionCatalog)}\n`, "utf8");
console.log(`${result.report.outcome}: ${result.report.diagnostics[0]?.code ?? "published"}`);
