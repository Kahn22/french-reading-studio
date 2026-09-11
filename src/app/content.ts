import rawBundle from "../../content/learning/le-lievre-et-la-tortue.json" with { type: "json" };
import type { ContentBundle } from "../domain/model.js";

/** The latest validated learning bundle contains every learner-ready work. */
export const appBundle = rawBundle as ContentBundle;

export const appVisibleWorks = appBundle.works.filter((work) =>
  ["learning_ready", "published"].includes(work.publicationState),
);
