import { describe, expect, it } from "vitest";
import { clampMastery, orderedChoices, vocabularyKey } from "../src/app/state.js";

describe("prototype learner state", () => {
  it("uses surface form plus sense as the mastery identity", () => {
    expect(vocabularyKey("srf_tint", "sns_tenir_primary")).toBe("srf_tint:sns_tenir_primary");
  });
  it("keeps mastery inside the eight-level interface", () => {
    expect(clampMastery(0)).toBe(1); expect(clampMastery(9)).toBe(8);
  });
  it("orders prepared choices deterministically without changing their content", () => {
    const choices = ["correct", "second", "third", "fourth"];
    expect(orderedChoices(choices, "qiz_example_01")).toEqual(orderedChoices(choices, "qiz_example_01"));
    expect(new Set(orderedChoices(choices, "qiz_example_01"))).toEqual(new Set(choices));
    expect(choices).toEqual(["correct", "second", "third", "fourth"]);
  });
});
