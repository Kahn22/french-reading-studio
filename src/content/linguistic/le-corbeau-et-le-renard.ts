import { lafountainFixtures } from "../fixtures/la-fontaine.js";
import type { ContentBundle } from "../../domain/model.js";
import { prepareIngestionManifest } from "../../ingestion/prepare.js";

interface LexemeSpec { lemma: string; partOfSpeech: string; gloss: string }

const specs: Record<string, LexemeSpec> = Object.fromEntries(`
maître|maître|noun|master; title of address
sur|sur|preposition|on
un|un|determiner|a; an
arbre|arbre|noun|tree
perché|percher|verb|perched
tenait|tenir|verb|held
en|en|preposition|in; of it
son|son|determiner|his; its
bec|bec|noun|beak
fromage|fromage|noun|cheese
par|par|preposition|by; through
l’|le|determiner|the (elided form)
odeur|odeur|noun|smell
alléché|allécher|verb|attracted; tempted
lui|lui|pronoun|to him
tint|tenir|verb|spoke; held
à|à|preposition|to; at
peu|peu|adverb|little
près|près|adverb|near
ce|ce|determiner|this
langage|langage|noun|speech; language
hé|hé|interjection|hey
bonjour|bonjour|interjection|hello; good day
du|du|determiner|of the
que|que|function word|that; how; what
vous|vous|pronoun|you
êtes|être|verb|are
joli|joli|adjective|pretty; handsome
me|me|pronoun|to me
semblez|sembler|verb|seem; appear
beau|beau|adjective|beautiful; handsome
sans|sans|preposition|without
mentir|mentir|verb|to lie
si|si|conjunction|if
votre|votre|determiner|your
ramage|ramage|noun|birdsong; voice
se|se|pronoun|oneself
rapporte|rapporter|verb|corresponds; relates
plumage|plumage|noun|plumage; feathers
le|le|determiner|the
des|des|determiner|of the; some
hôtes|hôte|noun|inhabitants; guests
de|de|preposition|of; from
ces|ce|determiner|these
bois|bois|noun|woods
mots|mot|noun|words
ne|ne|adverb|not
sent|sentir|verb|feels
pas|pas|adverb|not
joie|joie|noun|joy
et|et|conjunction|and
pour|pour|preposition|for; in order to
montrer|montrer|verb|to show
sa|son|determiner|his; her; its
belle|beau|adjective|beautiful
voix|voix|noun|voice
il|il|pronoun|he
ouvre|ouvrir|verb|opens
large|large|adjective|wide
laisse|laisser|verb|lets; leaves
tomber|tomber|verb|to fall
proie|proie|noun|prey; prize
s’|se|pronoun|oneself (elided form)
saisit|saisir|verb|grabs; seizes
dit|dire|verb|says
mon|mon|determiner|my
bon|bon|adjective|good
apprenez|apprendre|verb|learn
tout|tout|determiner|every; all
flatteur|flatteur|noun|flatterer
vit|vivre|verb|lives
aux|aux|determiner|to the; at the
dépens|dépens|noun|expense
celui|celui|pronoun|the one
qui|qui|pronoun|who; which
écoute|écouter|verb|listens to
cette|ce|determiner|this
leçon|leçon|noun|lesson
vaut|valoir|verb|is worth
bien|bien|adverb|well; indeed
doute|doute|noun|doubt
honteux|honteux|adjective|ashamed
confus|confus|adjective|embarrassed; confused
jura|jurer|verb|swore
mais|mais|conjunction|but
tard|tard|adverb|late
qu’|que|conjunction|that (elided form)
on|on|pronoun|one; people
y|y|pronoun|there; in it
prendrait|prendre|verb|would catch; would take
plus|plus|adverb|anymore; no longer
`.trim().split("\n").map((line) => { const [form, lemma, partOfSpeech, gloss] = line.split("|"); return [form!, { lemma: lemma!, partOfSpeech: partOfSpeech!, gloss: gloss! }]; }));

const excluded = new Set(["corbeau", "renard", "monsieur", "phénix"]);
const slug = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replaceAll("’", "_elided").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toLowerCase();

export function createCorbeauLearningBundle(): ContentBundle {
  const bundle = structuredClone(lafountainFixtures);
  const manifest = prepareIngestionManifest(bundle, "wrk_corbeau_renard");
  const missing = [...new Set(manifest.candidates.map((candidate) => candidate.normalized))]
    .filter((form) => !excluded.has(form) && !specs[form]);
  if (missing.length) throw new Error(`Missing reviewed lexeme specifications: ${missing.join(", ")}`);

  const learnerCandidates = manifest.candidates.filter((candidate) => !excluded.has(candidate.normalized));
  const forms = [...new Set(learnerCandidates.map((candidate) => candidate.normalized))];
  const lemmaSpecs = new Map(forms.map((form) => [specs[form]!.lemma, specs[form]!]));
  bundle.lemmas = [...lemmaSpecs].map(([lemma, spec]) => ({ id: `lem_${slug(lemma)}`, headword: lemma, partOfSpeech: spec.partOfSpeech }));
  bundle.senses = [...lemmaSpecs].map(([lemma, spec]) => ({ id: `sns_${slug(lemma)}_primary`, lemmaId: `lem_${slug(lemma)}`, gloss: spec.gloss, definition: spec.gloss }));
  bundle.surfaceForms = forms.map((form) => ({ id: `srf_${slug(form)}`, lemmaId: `lem_${slug(specs[form]!.lemma)}`, form: manifest.candidates.find((candidate) => candidate.normalized === form)!.text, normalized: form }));
  bundle.occurrences = learnerCandidates.map((candidate) => ({
    id: `occ_${candidate.id.slice(4)}`, workId: candidate.workId, unitId: candidate.unitId,
    surfaceFormId: `srf_${slug(candidate.normalized)}`, senseId: `sns_${slug(specs[candidate.normalized]!.lemma)}_primary`,
    start: candidate.start, end: candidate.end,
  }));
  bundle.exclusions = manifest.candidates.filter((candidate) => excluded.has(candidate.normalized)).map((candidate) => ({
    id: `exc_${candidate.id.slice(4)}`, workId: candidate.workId, unitId: candidate.unitId,
    start: candidate.start, end: candidate.end, text: candidate.text, reason: "proper_noun" as const,
  }));
  bundle.expressions = [
    { id: "exp_a_peu_pres", workId: "wrk_corbeau_renard", unitId: "unt_corbeau_02", text: "à peu près", gloss: "approximately" },
    { id: "exp_sans_mentir", workId: "wrk_corbeau_renard", unitId: "unt_corbeau_06", text: "Sans mentir", gloss: "truthfully; without lying" },
    { id: "exp_aux_depens_de", workId: "wrk_corbeau_renard", unitId: "unt_corbeau_09", text: "aux dépens de", gloss: "at the expense of" },
    { id: "exp_sans_doute", workId: "wrk_corbeau_renard", unitId: "unt_corbeau_10", text: "sans doute", gloss: "without doubt; certainly" },
    { id: "exp_ne_plus", workId: "wrk_corbeau_renard", unitId: "unt_corbeau_11", text: "ne … plus", gloss: "no longer; not anymore" },
  ];
  bundle.quizItems = forms.flatMap((form) => preparedQuizSet(form, specs[form]!));
  bundle.works.find((work) => work.id === "wrk_corbeau_renard")!.publicationState = "learning_ready";
  bundle.readiness.find((item) => item.workId === "wrk_corbeau_renard")!.occurrencesReviewed = true;
  bundle.readiness.find((item) => item.workId === "wrk_corbeau_renard")!.unresolvedLearnerTokens = [];
  return bundle;
}

function preparedQuizSet(form: string, spec: LexemeSpec) {
  const surfaceFormId = `srf_${slug(form)}`;
  const senseId = `sns_${slug(spec.lemma)}_primary`;
  const prompts = [
    [`What does “${form}” mean?`, spec.gloss, "recognition"],
    [`Recall the French form for: ${spec.gloss}`, form, "production"],
    [`Identify the meaning of “${form}” in La Fontaine's fable.`, spec.gloss, "context"],
    [`Give the dictionary headword associated with “${form}”.`, spec.lemma, "production"],
    [`Translate “${form}” into English.`, spec.gloss, "recognition"],
    [`Produce the exact French surface form meaning: ${spec.gloss}`, form, "production"],
    [`In the canonical passage, what sense does “${form}” carry?`, spec.gloss, "context"],
    [`Mastery check — supply “${form}” from its meaning: ${spec.gloss}`, form, "production"],
  ] as const;
  return prompts.map(([prompt, answer, kind], index) => ({
    id: `qiz_${slug(form)}_${index + 1}`, surfaceFormId, senseId, masteryLevel: index + 1,
    kind, prompt, answer,
  }));
}

export const corbeauLearningBundle = createCorbeauLearningBundle();
