import { describe, expect, it } from "vitest";
import { appBundle, appExpressionCatalog } from "../src/app/content.js";
import { createDeliveryPackages, nextQuizIdentityBatch, shouldPrefetchNextQuizBatch } from "../src/delivery/content-packages.js";

describe("incremental learner content delivery", () => {
  it("packages each displayed thought unit with only its referenced linguistic data", () => {
    const packages = createDeliveryPackages(appBundle, appExpressionCatalog);
    const section = packages.readingSections.find((item) => item.workId === "wrk_corbeau_renard" && item.index === 0)!;
    expect(section.unit.ordinal).toBe(1);
    expect(section.occurrences.every((item) => item.unitId === section.unit.id)).toBe(true);
    expect(new Set(section.surfaceForms.map((item) => item.id))).toEqual(new Set(section.occurrences.map((item) => item.surfaceFormId)));
    expect(section.lemmas.length).toBeLessThan(appBundle.lemmas.length);
  });

  it("stores three prepared questions per identity in deterministic ten-identity shards", () => {
    const first = createDeliveryPackages(appBundle, appExpressionCatalog);
    const second = createDeliveryPackages(appBundle, appExpressionCatalog);
    expect(first).toEqual(second);
    expect(first.quizBatches.every((batch) => batch.identityKeys.length <= 10)).toBe(true);
    expect(first.quizBatches.every((batch) => batch.quizItems.length === batch.identityKeys.length * 3)).toBe(true);
    expect(Object.keys(first.manifest.quizBatchForIdentity)).toHaveLength(2810);
    expect(first.manifest.expressionCatalog.identities).toHaveLength(39);
    expect(first.manifest.expressionCatalog.preparedQuizzes).toHaveLength(117);
  });

  it("queues no more than ten unique questions and prefetches when three remain", () => {
    expect(nextQuizIdentityBatch(["a", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"], new Set(["b"]))).toEqual(["a", "c", "d", "e", "f", "g", "h", "i", "j", "k"]);
    expect(shouldPrefetchNextQuizBatch(4)).toBe(false);
    expect(shouldPrefetchNextQuizBatch(3)).toBe(true);
  });
});
