import type { ContentBundle } from "../../domain/model.js";
import { vocabularyIdentityKey } from "../../domain/model.js";

export type AuthoredQuizSpec = {
  key: string; surfaceFormId: string; senseId: string; target: string; meaning: string;
  early: [[string,string[]],[string,string[]],[string,string[]]];
  blank: [string,string[]]; comprehension: [string,string,string[],string];
  advanced: [[string,string,string[]],[string,string,string[]],[string,string,string[]]];
};

export function authoredSet(s: AuthoredQuizSpec): ContentBundle["quizItems"] {
  const contexts = [...s.early.map(x => x[0]), s.blank[0], s.comprehension[0], ...s.advanced.map(x => x[0])];
  if (new Set(contexts).size !== 8) throw new Error(`${s.key}: all eight contexts must be distinct`);
  const first = s.early.map(([contextFrench, distractors], index) => ({ id:`qiz_${s.key}_0${index+1}`, surfaceFormId:s.surfaceFormId, senseId:s.senseId, masteryLevel:(index+1) as 1|2|3, format:"meaning_choice" as const, contextFrench, targetText:s.target, prompt:"Meaning" as const, choicesEnglish:[s.meaning,...distractors], correctAnswer:s.meaning }));
  const later = s.advanced.map(([contextFrench,promptFrench,choicesFrench], index) => ({ id:`qiz_${s.key}_0${index+6}`, surfaceFormId:s.surfaceFormId, senseId:s.senseId, masteryLevel:(index+6) as 6|7|8, format:"target_identification" as const, contextFrench, promptFrench, choicesFrench, correctAnswer:choicesFrench.find(choice => choice.toLocaleLowerCase("fr-FR") === s.target.toLocaleLowerCase("fr-FR")) ?? s.target }));
  return [...first,
    { id:`qiz_${s.key}_04`,surfaceFormId:s.surfaceFormId,senseId:s.senseId,masteryLevel:4,format:"surface_completion",contextFrench:s.blank[0],choicesFrench:s.blank[1],correctAnswer:s.target },
    { id:`qiz_${s.key}_05`,surfaceFormId:s.surfaceFormId,senseId:s.senseId,masteryLevel:5,format:"comprehension_choice",contextFrench:s.comprehension[0],targetText:s.target,promptFrench:s.comprehension[1],choicesEnglish:s.comprehension[2],correctAnswer:s.comprehension[3] },
    ...later];
}

export function quizCoverageForWork(bundle: ContentBundle, workId: string) {
  const required = new Set(bundle.occurrences.filter(x => x.workId === workId).map(x => vocabularyIdentityKey(x.surfaceFormId,x.senseId)));
  const levels = new Map<string,Set<number>>();
  for (const q of bundle.quizItems) { const key=vocabularyIdentityKey(q.surfaceFormId,q.senseId); const set=levels.get(key)??new Set<number>(); set.add(q.masteryLevel); levels.set(key,set); }
  const completed=[...required].filter(key => levels.get(key)?.size===8).sort();
  const missing=[...required].filter(key => levels.get(key)?.size!==8).sort();
  return { requiredIdentities:required.size, completedIdentities:completed.length, preparedItems:bundle.quizItems.length, completed, missing };
}
