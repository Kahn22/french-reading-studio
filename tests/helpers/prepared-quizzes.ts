import type { ContentBundle } from "../../src/domain/model.js";

const identity = { surfaceFormId: "srf_fromage", senseId: "sns_fromage_food" } as const;

export const preparedFromageQuizSet: ContentBundle["quizItems"] = [
  { id: "qiz_fromage_1", ...identity, masteryLevel: 1, format: "meaning_choice", contextFrench: "Elle achète du fromage au marché.", targetText: "fromage", prompt: "Meaning", choicesEnglish: ["cheese", "bread", "fruit", "milk"], correctAnswer: "cheese" },
  { id: "qiz_fromage_2", ...identity, masteryLevel: 2, format: "meaning_choice", contextFrench: "Ce fromage a une odeur forte.", targetText: "fromage", prompt: "Meaning", choicesEnglish: ["cheese", "sauce", "meat", "cake"], correctAnswer: "cheese" },
  { id: "qiz_fromage_3", ...identity, masteryLevel: 3, format: "meaning_choice", contextFrench: "Nous partageons un fromage après le repas.", targetText: "fromage", prompt: "Meaning", choicesEnglish: ["cheese", "dessert", "plate", "drink"], correctAnswer: "cheese" },
  { id: "qiz_fromage_4", ...identity, masteryLevel: 4, format: "surface_completion", contextFrench: "Il pose le ___ sur la table.", choicesFrench: ["fromage", "fromages", "fromager", "formage"], correctAnswer: "fromage" },
  { id: "qiz_fromage_5", ...identity, masteryLevel: 5, format: "comprehension_choice", contextFrench: "Léa coupe le fromage en petits morceaux.", targetText: "fromage", promptFrench: "Que coupe Léa ?", choicesEnglish: ["cheese", "paper", "wood", "fabric"], correctAnswer: "cheese" },
  { id: "qiz_fromage_6", ...identity, masteryLevel: 6, format: "target_identification", contextFrench: "Le pain, le fromage, la pomme et l’eau sont sur la table.", promptFrench: "Quel mot désigne un aliment fait avec du lait ?", choicesFrench: ["pain", "fromage", "pomme", "eau"], correctAnswer: "fromage" },
  { id: "qiz_fromage_7", ...identity, masteryLevel: 7, format: "target_identification", contextFrench: "Paul range le beurre, le fromage, le jus et le raisin dans le réfrigérateur.", promptFrench: "Quel mot désigne ici le produit laitier solide ?", choicesFrench: ["beurre", "fromage", "jus", "raisin"], correctAnswer: "fromage" },
  { id: "qiz_fromage_8", ...identity, masteryLevel: 8, format: "target_identification", contextFrench: "À la fin du repas, le serveur propose du café, une poire, du fromage et une tisane.", promptFrench: "Quel mot désigne l’aliment obtenu par transformation du lait ?", choicesFrench: ["café", "poire", "fromage", "tisane"], correctAnswer: "fromage" },
];
