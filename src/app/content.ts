import rawBundle from "../../content/learning/jaccuse.json" with { type: "json" };
import rawExpressionCatalog from "../../content/learning/jaccuse-expressions.json" with { type: "json" };
import type { ContentBundle } from "../domain/model.js";
import type { ExpressionCatalog } from "../domain/expression-content.js";

/** The latest validated learning bundle contains every learner-ready work. */
export const appBundle = rawBundle as unknown as ContentBundle;
export const appExpressionCatalog = rawExpressionCatalog as unknown as ExpressionCatalog;

export const appVisibleWorks = appBundle.works.filter((work) =>
  ["learning_ready", "published"].includes(work.publicationState),
);
