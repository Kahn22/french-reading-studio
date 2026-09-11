import { describe, expect, it } from "vitest";
import { parseRoute, routeHash } from "../src/app/routes.js";

describe("application routes", () => {
  it("recognizes the public homepage, learner library, and text reader", () => {
    expect(parseRoute("#/")) .toEqual({ name: "home" });
    expect(parseRoute("#/library")).toEqual({ name: "library" });
    expect(parseRoute("#/read/wrk_corbeau_renard")).toEqual({ name: "read", workId: "wrk_corbeau_renard" });
  });

  it("falls back safely instead of accepting malformed paths", () => {
    expect(parseRoute("#/admin")) .toEqual({ name: "home" });
    expect(parseRoute("#/read/../../secret")).toEqual({ name: "home" });
  });

  it("formats stable hash routes for GitHub Pages", () => {
    expect(routeHash({ name: "library" })).toBe("#/library");
    expect(routeHash({ name: "read", workId: "wrk_corbeau_renard" })).toBe("#/read/wrk_corbeau_renard");
  });
});
