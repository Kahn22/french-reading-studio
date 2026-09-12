import { describe, expect, it } from "vitest";
import { appBundle, appVisibleWorks } from "../src/app/content.js";
import { vocabularyIdentityKey } from "../src/domain/model.js";
import { learnerVocabularyForWork } from "../src/domain/publication.js";
import { validateContentBundle } from "../src/domain/validate.js";

const identitySet = (workId: string) => new Set(
  appBundle.occurrences
    .filter((occurrence) => occurrence.workId === workId)
    .map((occurrence) => vocabularyIdentityKey(occurrence.surfaceFormId, occurrence.senseId)),
);

describe("learner application content", () => {
  it("loads the validated combined learning bundle", () => {
    expect(validateContentBundle(appBundle)).toEqual({ ok: true, diagnostics: [] });
  });

  it("offers both completed fixture fables in canonical collection order", () => {
    expect(appVisibleWorks.map((work) => [work.id, work.title])).toEqual([
      ["wrk_corbeau_renard", "Le Corbeau et le Renard"],
      ["wrk_lievre_tortue", "Le Lièvre et la Tortue"],
    ]);
  });

  it("exposes every prepared identity and shares identities across texts", () => {
    expect(learnerVocabularyForWork(appBundle, "wrk_corbeau_renard")).toHaveLength(98);
    expect(learnerVocabularyForWork(appBundle, "wrk_lievre_tortue")).toHaveLength(174);

    const corbeau = identitySet("wrk_corbeau_renard");
    const lievre = identitySet("wrk_lievre_tortue");
    const shared = [...corbeau].filter((identity) => lievre.has(identity));
    expect(shared).toHaveLength(33);
    expect(shared).toContain("srf_vous:sns_vous_primary");
  });
});
