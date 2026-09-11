import { describe, expect, it } from "vitest";
import { advanceMastery, clampMastery, vocabularyKey } from "../src/app/state.js";

describe("prototype learner state", () => {
  it("uses surface form plus sense as the mastery identity", () => {
    expect(vocabularyKey("srf_tint", "sns_tenir_primary")).toBe("srf_tint:sns_tenir_primary");
  });
  it("keeps mastery inside the eight-level interface", () => {
    expect(clampMastery(0)).toBe(1); expect(clampMastery(9)).toBe(8);
    expect(advanceMastery(7, true)).toBe(8); expect(advanceMastery(6, false)).toBe(1);
  });
});
