import { describe, expect, it } from "vitest";
import { corbeauLearningBundle, createCorbeauLearningBundle } from "../src/content/linguistic/le-corbeau-et-le-renard.js";
import { isVocabularyIdentityLearnerPublished, learnerVocabularyForWork } from "../src/domain/publication.js";
import { validateContentBundle } from "../src/domain/validate.js";

describe("Le Corbeau et le Renard learning package", () => {
  it("is deterministic and mechanically learning-ready", () => {
    expect(createCorbeauLearningBundle()).toEqual(corbeauLearningBundle);
    expect(validateContentBundle(corbeauLearningBundle)).toEqual({ ok: true, diagnostics: [] });
    expect(corbeauLearningBundle.works.find((work) => work.id === "wrk_corbeau_renard")?.publicationState).toBe("learning_ready");
  });
  it("contains all eleven bilingual units", () => {
    const units = corbeauLearningBundle.units.filter((unit) => unit.workId === "wrk_corbeau_renard");
    expect(units).toHaveLength(11); expect(units.every((unit) => Boolean(unit.english))).toBe(true);
  });
  it("classifies every canonical token exactly once", () => {
    expect(corbeauLearningBundle.occurrences.length + corbeauLearningBundle.exclusions.length).toBe(131);
    expect(corbeauLearningBundle.occurrences).toHaveLength(122); expect(corbeauLearningBundle.exclusions).toHaveLength(9);
  });
  it("prepares all eight mastery levels for every vocabulary identity", () => {
    expect(corbeauLearningBundle.surfaceForms).toHaveLength(91);
    expect(corbeauLearningBundle.quizItems).toHaveLength(91 * 8);
    for (const form of corbeauLearningBundle.surfaceForms) {
      const sense = corbeauLearningBundle.senses.find((item) => item.lemmaId === form.lemmaId)!;
      expect(isVocabularyIdentityLearnerPublished(corbeauLearningBundle, form.id, sense.id)).toBe(true);
      expect(new Set(corbeauLearningBundle.quizItems.filter((quiz) => quiz.surfaceFormId === form.id && quiz.senseId === sense.id).map((quiz) => quiz.masteryLevel))).toEqual(new Set([1,2,3,4,5,6,7,8]));
    }
    expect(learnerVocabularyForWork(corbeauLearningBundle, "wrk_corbeau_renard")).toHaveLength(91);
  });
  it("keeps proper names out of learner vocabulary", () => {
    expect(new Set(corbeauLearningBundle.exclusions.map((item) => item.text.toLocaleLowerCase("fr-FR")))).toEqual(new Set(["corbeau", "renard", "monsieur", "phénix"]));
  });
});
