# French Reading Studio

French Reading Studio is a French reading and spaced-repetition learning application built around canonical public-domain literature. This repository currently contains the production foundation: a framework-neutral TypeScript content model, deterministic validation, and reference fixtures. It intentionally does not yet choose hosting, authentication, a database, or a UI framework.

## Requirements

- Node.js 22 or newer
- npm 10 or newer

## Run locally

```bash
npm install
npm run check
npm run build
```

## Content architecture

The model separates five concerns:

- `catalog`: authors, collections, ordered books, and ordered works
- `works`: canonical French source text, sentence/thought units, translations, notes, expressions, and indexed occurrences
- `lexicon`: the shared linguistic hierarchy `Lemma → Sense → Surface form → Indexed occurrence`
- `quizzes`: prepared, immutable-at-runtime quiz material keyed to vocabulary identity
- future application services: authentication/authorization and learner state, which must not be embedded in canonical content

Stable opaque IDs are permanent identity. Display numbers such as “Livre VI” and “Fable X” are ordering metadata and may change without changing references.

### Vocabulary identity

A learner vocabulary item is exactly `(surfaceFormId, senseId)`. Occurrences in any number of works point to that same pair, so mastery is shared across texts. A validator ensures that the surface form and sense belong to the same lemma. The pair's canonical key is derived with `vocabularyIdentityKey`; it is not duplicated as authoritative data.

Prepared quiz items also point to this global pair, never to a work. They are authored and validated before learner use; runtime generation is outside the design.

### Publication workflow

Works progress monotonically through:

1. `source_acquired`
2. `source_structured`
3. `processing`
4. `learning_ready`
5. `published`

At `learning_ready` and `published`, validation requires complete thought units, a complete occurrence review, no unresolved learner tokens, valid cross-references, and at least one prepared quiz item for every vocabulary identity used by the work. Publication consumers should only query those two states.

The fixtures preserve La Fontaine's wording with conventional modern typography. They are deliberately `source_structured`: the complete source and initial thought segmentation are present, but linguistic annotation and quiz preparation still require editorial review.

## Repository layout

```text
src/
  content/fixtures/       Reference content for the ingestion pipeline
  domain/                 Schemas, types, validation, deterministic helpers
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

## First collection

The canonical catalog reserves Jean de La Fontaine's *Fables*, Books I–XII, with ordering preserved. The first pipeline fixtures are:

- Livre I, Fable II — *Le Corbeau et le Renard*
- Livre VI, Fable X — *Le Lièvre et la Tortue* (complete, unadapted text)

## Next boundary

The next implementation should build an editorial ingestion command that reads source files, tokenizes deterministically, emits reviewable candidate linguistic records, and refuses to promote a work until a human-approved manifest is complete. Authentication, learner scheduling, and persistence should be designed afterward against these domain interfaces.
