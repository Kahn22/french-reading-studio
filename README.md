# French Reading Studio

French Reading Studio is a French reading and spaced-repetition learning application built around canonical public-domain literature. This repository contains a framework-neutral TypeScript content model, deterministic validation, reference fixtures, and a lightweight browser learner interface. It intentionally does not yet choose authentication, a database, or a UI framework.

## Requirements

- Node.js 22 or newer
- npm 10 or newer

## Run locally

```bash
npm install
npm run check
npm run build
```

Start the browser interface with `npm run dev`. The public homepage contains the future account entry points and an explicit learner-preview button; it does not collect credentials. The learner home lists only publication-safe available texts and provides a global due-review button. Opening a text presents its canonical French without English sentence translations, creates first encounters for its learner vocabulary, and provides a text-specific due-review button. Selecting an occurrence opens its reviewed lemma, contextual sense, mastery level, and next review time.

The account contract and Learner/Admin/Owner authorization boundaries are vendor-neutral. Real registration, verification, sign-in, recovery, secure server sessions, and multi-device persistence deliberately remain unconnected until a hosting and authentication architecture is approved. The preview session is labeled clearly and uses session storage only as a disposable navigation convenience; it never stores credentials or pretends to provide security.

The production site is built into `site-dist/`; the GitHub Pages workflow validates and deploys that output without generating or rewriting quiz content at runtime.

The detailed product and editorial rules are recorded in [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md). English sentence/thought-unit translations are intentionally excluded. English vocabulary meanings and answer choices remain only where Levels 1–5 require them.

## Content architecture

The model separates five concerns:

- `catalog`: authors, collections, ordered books, and ordered works
- `works`: canonical French source text, French sentence/thought units, notes, expressions, and indexed occurrences
- `lexicon`: the shared linguistic hierarchy `Lemma → Sense → Surface form → Indexed occurrence`
- `quizzes`: prepared, immutable-at-runtime quiz material keyed to vocabulary identity
- application services: learner state in its own module, with authentication/authorization remaining a separate future service; neither belongs in canonical content

Stable opaque IDs are permanent identity. Display numbers such as “Livre VI” and “Fable X” are ordering metadata and may change without changing references.

### Vocabulary identity

A learner vocabulary item is exactly `(surfaceFormId, senseId)`. Occurrences in any number of works point to that same pair, so mastery is shared across texts. A validator ensures that the surface form and sense belong to the same lemma. The pair's canonical key is derived with `vocabularyIdentityKey`; it is not duplicated as authoritative data.

Prepared quiz items also point to this global pair, never to a work. They are authored and validated before learner use; runtime generation is outside the design.

Vocabulary publication is automatic and derived rather than stored. A valid `Surface form + Sense` pair becomes learner-published as soon as matching prepared quiz content exists. There is no separate vocabulary publish switch to forget or duplicate. Automatic vocabulary publication does not bypass the work gate: occurrences are exposed only from a fully validated `learning_ready` or `published` work.

### Publication workflow

Works progress monotonically through:

1. `source_acquired`
2. `source_structured`
3. `processing`
4. `learning_ready`
5. `published`

At `learning_ready` and `published`, validation requires complete thought units, a complete occurrence review, no unresolved learner tokens, valid cross-references, and prepared quiz items for all eight mastery levels for every vocabulary identity used by the work. Publication consumers should only query those two states.

The fixtures preserve La Fontaine's wording with conventional modern typography. They are deliberately `source_structured`: the complete source and initial thought segmentation are present, but linguistic annotation and quiz preparation still require editorial review.

## Repository layout

```text
src/
  app/                    French reading and prepared-quiz learner interface
  content/fixtures/       Reference content for the ingestion pipeline
  cli/                    Reproducible editorial commands
  domain/                 Schemas, types, validation, deterministic helpers
  ingestion/              Tokenization and review-manifest preparation
  learner/                Mastery state, timestamps, and deterministic scheduling
content/review/            Generated manifests intended for human review
docs/                      Authoritative product and editorial specification
tests/                    Model and invariant tests
```

## Adding content

1. Assign opaque IDs; never use a book/fable number as permanent identity.
2. Preserve the canonical wording in `canonicalText` and record provenance.
3. Segment the text into ordered complete sentences, thoughts, or quoted utterances without rewriting it.
4. Add global lemmas, senses, and surface forms before occurrences.
5. Exclude proper nouns and editorial artifacts from learner occurrences. Convert useful footnotes into explicit notes.
6. Prepare global quiz items for every vocabulary identity.
7. Advance publication state only after `validateContentBundle` passes.

`validateContentBundle` is pure, sorts diagnostics deterministically, and does not mutate input. Re-running it on identical content produces identical output.

## Editorial ingestion

Generate review manifests for the canonical fixtures with:

```bash
npm run content:prepare
```

The command first builds the project and then writes one manifest per work under `content/review`. It uses exact character spans, normalized token values, stable content-derived candidate IDs, and a SHA-256 source digest. It deliberately records no timestamp, so identical input produces byte-identical output and unchanged files are not rewritten.

`npm run content:build` also writes `content/review/wrk_lievre_tortue.lexical-plan.json`. This plan groups the complete second fixture's 256 tokens into 163 first-appearance-ordered written forms and lists possible identities already present in the first fable. These are deliberately pending editorial suggestions: matching spelling never automatically decides lemma or sense.

All new candidates start as `pending`. Capitalization is only a review hint: the pipeline never guesses that a title-cased word is or is not learner vocabulary. An editor must explicitly classify every candidate as vocabulary, a proper noun, or an editorial artifact. Vocabulary decisions additionally require an existing lemma, sense, and surface-form identity before review can be marked complete.

Build every checked-in content artifact and verify that generated files are current with:

```bash
npm run content:build
npm run content:check
```

The first processed package is `content/learning/le-corbeau-et-le-renard.json`. It includes reviewed learner tokens (not a reduced “core vocabulary” list), eleven French thought units, expressions, indexed occurrences, and 784 prepared quiz items. All 98 `Surface form + Sense` identities—including the literary, figurative use of *Phénix*—have compliant Levels 1–8 content, so the package is `learning_ready` and its vocabulary is learner-visible as one complete set.

## Learner scheduling

Learner scheduling is a separate deterministic module under `src/learner`. A first encounter creates Level 1 with a due time ten minutes later. Correct scheduled reviews advance exactly one level; incorrect scheduled reviews drop exactly one level and create the specified accelerated obligation. Completing an accelerated review never changes mastery and resumes the normal schedule from the completion time.

Normal intervals are 10 minutes, 1 day, 3 days, 7 days, 21 days, 60 days, 6 calendar months, and 1 calendar year for Levels 1–8. Level 8 continues with annual reviews. Review sessions freeze currently actionable items at session start and order them oldest-due first. Claims carry the learner-state revision and obligation details so a stale or duplicate submission cannot transition an obligation twice.

The authoritative browser record contains only the current mastery level, one `nextDueAt` timestamp, the active obligation kind, and a revision used for atomic transitions. Due status, overdue duration, queues, labels, and unnecessary timestamp history are derived rather than stored. Existing number-only browser mastery is preserved during the one-time migration and becomes immediately due because the old prototype had no authoritative due timestamp.

## First collection

The canonical catalog reserves Jean de La Fontaine's *Fables*, Books I–XII, with ordering preserved. The first pipeline fixtures are:

- Livre I, Fable II — *Le Corbeau et le Renard*
- Livre VI, Fable X — *Le Lièvre et la Tortue* (complete, unadapted text)

## Next boundary

After browser and iPhone QA of the prepared-quiz and scheduling interface, the next content implementation should process the complete *Le Lièvre et la Tortue* fixture through the same reviewed linguistic and quiz pipeline. Authentication and server-side multi-device learner persistence remain separate future services designed against the existing domain interfaces.
