import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import rawBundle from "../../content/learning/jaccuse.json" with { type: "json" };
import rawExpressionCatalog from "../../content/learning/jaccuse-expressions.json" with { type: "json" };
import { createDeliveryPackages } from "../delivery/content-packages.js";
import type { ContentBundle } from "../domain/model.js";
import type { ExpressionCatalog } from "../domain/expression-content.js";

const root = resolve(import.meta.dirname, "../..");
const output = resolve(root, "public/content");
const packages = createDeliveryPackages(rawBundle as unknown as ContentBundle, rawExpressionCatalog as unknown as ExpressionCatalog);

rmSync(output, { recursive: true, force: true });
mkdirSync(resolve(output, "reading"), { recursive: true });
mkdirSync(resolve(output, "quizzes"), { recursive: true });
write("manifest.json", packages.manifest);
for (const section of packages.readingSections) write(`reading/${section.workId}-${String(section.index).padStart(2, "0")}.json`, section);
for (const batch of packages.quizBatches) write(`quizzes/${String(batch.index).padStart(2, "0")}.json`, batch);

function write(relativePath: string, value: unknown): void {
  writeFileSync(resolve(output, relativePath), `${JSON.stringify(value)}\n`, "utf8");
}

console.log(`written ${packages.readingSections.length} reading sections and ${packages.quizBatches.length} quiz batches`);
