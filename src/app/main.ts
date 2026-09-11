import "./styles.css";
import { answerReview, claimReview, createEncounter, createReviewSession, isDue, isVocabularyLearnerState, type ReviewClaim, type VocabularyLearnerStateRecord } from "../learner/scheduler.js";
import { appBundle as bundle, appVisibleWorks as visibleWorks } from "./content.js";
import { parseRoute, routeHash, type AppRoute } from "./routes.js";
import { clampMastery, orderedChoices, vocabularyKey } from "./state.js";

const storageKey = "french-reading-studio:learner-state:v2";
const legacyStorageKey = "french-reading-studio:mastery:v1";
const demoSessionKey = "french-reading-studio:demo-session:v1";
const visibleWorkIds = new Set(visibleWorks.map((work) => work.id));
const app = document.querySelector<HTMLDivElement>("#app")!;

type Occurrence = (typeof bundle.occurrences)[number];
type QuizItem = (typeof bundle.quizItems)[number];

let learnerState = loadLearnerState();
let demoSignedIn = readDemoSession();
let currentRoute: AppRoute = parseRoute(location.hash);
let selectedOccurrence: Occurrence | undefined;
let selectedAnswer: string | undefined;
let activeQuiz: QuizItem | undefined;
let activeClaim: ReviewClaim | undefined;
let reviewSession: ReviewClaim[] | undefined;
let reviewSessionIndex = 0;
let reviewScopeWorkId: string | undefined;
let reviewReturnRoute: AppRoute = { name: "library" };

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
const occurrencesForWork = (workId: string) => bundle.occurrences.filter((occurrence) => occurrence.workId === workId);

function initializeEncounters(workId: string, encounteredAt: Date) {
  let changed = false;
  for (const occurrence of occurrencesForWork(workId)) {
    const key = identityFor(occurrence);
    if (learnerState[key]) continue;
    learnerState[key] = createEncounter(encounteredAt);
    changed = true;
  }
  if (changed) saveLearnerState();
}

const surfaceFor = (occurrence: Occurrence) => bundle.surfaceForms.find((item) => item.id === occurrence.surfaceFormId)!;
const senseFor = (occurrence: Occurrence) => bundle.senses.find((item) => item.id === occurrence.senseId)!;
const lemmaFor = (occurrence: Occurrence) => bundle.lemmas.find((item) => item.id === surfaceFor(occurrence).lemmaId)!;

function quizFor(occurrence: Occurrence): QuizItem {
  const level = learnerState[identityFor(occurrence)]?.masteryLevel ?? 1;
  const quiz = bundle.quizItems.find((item) => item.surfaceFormId === occurrence.surfaceFormId && item.senseId === occurrence.senseId && item.masteryLevel === level);
  if (!quiz) throw new Error(`Missing prepared quiz for ${identityFor(occurrence)} at level ${level}`);
  return quiz;
}

function occurrenceForIdentity(identity: string, preferredWorkId?: string) {
  const matches = bundle.occurrences.filter((occurrence) => identityFor(occurrence) === identity && visibleWorkIds.has(occurrence.workId));
  return matches.find((occurrence) => occurrence.workId === preferredWorkId) ?? matches[0];
}

function actionableClaims(workId?: string, at = new Date()) {
  return createReviewSession(learnerState, at).filter((claim) => {
    const occurrence = occurrenceForIdentity(claim.vocabularyIdentity, workId);
    if (!occurrence || (workId && occurrence.workId !== workId)) return false;
    try { quizFor(occurrence); return true; } catch { return false; }
  });
}

const dueCount = (workId?: string) => actionableClaims(workId).length;

function formattedDue(occurrence: Occurrence) {
  const state = learnerState[identityFor(occurrence)]!;
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

function renderLibrary() {
  const totalDue = dueCount();
  app.innerHTML = `${navigation()}<div class="page library-page"><header class="library-header"><div><p class="eyebrow">Learner home</p><h1>Your texts</h1><p class="lede">Choose a text to read, or review vocabulary due across your library.</p></div>
    <button class="review-hero" type="button" data-action="start-review-all" ${totalDue === 0 ? "disabled" : ""}><span>Review all due vocabulary</span><strong data-due-count data-scope="all">${totalDue}</strong><small>${totalDue === 1 ? "item due" : "items due"}</small></button></header>
    <section aria-labelledby="available-title"><div class="section-heading"><div><p class="eyebrow">Library</p><h2 id="available-title">Available texts</h2></div><span>${visibleWorks.length} available</span></div><div class="text-grid">${visibleWorks.map((work) => {
      const { book, collection, author } = workMetadata(work.id);
      const textDue = dueCount(work.id);
      return `<article class="text-card"><p class="card-meta">${escapeHtml(author.name)} · ${escapeHtml(collection.title)}</p><h3>${escapeHtml(work.title)}</h3><p>Livre ${book.ordinal} · Fable ${work.ordinal}</p><div class="card-actions"><button class="primary" type="button" data-route="#/read/${escapeHtml(work.id)}">Read text</button><span><strong data-due-count data-scope="${escapeHtml(work.id)}">${textDue}</strong> due</span></div></article>`;
    }).join("")}</div></section><p class="preview-notice">Preview account · Progress is saved only in this browser.</p></div>`;
}

function renderUnitFrench(unit: (typeof bundle.units)[number], occurrences: Occurrence[]) {
  const unitOccurrences = occurrences.filter((item) => item.unitId === unit.id).sort((a, b) => a.start - b.start);
  let cursor = 0;
  let html = "";
  for (const occurrence of unitOccurrences) {
    html += escapeHtml(unit.french.slice(cursor, occurrence.start));
    const text = unit.french.slice(occurrence.start, occurrence.end);
    html += `<button class="word" type="button" data-occurrence-id="${escapeHtml(occurrence.id)}" aria-label="Étudier ${escapeHtml(text)}">${escapeHtml(text)}</button>`;
    cursor = occurrence.end;
  }
  return html + escapeHtml(unit.french.slice(cursor));
}

function renderText(workId: string) {
  const metadata = workMetadata(workId);
  const units = bundle.units.filter((unit) => unit.workId === workId).sort((a, b) => a.ordinal - b.ordinal);
  const occurrences = occurrencesForWork(workId);
  initializeEncounters(workId, new Date());
  const textDue = dueCount(workId);
  app.innerHTML = `${navigation()}<div class="page reader-page"><button class="back" type="button" data-route="#/library">← Your texts</button><header><p class="eyebrow">${escapeHtml(metadata.author.name)} · ${escapeHtml(metadata.collection.title)} · Livre ${metadata.book.ordinal} · Fable ${metadata.work.ordinal}</p><h1>${escapeHtml(metadata.work.title)}</h1><p class="lede">Texte français authentique · Touchez un mot souligné pour l’étudier.</p>
    <button class="review-button" type="button" data-action="start-review-text" data-work-id="${escapeHtml(workId)}" ${textDue === 0 ? "disabled" : ""}>Réviser le vocabulaire de ce texte <span class="due-pill" data-due-count data-scope="${escapeHtml(workId)}">${textDue}</span></button></header>
    <main class="text-units" aria-label="Texte de la fable">${units.map((unit) => `<article class="unit"><span class="number" aria-hidden="true">${unit.ordinal}</span><p class="french">${renderUnitFrench(unit, occurrences)}</p></article>`).join("")}</main>
    <footer class="reading-checkpoint"><p>Fin du texte</p><button class="review-button" type="button" data-action="start-review-text" data-work-id="${escapeHtml(workId)}" ${textDue === 0 ? "disabled" : ""}>Réviser les éléments dus <span class="due-pill">${textDue}</span></button></footer></div>`;
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

function highlightedContext(context: string, target: string) {
  const index = context.toLocaleLowerCase("fr-FR").indexOf(target.toLocaleLowerCase("fr-FR"));
  if (index < 0) return escapeHtml(context);
  return `${escapeHtml(context.slice(0, index))}<mark>${escapeHtml(context.slice(index, index + target.length))}</mark>${escapeHtml(context.slice(index + target.length))}`;
}

function quizPresentation(quiz: QuizItem) {
  if (quiz.format === "meaning_choice") return { context: highlightedContext(quiz.contextFrench, quiz.targetText), prompt: "Meaning", choices: quiz.choicesEnglish };
  if (quiz.format === "surface_completion") return { context: escapeHtml(quiz.contextFrench), prompt: "Complétez la phrase.", choices: quiz.choicesFrench };
  if (quiz.format === "comprehension_choice") return { context: highlightedContext(quiz.contextFrench, quiz.targetText), prompt: quiz.promptFrench, choices: quiz.choicesEnglish };
  return { context: escapeHtml(quiz.contextFrench), prompt: quiz.promptFrench, choices: quiz.choicesFrench };
}

function renderQuiz() {
  if (!selectedOccurrence || !activeQuiz) return finishReview();
  const occurrence = selectedOccurrence, surface = surfaceFor(occurrence), quiz = activeQuiz;
  const presentation = quizPresentation(quiz), choices = orderedChoices([...presentation.choices], quiz.id);
  const answered = selectedAnswer !== undefined, correct = selectedAnswer === quiz.correctAnswer;
  const state = learnerState[identityFor(occurrence)]!;
  const progress = reviewSession ? `${Math.min(reviewSessionIndex + 1, reviewSession.length)} sur ${reviewSession.length}` : "";
  const mode = reviewScopeWorkId ? "Révision de ce texte" : "Révision générale";
  app.innerHTML = `<section class="quiz" aria-labelledby="quiz-prompt"><button class="back" type="button" data-action="end-review">← Terminer la révision</button><p class="eyebrow">${mode} · ${progress}</p><p class="quiz-level">${escapeHtml(surface.form)} · Niveau ${quiz.masteryLevel} sur 8</p><p class="quiz-context" lang="fr">${presentation.context}</p><h2 id="quiz-prompt">${escapeHtml(presentation.prompt)}</h2><div class="quiz-choices">${choices.map((choice) => {
    const resultClass = answered && choice === quiz.correctAnswer ? " correct" : answered && choice === selectedAnswer ? " incorrect" : "";
    return `<button type="button" class="choice${resultClass}" data-answer="${escapeHtml(choice)}" ${answered ? "disabled" : ""}>${escapeHtml(choice)}</button>`;
  }).join("")}</div>${answered ? `<div class="feedback ${correct ? "success" : "retry"}" role="status"><strong>${correct ? "Correct !" : "Pas encore."}</strong><span>${activeClaim?.obligation === "accelerated" ? `Le niveau reste à ${state.masteryLevel}. La programmation normale reprend.` : correct ? `Le niveau de maîtrise passe à ${state.masteryLevel}.` : `Réponse correcte : ${escapeHtml(quiz.correctAnswer)} · Niveau ${state.masteryLevel}.`}</span><span>${escapeHtml(formattedDue(occurrence))}</span></div><button class="primary continue" type="button" data-action="continue-quiz">Continuer</button>` : ""}</section>`;
}

function closeSheet() {
  document.querySelector(".scrim")?.remove(); document.querySelector(".sheet")?.remove();
  selectedOccurrence = undefined; activeQuiz = undefined; activeClaim = undefined;
}

function startClaim(claim: ReviewClaim): boolean {
  const state = learnerState[claim.vocabularyIdentity];
  const occurrence = occurrenceForIdentity(claim.vocabularyIdentity, reviewScopeWorkId);
  if (!state || !occurrence || !isDue(state, new Date()) || state.revision !== claim.expectedRevision || state.nextDueAt !== claim.dueAt || state.obligation !== claim.obligation) return false;
  try { activeQuiz = quizFor(occurrence); } catch { return false; }
  selectedOccurrence = occurrence; selectedAnswer = undefined; activeClaim = claim; renderQuiz(); return true;
}

function beginReview(workId?: string, singleClaim?: ReviewClaim) {
  reviewScopeWorkId = workId;
  reviewReturnRoute = workId ? { name: "read", workId } : { name: "library" };
  reviewSession = singleClaim ? [singleClaim] : actionableClaims(workId);
  reviewSessionIndex = 0;
  if (!reviewSession[0] || !startClaim(reviewSession[0])) continueReviewSession();
}

function continueReviewSession() {
  if (!reviewSession) return finishReview();
  reviewSessionIndex += 1;
  while (reviewSessionIndex < reviewSession.length) {
    if (startClaim(reviewSession[reviewSessionIndex]!)) return;
    reviewSessionIndex += 1;
  }
  finishReview();
}

function finishReview() {
  reviewSession = undefined; selectedOccurrence = undefined; selectedAnswer = undefined; activeQuiz = undefined; activeClaim = undefined;
  go(reviewReturnRoute);
}

function go(route: AppRoute) {
  const next = routeHash(route);
  if (location.hash === next) renderCurrentRoute(); else location.hash = next;
}

function resetTransientUi() {
  selectedOccurrence = undefined; selectedAnswer = undefined; activeQuiz = undefined; activeClaim = undefined; reviewSession = undefined;
}

function renderCurrentRoute() {
  currentRoute = parseRoute(location.hash); resetTransientUi();
  if (currentRoute.name !== "home" && !demoSignedIn) {
    currentRoute = { name: "home" };
    if (location.hash !== "#/") history.replaceState(null, "", "#/");
  }
  if (currentRoute.name === "library") return renderLibrary();
  if (currentRoute.name === "read" && visibleWorkIds.has(currentRoute.workId)) return renderText(currentRoute.workId);
  renderHome();
}

app.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-occurrence-id], [data-route], [data-action], [data-answer]");
  if (!target) return;
  if (target.dataset.route) { location.hash = target.dataset.route; return; }
  if (target.dataset.occurrenceId) {
    const occurrence = bundle.occurrences.find((item) => item.id === target.dataset.occurrenceId);
    if (occurrence) renderVocabularySheet(occurrence);
    return;
  }
  const action = target.dataset.action;
  if (action === "start-demo") { setDemoSession(true); go({ name: "library" }); return; }
  if (action === "sign-out") { setDemoSession(false); go({ name: "home" }); return; }
  if (action === "close-sheet") { closeSheet(); return; }
  if (action === "start-review-all") { beginReview(); return; }
  if (action === "start-review-text") {
    const workId = target.dataset.workId;
    if (workId && visibleWorkIds.has(workId)) beginReview(workId);
    return;
  }
  if (action === "start-quiz" && selectedOccurrence) {
    const state = learnerState[identityFor(selectedOccurrence)]!;
    if (isDue(state, new Date())) beginReview(selectedOccurrence.workId, claimReview(identityFor(selectedOccurrence), state));
    return;
  }
  if (action === "continue-quiz") { continueReviewSession(); return; }
  if (action === "end-review") { finishReview(); return; }
  const answer = target.dataset.answer;
  if (answer === undefined || !selectedOccurrence || !activeQuiz || !activeClaim || selectedAnswer !== undefined) return;
  const key = identityFor(selectedOccurrence), state = learnerState[key];
  if (!state) return;
  try { learnerState[key] = answerReview(key, state, activeClaim, answer === activeQuiz.correctAnswer, new Date()); } catch { return; }
  saveLearnerState(); selectedAnswer = answer; renderQuiz();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (document.querySelector(".sheet")) closeSheet(); else if (document.querySelector(".quiz")) finishReview();
});

window.addEventListener("hashchange", renderCurrentRoute);
window.setInterval(() => {
  for (const counter of document.querySelectorAll<HTMLElement>("[data-due-count][data-scope]")) {
    const count = dueCount(counter.dataset.scope === "all" ? undefined : counter.dataset.scope);
    counter.textContent = String(count);
    const button = counter.closest<HTMLButtonElement>("button");
    if (button) button.disabled = count === 0;
  }
}, 30_000);

renderCurrentRoute();
