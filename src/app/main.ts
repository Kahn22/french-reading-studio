import "./styles.css";
import { answerReview, claimReview, createEncounter, createReviewSession, isDue, isVocabularyLearnerState, type ReviewClaim, type VocabularyLearnerStateRecord } from "../learner/scheduler.js";
import { quizBandForMasteryLevel } from "../domain/model.js";
import { expressionMasteryKey, type ExpressionCatalog } from "../domain/expression-content.js";
import { bundle, contentLoader, expressionCatalog, initializeAppShell, loadQuizForIdentity, loadReadingSection, manifest } from "./app-shell.js";
import { parseRoute, routeHash, type AppRoute } from "./routes.js";
import { clampMastery, isQuizEligibleLibraryStatus, libraryStatusFor, orderedChoices, parseReadingLibraryState, shouldUnderlineVocabulary, vocabularyKey, withLibraryStatus, type LibraryStatus, type ReadingLibraryState } from "./state.js";

const storageKey = "french-reading-studio:learner-state:v2";
const legacyStorageKey = "french-reading-studio:mastery:v1";
const demoSessionKey = "french-reading-studio:demo-session:v1";
const readingLibraryStorageKey = "french-reading-studio:reading-library:v1";
let visibleWorks: typeof bundle.works = [];
let visibleWorkIds = new Set<string>();
let readableWorkIds = new Set<string>();
let quizEligibleWorkIds = new Set<string>();
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<main class="home"><section class="auth-card" aria-live="polite"><p class="eyebrow">French Reading Studio</p><h1>Opening your library…</h1></section></main>`;

type Occurrence = (typeof bundle.occurrences)[number];
type QuizItem = (typeof bundle.quizItems)[number];
type ExpressionQuiz = ExpressionCatalog["preparedQuizzes"][number];

let learnerState = loadLearnerState();
let readingLibraryState = loadReadingLibraryState();
let demoSignedIn = readDemoSession();
let currentRoute: AppRoute = parseRoute(location.hash);
let selectedOccurrence: Occurrence | undefined;
let selectedExpressionId: string | undefined;
let selectedAnswer: string | undefined;
let activeQuiz: QuizItem | ExpressionQuiz | undefined;
let activeClaim: ReviewClaim | undefined;
let reviewSession: ReviewClaim[] | undefined;
let reviewBacklog: ReviewClaim[] = [];
let reviewPrefetch: Promise<void> | undefined;
let reviewSessionIndex = 0;
let reviewScopeWorkId: string | undefined;
let reviewReturnRoute: AppRoute = { name: "library" };
let readerSectionIndex = 0;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function parsedJson(key: string): unknown {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? undefined : JSON.parse(stored);
  } catch { return undefined; }
}

function loadLearnerState(): VocabularyLearnerStateRecord {
  const current = parsedJson(storageKey);
  if (current && typeof current === "object" && !Array.isArray(current)) {
    return Object.fromEntries(Object.entries(current).filter((entry) => isVocabularyLearnerState(entry[1])));
  }
  const legacy = parsedJson(legacyStorageKey);
  if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) return {};
  const dueNow = new Date().toISOString();
  return Object.fromEntries(Object.entries(legacy).flatMap(([key, value]) => typeof value === "number" && Number.isFinite(value)
    ? [[key, { masteryLevel: clampMastery(value), nextDueAt: dueNow, obligation: "scheduled" as const, revision: 0 }]] : []));
}

function saveLearnerState() {
  try { localStorage.setItem(storageKey, JSON.stringify(learnerState)); } catch { /* Private browsing may prevent persistence. */ }
}

function loadReadingLibraryState(): ReadingLibraryState {
  return parseReadingLibraryState(parsedJson(readingLibraryStorageKey));
}

function refreshLibraryAccess() {
  readableWorkIds = new Set(visibleWorks.filter((work) => libraryStatusFor(readingLibraryState, work.id) === "reading").map((work) => work.id));
  quizEligibleWorkIds = new Set(visibleWorks.filter((work) => isQuizEligibleLibraryStatus(libraryStatusFor(readingLibraryState, work.id))).map((work) => work.id));
}

function setLibraryStatus(workId: string, status: LibraryStatus) {
  readingLibraryState = withLibraryStatus(readingLibraryState, workId, status);
  refreshLibraryAccess();
  try { localStorage.setItem(readingLibraryStorageKey, JSON.stringify(readingLibraryState)); } catch { /* Preview state may be unavailable in private browsing. */ }
}

function readDemoSession() {
  try { return sessionStorage.getItem(demoSessionKey) === "active"; } catch { return false; }
}

function setDemoSession(active: boolean) {
  demoSignedIn = active;
  try {
    if (active) sessionStorage.setItem(demoSessionKey, "active");
    else sessionStorage.removeItem(demoSessionKey);
  } catch { /* This flag is only a disposable preview convenience. */ }
}

const identityFor = (occurrence: Occurrence) => vocabularyKey(occurrence.surfaceFormId, occurrence.senseId);

function initializeSectionEncounters(workId: string, unitId: string, occurrences: readonly Occurrence[], encounteredAt: Date) {
  let changed = false;
  for (const occurrence of occurrences) {
    const key = identityFor(occurrence);
    if (learnerState[key]) continue;
    learnerState[key] = createEncounter(encounteredAt, true);
    changed = true;
  }
  for (const expressionId of new Set(expressionCatalog.occurrences
    .filter((item) => item.workId === workId && item.unitId === unitId)
    .map((item) => item.identityId))) {
    const key = expressionMasteryKey(expressionId);
    if (learnerState[key]) continue;
    learnerState[key] = createEncounter(encounteredAt, true);
    changed = true;
  }
  if (changed) saveLearnerState();
}

const surfaceFor = (occurrence: Occurrence) => bundle.surfaceForms.find((item) => item.id === occurrence.surfaceFormId)!;
const senseFor = (occurrence: Occurrence) => bundle.senses.find((item) => item.id === occurrence.senseId)!;
const lemmaFor = (occurrence: Occurrence) => bundle.lemmas.find((item) => item.id === surfaceFor(occurrence).lemmaId)!;

function quizFor(occurrence: Occurrence): QuizItem {
  const level = learnerState[identityFor(occurrence)]?.masteryLevel ?? 1;
  const quiz = bundle.quizItems.find((item) => item.surfaceFormId === occurrence.surfaceFormId && item.senseId === occurrence.senseId && item.band === quizBandForMasteryLevel(level));
  if (!quiz) throw new Error(`Missing prepared quiz for ${identityFor(occurrence)} at level ${level}`);
  return quiz;
}

async function occurrenceForIdentity(identity: string, preferredWorkId?: string) {
  const locations = manifest.identityLocations[identity]?.filter((location) => quizEligibleWorkIds.has(location.workId)) ?? [];
  const location = locations.find((item) => item.workId === preferredWorkId) ?? locations[0];
  if (!location) return undefined;
  await loadReadingSection(location.workId, location.sectionIndex);
  return bundle.occurrences.find((occurrence) => identityFor(occurrence) === identity && occurrence.workId === location.workId);
}

function actionableClaims(workId?: string, at = new Date()) {
  return createReviewSession(learnerState, at).filter((claim) => {
    if (claim.vocabularyIdentity.startsWith("expression:")) {
      const expressionId = claim.vocabularyIdentity.slice("expression:".length);
      return expressionCatalog.occurrences.some((item) => item.identityId === expressionId && quizEligibleWorkIds.has(item.workId) && (!workId || item.workId === workId));
    }
    const locations = manifest.identityLocations[claim.vocabularyIdentity] ?? [];
    return locations.some((location) => quizEligibleWorkIds.has(location.workId) && (!workId || location.workId === workId));
  });
}

const dueCount = (workId?: string) => actionableClaims(workId).length;

function unencounteredVocabularyCount(workId: string) {
  return Object.entries(manifest.identityLocations).filter(([identity, locations]) => !learnerState[identity] && locations.some((location) => location.workId === workId)).length;
}

function formattedDue(occurrence: Occurrence) {
  return formattedDueState(learnerState[identityFor(occurrence)]!);
}

function formattedDueState(state: VocabularyLearnerStateRecord[string]) {
  if (isDue(state, new Date())) return state.obligation === "accelerated" ? "Révision accélérée disponible" : "Révision disponible";
  const value = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(state.nextDueAt));
  return `Prochaine révision : ${value}`;
}

function workMetadata(workId: string) {
  const work = bundle.works.find((item) => item.id === workId)!;
  const book = bundle.books.find((item) => item.id === work.bookId)!;
  const collection = bundle.collections.find((item) => item.id === book.collectionId)!;
  const author = bundle.authors.find((item) => item.id === collection.authorId)!;
  return { work, book, collection, author };
}

function navigation() {
  return `<nav class="topbar" aria-label="Main navigation"><button class="brand" type="button" data-route="#/library">French Reading Studio</button><button class="text-button" type="button" data-action="sign-out">Sign out</button></nav>`;
}

function renderHome() {
  const returning = demoSignedIn ? `<button class="primary" type="button" data-route="#/library">Return to your texts</button>` : "";
  app.innerHTML = `<main class="home"><section class="home-intro"><p class="eyebrow">French Reading Studio</p><h1>Read the language<br>in its literature.</h1><p class="lede">Authentic public-domain French texts with prepared vocabulary practice and spaced review.</p>${returning}</section>
    <section class="auth-card" aria-labelledby="sign-in-title"><p class="eyebrow">Learner account</p><h2 id="sign-in-title">Sign in</h2><form><label for="email">Email</label><input id="email" type="email" autocomplete="username" disabled><label for="password">Password</label><input id="password" type="password" autocomplete="current-password" minlength="15" disabled><button class="primary wide" type="submit" disabled>Sign in</button></form>
    <p class="auth-note">Secure accounts will be connected after the hosting and authentication decision. No credentials are collected by this preview.</p><button class="secondary wide" type="button" data-action="start-demo">Preview learner account</button><div class="auth-links"><button type="button" disabled>Create account</button><button type="button" disabled>Forgot password?</button></div></section></main>`;
}

function renderTextCard(work: (typeof bundle.works)[number], status: LibraryStatus) {
  const { collection, author } = workMetadata(work.id);
  const unencountered = unencounteredVocabularyCount(work.id);
  const metadata = `<p class="card-meta">${escapeHtml(author.name)} · ${escapeHtml(collection.title)}</p><h3>${escapeHtml(work.title)}</h3><span class="unencountered-count">${unencountered} ${unencountered === 1 ? "unencountered word" : "unencountered words"}</span>`;
  const textDue = dueCount(work.id);
  if (status === "available") return `<article class="text-card">${metadata}<div class="card-actions"><button class="primary" type="button" data-action="start-reading" data-work-id="${escapeHtml(work.id)}">Start reading</button><span>Available</span></div></article>`;
  if (status === "completed") return `<article class="text-card completed-card">${metadata}<div class="card-actions"><button class="secondary" type="button" data-action="start-reading" data-work-id="${escapeHtml(work.id)}">Read again</button><span><strong data-due-count data-scope="${escapeHtml(work.id)}">${textDue}</strong> due</span></div><button class="review-button card-review" type="button" data-action="start-review-text" data-work-id="${escapeHtml(work.id)}" ${textDue === 0 ? "disabled" : ""}>Review due words and expressions</button></article>`;
  return `<article class="text-card reading-card">${metadata}<div class="card-actions"><button class="primary" type="button" data-route="#/read/${escapeHtml(work.id)}">Continue reading</button><span><strong data-due-count data-scope="${escapeHtml(work.id)}">${textDue}</strong> due</span></div><div class="card-management"><button class="text-button" type="button" data-action="stop-reading" data-work-id="${escapeHtml(work.id)}">Move to available</button><button class="text-button complete-action" type="button" data-action="mark-completed" data-work-id="${escapeHtml(work.id)}">Mark completed</button></div></article>`;
}

function renderLibrary() {
  const totalDue = dueCount();
  const easiestFirst = (works: typeof visibleWorks) => [...works].sort((a, b) => unencounteredVocabularyCount(a.id) - unencounteredVocabularyCount(b.id) || a.title.localeCompare(b.title, "fr"));
  const reading = easiestFirst(visibleWorks.filter((work) => libraryStatusFor(readingLibraryState, work.id) === "reading"));
  const available = easiestFirst(visibleWorks.filter((work) => libraryStatusFor(readingLibraryState, work.id) === "available"));
  const completed = easiestFirst(visibleWorks.filter((work) => libraryStatusFor(readingLibraryState, work.id) === "completed"));
  const shelf = (id: string, eyebrow: string, title: string, works: typeof visibleWorks, empty: string) => `<section class="library-shelf" aria-labelledby="${id}"><div class="section-heading"><div><p class="eyebrow">${eyebrow}</p><h2 id="${id}">${title}</h2></div><span>${works.length}</span></div>${works.length ? `<div class="text-grid">${works.map((work) => renderTextCard(work, libraryStatusFor(readingLibraryState, work.id))).join("")}</div>` : `<p class="empty-shelf">${empty}</p>`}</section>`;
  app.innerHTML = `${navigation()}<div class="page library-page"><header class="library-header"><div><p class="eyebrow">Learner home</p><h1>Your library</h1><p class="lede">Mark any available text as Reading to open it and activate its vocabulary and expression reviews.</p></div>
    <button class="review-hero" type="button" data-action="start-review-all" ${totalDue === 0 ? "disabled" : ""}><span>Review all due items</span><strong data-due-count data-scope="all">${totalDue}</strong><small>${totalDue === 1 ? "word or expression due" : "words or expressions due"}</small></button></header>
    ${shelf("reading-title", "Active shelf", "Reading", reading, "No texts are marked as Reading.")}
    ${shelf("available-title", "Library", "Available texts", available, "Every available text is currently in your Reading or Completed list.")}
    ${shelf("completed-title", "Your history", "Completed texts", completed, "Completed texts will appear here.")}
    <p class="preview-notice">Preview account · Library status and progress are saved only in this browser.</p></div>`;
}

function renderUnitFrench(unit: (typeof bundle.units)[number], occurrences: Occurrence[]) {
  const unitOccurrences = occurrences.filter((item) => item.unitId === unit.id).sort((a, b) => a.start - b.start);
  let cursor = 0;
  let html = "";
  for (const occurrence of unitOccurrences) {
    html += escapeHtml(unit.french.slice(cursor, occurrence.start));
    const text = unit.french.slice(occurrence.start, occurrence.end);
    const masteryLevel = learnerState[identityFor(occurrence)]?.masteryLevel ?? 1;
    const className = shouldUnderlineVocabulary(masteryLevel) ? "word learning-word" : "word";
    html += `<button class="${className}" type="button" data-occurrence-id="${escapeHtml(occurrence.id)}" aria-label="Étudier ${escapeHtml(text)}">${escapeHtml(text)}</button>`;
    cursor = occurrence.end;
  }
  return html + escapeHtml(unit.french.slice(cursor));
}

async function renderText(workId: string) {
  const metadata = workMetadata(workId);
  const sectionCount = manifest.works[workId]?.sectionCount ?? 0;
  readerSectionIndex = Math.max(0, Math.min(readerSectionIndex, Math.max(0, sectionCount - 1)));
  const section = await loadReadingSection(workId, readerSectionIndex);
  const units = [section.unit];
  const occurrences = section.occurrences;
  const sectionExpressionIds = new Set(expressionCatalog.occurrences.filter((item) => item.workId === workId && item.unitId === section.unit.id).map((item) => item.identityId));
  const sectionExpressions = expressionCatalog.identities.filter((item) => sectionExpressionIds.has(item.id));
  initializeSectionEncounters(workId, section.unit.id, occurrences, new Date());
  contentLoader.preloadNextSection(workId, readerSectionIndex, sectionCount);
  const textDue = dueCount(workId);
  app.innerHTML = `${navigation()}<div class="page reader-page"><button class="back" type="button" data-route="#/library">← Your library</button><header><p class="eyebrow">${escapeHtml(metadata.author.name)} · ${escapeHtml(metadata.collection.title)} · Livre ${metadata.book.ordinal} · Texte ${metadata.work.ordinal}</p><h1>${escapeHtml(metadata.work.title)}</h1><p class="lede">Texte français authentique · Touchez un mot souligné pour l’étudier.</p>
    <div class="reader-actions"><button class="review-button" type="button" data-action="start-review-text" data-work-id="${escapeHtml(workId)}" ${textDue === 0 ? "disabled" : ""}>Réviser les mots et expressions de ce texte <span class="due-pill" data-due-count data-scope="${escapeHtml(workId)}">${textDue}</span></button><button class="text-button complete-action" type="button" data-action="mark-completed" data-work-id="${escapeHtml(workId)}">Mark completed</button></div></header>
    <main class="text-units" aria-label="Texte français">${units.map((unit) => `<article class="unit"><span class="number" aria-hidden="true">${unit.ordinal}</span><p class="french">${renderUnitFrench(unit, occurrences)}</p></article>`).join("")}</main>
    ${sectionExpressions.length ? `<section class="expression-panel" aria-labelledby="expressions-title"><p class="eyebrow">Expressions dans cette section</p><h2 id="expressions-title">Expressions préparées</h2><div class="expression-list">${sectionExpressions.map((identity) => `<button class="secondary" type="button" data-expression-id="${escapeHtml(identity.id)}">${escapeHtml(identity.headword)} · ${escapeHtml(identity.gloss)}</button>`).join("")}</div></section>` : ""}
    <footer class="reading-checkpoint"><p>Section ${readerSectionIndex + 1} sur ${sectionCount}</p><div><button class="secondary" type="button" data-action="previous-section" ${readerSectionIndex === 0 ? "disabled" : ""}>← Précédente</button> <button class="primary" type="button" data-action="next-section" ${readerSectionIndex + 1 >= sectionCount ? "disabled" : ""}>Suivante →</button></div></footer></div>`;
}

function renderVocabularySheet(occurrence: Occurrence) {
  selectedOccurrence = occurrence;
  activeQuiz = undefined;
  const surface = surfaceFor(occurrence), sense = senseFor(occurrence), lemma = lemmaFor(occurrence);
  const state = learnerState[identityFor(occurrence)]!;
  const due = isDue(state, new Date());
  app.insertAdjacentHTML("beforeend", `<div class="scrim" data-action="close-sheet"></div><aside class="sheet" aria-modal="true" role="dialog" aria-labelledby="vocabulary-title"><button class="close" type="button" data-action="close-sheet" aria-label="Fermer">×</button><p class="eyebrow">Vocabulaire · Niveau ${state.masteryLevel} sur 8</p><h2 id="vocabulary-title">${escapeHtml(surface.form)}</h2><dl><div><dt>Lemme</dt><dd>${escapeHtml(lemma.headword)}</dd></div><div><dt>Sens ici</dt><dd>${escapeHtml(sense.gloss)}</dd></div><div><dt>Catégorie</dt><dd>${escapeHtml(lemma.partOfSpeech)}</dd></div></dl><p class="schedule-status">${escapeHtml(formattedDue(occurrence))}</p><button class="primary" type="button" data-action="start-quiz" ${due ? "" : "disabled"}>${state.obligation === "accelerated" ? "Faire la révision accélérée" : "Réviser ce mot"}</button></aside>`);
  document.querySelector<HTMLButtonElement>(".sheet .close")?.focus();
}

function renderExpressionSheet(expressionId: string) {
  const identity = expressionCatalog.identities.find((item) => item.id === expressionId);
  const state = learnerState[expressionMasteryKey(expressionId)];
  if (!identity || !state) return;
  selectedExpressionId = expressionId;
  selectedOccurrence = undefined;
  activeQuiz = undefined;
  const due = isDue(state, new Date());
  app.insertAdjacentHTML("beforeend", `<div class="scrim" data-action="close-sheet"></div><aside class="sheet" aria-modal="true" role="dialog" aria-labelledby="expression-title"><button class="close" type="button" data-action="close-sheet" aria-label="Fermer">×</button><p class="eyebrow">Expression · Niveau ${state.masteryLevel} sur 8</p><h2 id="expression-title">${escapeHtml(identity.headword)}</h2><dl><div><dt>Sens</dt><dd>${escapeHtml(identity.gloss)}</dd></div><div><dt>Définition</dt><dd>${escapeHtml(identity.definition)}</dd></div></dl><p class="schedule-status">${escapeHtml(formattedDueState(state))}</p><button class="primary" type="button" data-action="start-expression-quiz" ${due ? "" : "disabled"}>${state.obligation === "accelerated" ? "Faire la révision accélérée" : "Réviser cette expression"}</button></aside>`);
  document.querySelector<HTMLButtonElement>(".sheet .close")?.focus();
}

function highlightedContext(context: string, target: string) {
  const index = context.toLocaleLowerCase("fr-FR").indexOf(target.toLocaleLowerCase("fr-FR"));
  if (index < 0) return escapeHtml(context);
  return `${escapeHtml(context.slice(0, index))}<mark>${escapeHtml(context.slice(index, index + target.length))}</mark>${escapeHtml(context.slice(index + target.length))}`;
}

function quizPresentation(quiz: QuizItem | ExpressionQuiz) {
  if (quiz.format === "meaning_choice") return { context: highlightedContext(quiz.contextFrench, quiz.targetText), prompt: "Meaning", choices: quiz.choicesEnglish };
  if (quiz.format === "surface_completion") return { context: escapeHtml(quiz.contextFrench), prompt: "Complétez la phrase.", choices: quiz.choicesFrench };
  return { context: escapeHtml(quiz.contextFrench), prompt: quiz.promptFrench, choices: quiz.choicesFrench };
}

function renderQuiz() {
  if ((!selectedOccurrence && !selectedExpressionId) || !activeQuiz) return finishReview();
  const quiz = activeQuiz;
  const identityKey = selectedOccurrence ? identityFor(selectedOccurrence) : expressionMasteryKey(selectedExpressionId!);
  const label = selectedOccurrence ? surfaceFor(selectedOccurrence).form : expressionCatalog.identities.find((item) => item.id === selectedExpressionId)?.headword ?? selectedExpressionId!;
  const presentation = quizPresentation(quiz), choices = orderedChoices([...presentation.choices], quiz.id);
  const answered = selectedAnswer !== undefined, correct = selectedAnswer === quiz.correctAnswer;
  const state = learnerState[identityKey]!;
  const progress = reviewSession ? `${Math.min(reviewSessionIndex + 1, reviewSession.length)} sur ${reviewSession.length}` : "";
  const mode = reviewScopeWorkId ? "Révision de ce texte" : "Révision générale";
  app.innerHTML = `<section class="quiz" aria-labelledby="quiz-prompt"><button class="back" type="button" data-action="end-review">← Terminer la révision</button><p class="eyebrow">${mode} · ${progress}</p><p class="quiz-level">${escapeHtml(label)} · Niveau ${state.masteryLevel} sur 8</p><p class="quiz-context" lang="fr">${presentation.context}</p><h2 id="quiz-prompt">${escapeHtml(presentation.prompt)}</h2><div class="quiz-choices">${choices.map((choice) => {
    const resultClass = answered && choice === quiz.correctAnswer ? " correct" : answered && choice === selectedAnswer ? " incorrect" : "";
    return `<button type="button" class="choice${resultClass}" data-answer="${escapeHtml(choice)}" ${answered ? "disabled" : ""}>${escapeHtml(choice)}</button>`;
  }).join("")}</div>${answered ? `<div class="feedback ${correct ? "success" : "retry"}" role="status"><strong>${correct ? "Correct !" : "Pas encore."}</strong><span>${activeClaim?.obligation === "accelerated" ? `Le niveau reste à ${state.masteryLevel}. La programmation normale reprend.` : correct ? `Le niveau de maîtrise passe à ${state.masteryLevel}.` : `Réponse correcte : ${escapeHtml(quiz.correctAnswer)} · Niveau ${state.masteryLevel}.`}</span><span>${escapeHtml(formattedDueState(state))}</span></div><button class="primary continue" type="button" data-action="continue-quiz">Continuer</button>` : ""}</section>`;
}

function closeSheet() {
  document.querySelector(".scrim")?.remove(); document.querySelector(".sheet")?.remove();
  selectedOccurrence = undefined; selectedExpressionId = undefined; activeQuiz = undefined; activeClaim = undefined;
}

async function startClaim(claim: ReviewClaim): Promise<boolean> {
  const state = learnerState[claim.vocabularyIdentity];
  if (!state || !isDue(state, new Date()) || state.revision !== claim.expectedRevision || state.nextDueAt !== claim.dueAt || state.obligation !== claim.obligation) return false;
  if (claim.vocabularyIdentity.startsWith("expression:")) {
    const expressionId = claim.vocabularyIdentity.slice("expression:".length);
    const occurrence = expressionCatalog.occurrences.find((item) => item.identityId === expressionId && quizEligibleWorkIds.has(item.workId) && (!reviewScopeWorkId || item.workId === reviewScopeWorkId));
    if (!occurrence) return false;
    activeQuiz = expressionCatalog.preparedQuizzes.find((item) => item.expressionId === expressionId && item.band === quizBandForMasteryLevel(state.masteryLevel));
    if (!activeQuiz) return false;
    selectedExpressionId = expressionId; selectedOccurrence = undefined; selectedAnswer = undefined; activeClaim = claim; renderQuiz(); return true;
  }
  const occurrence = await occurrenceForIdentity(claim.vocabularyIdentity, reviewScopeWorkId);
  if (!occurrence) return false;
  await loadQuizForIdentity(claim.vocabularyIdentity);
  try { activeQuiz = quizFor(occurrence); } catch { return false; }
  selectedOccurrence = occurrence; selectedExpressionId = undefined; selectedAnswer = undefined; activeClaim = claim; renderQuiz(); return true;
}

async function beginReview(workId?: string, singleClaim?: ReviewClaim) {
  reviewScopeWorkId = workId;
  reviewReturnRoute = workId ? { name: "read", workId } : { name: "library" };
  const claims = singleClaim ? [singleClaim] : actionableClaims(workId);
  reviewSession = claims.slice(0, 10);
  reviewBacklog = claims.slice(10);
  reviewPrefetch = undefined;
  reviewSessionIndex = 0;
  if (!reviewSession[0] || !(await startClaim(reviewSession[0]))) await continueReviewSession();
}

async function continueReviewSession() {
  if (!reviewSession) return finishReview();
  reviewSessionIndex += 1;
  if (reviewSession.length - reviewSessionIndex <= manifest.quizPrefetchRemaining && reviewBacklog.length && !reviewPrefetch) {
    const nextClaims = reviewBacklog.slice(0, manifest.quizBatchSize);
    reviewPrefetch = Promise.all(nextClaims.filter((claim) => !claim.vocabularyIdentity.startsWith("expression:")).map((claim) => loadQuizForIdentity(claim.vocabularyIdentity))).then(() => undefined);
  }
  while (reviewSessionIndex < reviewSession.length) {
    if (await startClaim(reviewSession[reviewSessionIndex]!)) return;
    reviewSessionIndex += 1;
  }
  if (reviewBacklog.length) {
    await reviewPrefetch;
    reviewSession = reviewBacklog.splice(0, manifest.quizBatchSize);
    reviewSessionIndex = 0;
    reviewPrefetch = undefined;
    if (reviewSession[0] && await startClaim(reviewSession[0])) return;
    return continueReviewSession();
  }
  finishReview();
}

function finishReview() {
  reviewSession = undefined; reviewBacklog = []; reviewPrefetch = undefined; selectedOccurrence = undefined; selectedExpressionId = undefined; selectedAnswer = undefined; activeQuiz = undefined; activeClaim = undefined;
  go(reviewReturnRoute);
}

function go(route: AppRoute) {
  const next = routeHash(route);
  if (location.hash === next) renderCurrentRoute(); else location.hash = next;
}

function resetTransientUi() {
  selectedOccurrence = undefined; selectedExpressionId = undefined; selectedAnswer = undefined; activeQuiz = undefined; activeClaim = undefined; reviewSession = undefined; reviewBacklog = []; reviewPrefetch = undefined;
}

async function renderCurrentRoute() {
  currentRoute = parseRoute(location.hash); resetTransientUi();
  if (currentRoute.name !== "home" && !demoSignedIn) {
    currentRoute = { name: "home" };
    if (location.hash !== "#/") history.replaceState(null, "", "#/");
  }
  if (currentRoute.name === "library") return renderLibrary();
  if (currentRoute.name === "read" && readableWorkIds.has(currentRoute.workId)) return renderText(currentRoute.workId);
  renderHome();
}

app.addEventListener("click", async (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-occurrence-id], [data-expression-id], [data-route], [data-action], [data-answer]");
  if (!target) return;
  if (target.dataset.route) { if (target.dataset.route.startsWith("#/read/")) readerSectionIndex = 0; location.hash = target.dataset.route; return; }
  if (target.dataset.occurrenceId) {
    const occurrence = bundle.occurrences.find((item) => item.id === target.dataset.occurrenceId);
    if (occurrence) renderVocabularySheet(occurrence);
    return;
  }
  if (target.dataset.expressionId && currentRoute.name === "read") {
    renderExpressionSheet(target.dataset.expressionId);
    return;
  }
  const action = target.dataset.action;
  if (action === "start-demo") { setDemoSession(true); go({ name: "library" }); return; }
  if (action === "sign-out") { setDemoSession(false); go({ name: "home" }); return; }
  if (action === "close-sheet") { closeSheet(); return; }
  if (action === "start-review-all") { await beginReview(); return; }
  if (action === "start-reading") {
    const workId = target.dataset.workId;
    if (workId && visibleWorkIds.has(workId)) { setLibraryStatus(workId, "reading"); readerSectionIndex = 0; go({ name: "read", workId }); }
    return;
  }
  if (action === "mark-completed") {
    const workId = target.dataset.workId;
    if (workId && visibleWorkIds.has(workId)) { setLibraryStatus(workId, "completed"); go({ name: "library" }); }
    return;
  }
  if (action === "stop-reading") {
    const workId = target.dataset.workId;
    if (workId && readableWorkIds.has(workId)) {
      const count = dueCount(workId);
      if (count > 0 && !window.confirm(`${count} due ${count === 1 ? "item" : "items"} will leave active review until you mark this text as Reading again. Your progress will be preserved.`)) return;
      setLibraryStatus(workId, "available"); renderLibrary();
    }
    return;
  }
  if (action === "start-review-text") {
    const workId = target.dataset.workId;
    if (workId && quizEligibleWorkIds.has(workId)) await beginReview(workId);
    return;
  }
  if (action === "start-quiz" && selectedOccurrence) {
    const state = learnerState[identityFor(selectedOccurrence)]!;
    if (isDue(state, new Date())) await beginReview(selectedOccurrence.workId, claimReview(identityFor(selectedOccurrence), state));
    return;
  }
  if (action === "start-expression-quiz" && selectedExpressionId) {
    const key = expressionMasteryKey(selectedExpressionId);
    const state = learnerState[key];
    if (state && isDue(state, new Date())) await beginReview(currentRoute.name === "read" ? currentRoute.workId : undefined, claimReview(key, state));
    return;
  }
  if (action === "continue-quiz") { await continueReviewSession(); return; }
  if (action === "previous-section" && currentRoute.name === "read") { readerSectionIndex -= 1; await renderText(currentRoute.workId); return; }
  if (action === "next-section" && currentRoute.name === "read") { readerSectionIndex += 1; await renderText(currentRoute.workId); return; }
  if (action === "end-review") { finishReview(); return; }
  const answer = target.dataset.answer;
  if (answer === undefined || (!selectedOccurrence && !selectedExpressionId) || !activeQuiz || !activeClaim || selectedAnswer !== undefined) return;
  const key = selectedOccurrence ? identityFor(selectedOccurrence) : expressionMasteryKey(selectedExpressionId!);
  const state = learnerState[key];
  if (!state) return;
  try { learnerState[key] = answerReview(key, state, activeClaim, answer === activeQuiz.correctAnswer, new Date()); } catch { return; }
  saveLearnerState(); selectedAnswer = answer; renderQuiz();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (document.querySelector(".sheet")) closeSheet(); else if (document.querySelector(".quiz")) finishReview();
});

window.addEventListener("hashchange", () => { void renderCurrentRoute(); });
window.setInterval(() => {
  for (const counter of document.querySelectorAll<HTMLElement>("[data-due-count][data-scope]")) {
    const count = dueCount(counter.dataset.scope === "all" ? undefined : counter.dataset.scope);
    counter.textContent = String(count);
    const button = counter.closest<HTMLButtonElement>("button");
    if (button) button.disabled = count === 0;
  }
}, 30_000);

try {
  await initializeAppShell();
  visibleWorks = bundle.works.filter((work) => ["learning_ready", "published"].includes(work.publicationState));
  visibleWorkIds = new Set(visibleWorks.map((work) => work.id));
  refreshLibraryAccess();
  await renderCurrentRoute();
} catch (error) {
  console.error("French Reading Studio could not load its prepared content.", error);
  app.innerHTML = `<main class="home"><section class="auth-card" role="alert"><p class="eyebrow">French Reading Studio</p><h1>The library could not open.</h1><p class="auth-note">Refresh this page to try loading the prepared reading content again.</p></section></main>`;
}
