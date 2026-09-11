import "./styles.css";
import bundle from "../../content/learning/le-corbeau-et-le-renard.json" with { type: "json" };
import { advanceMastery, vocabularyKey, type MasteryRecord } from "./state.js";

type Occurrence = (typeof bundle.occurrences)[number];
const workId = "wrk_corbeau_renard";
const work = bundle.works.find((item) => item.id === workId)!;
const units = bundle.units.filter((item) => item.workId === workId).sort((a, b) => a.ordinal - b.ordinal);
const forms = new Map(bundle.surfaceForms.map((item) => [item.id, item]));
const senses = new Map(bundle.senses.map((item) => [item.id, item]));
const lemmas = new Map(bundle.lemmas.map((item) => [item.id, item]));
const quizzes = new Map(bundle.quizItems.map((item) => [`${item.surfaceFormId}:${item.senseId}:${item.masteryLevel}`, item]));
const storageKey = "french-reading-studio:mastery:v1";
let mastery = loadMastery();
let selected: Occurrence | undefined;
let quizIdentity: { surfaceFormId: string; senseId: string } | undefined;
let answerVisible = false;

const app = document.querySelector<HTMLDivElement>("#app")!;

function loadMastery(): MasteryRecord {
  try { return JSON.parse(localStorage.getItem(storageKey) ?? "{}"); } catch { return {}; }
}
function saveMastery() { localStorage.setItem(storageKey, JSON.stringify(mastery)); }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!); }

function renderText(unitId: string, text: string) {
  const occurrences = bundle.occurrences.filter((item) => item.unitId === unitId).sort((a, b) => a.start - b.start);
  let cursor = 0; let html = "";
  for (const item of occurrences) {
    html += escapeHtml(text.slice(cursor, item.start));
    html += `<button class="word" data-occurrence="${item.id}">${escapeHtml(text.slice(item.start, item.end))}</button>`;
    cursor = item.end;
  }
  return html + escapeHtml(text.slice(cursor));
}

function readerView() {
  return `<header><p class="eyebrow">Jean de La Fontaine · Fables · Livre I, II</p><h1>${escapeHtml(work.title)}</h1><p class="lede">Tap any underlined word to explore its meaning.</p></header>
  <main>${units.map((unit) => `<article class="unit"><div><span class="number">${unit.ordinal}</span><p class="french">${renderText(unit.id, unit.french)}</p></div><p class="english">${escapeHtml(unit.english ?? "")}</p></article>`).join("")}</main>`;
}

function vocabularyPanel() {
  if (!selected) return "";
  const form = forms.get(selected.surfaceFormId)!; const sense = senses.get(selected.senseId)!; const lemma = lemmas.get(form.lemmaId)!;
  const key = vocabularyKey(form.id, sense.id); const level = mastery[key] ?? 1;
  return `<div class="scrim" data-close></div><aside class="sheet" aria-live="polite"><button class="close" data-close aria-label="Close">×</button><p class="eyebrow">Vocabulary · Level ${level}</p><h2>${escapeHtml(form.form)}</h2><dl><div><dt>Lemma</dt><dd>${escapeHtml(lemma.headword)}</dd></div><div><dt>Meaning here</dt><dd>${escapeHtml(sense.gloss)}</dd></div><div><dt>Part of speech</dt><dd>${escapeHtml(lemma.partOfSpeech)}</dd></div></dl><button class="primary" data-study>Study this word</button></aside>`;
}

function quizPanel() {
  if (!quizIdentity) return "";
  const key = vocabularyKey(quizIdentity.surfaceFormId, quizIdentity.senseId); const level = mastery[key] ?? 1;
  const quiz = quizzes.get(`${key}:${level}`)!; const form = forms.get(quizIdentity.surfaceFormId)!;
  return `<div class="quiz"><button class="back" data-quiz-close>← Return to reading</button><p class="eyebrow">${escapeHtml(form.form)} · Mastery level ${level} of 8</p><h2>${escapeHtml(quiz.prompt)}</h2>${answerVisible ? `<div class="answer"><span>Answer</span>${escapeHtml(quiz.answer)}</div><div class="actions"><button data-grade="false">Again</button><button class="primary" data-grade="true">I remembered</button></div>` : `<button class="primary" data-reveal>Reveal answer</button>`}</div>`;
}

function render() {
  app.innerHTML = quizIdentity ? quizPanel() : `<div class="page">${readerView()}</div>${vocabularyPanel()}`;
  document.querySelectorAll<HTMLElement>("[data-occurrence]").forEach((el) => el.onclick = () => { selected = bundle.occurrences.find((item) => item.id === el.dataset.occurrence); render(); });
  document.querySelectorAll<HTMLElement>("[data-close]").forEach((el) => el.onclick = () => { selected = undefined; render(); });
  document.querySelector<HTMLElement>("[data-study]")?.addEventListener("click", () => { quizIdentity = { surfaceFormId: selected!.surfaceFormId, senseId: selected!.senseId }; selected = undefined; render(); });
  document.querySelector<HTMLElement>("[data-reveal]")?.addEventListener("click", () => { answerVisible = true; render(); });
  document.querySelector<HTMLElement>("[data-quiz-close]")?.addEventListener("click", () => { quizIdentity = undefined; answerVisible = false; render(); });
  document.querySelectorAll<HTMLElement>("[data-grade]").forEach((el) => el.onclick = () => { const id = quizIdentity!; const key = vocabularyKey(id.surfaceFormId, id.senseId); mastery[key] = advanceMastery(mastery[key] ?? 1, el.dataset.grade === "true"); saveMastery(); answerVisible = false; render(); });
}

render();
