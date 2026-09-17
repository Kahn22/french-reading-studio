# French Reading Studio working baseline

Treat the checked-in `main` branch as the canonical working version for future French Reading Studio work.

Preserve these product rules unless the user explicitly changes them:

- Learner vocabulary identity is `Surface form + Sense` and mastery is shared across texts.
- Learning sections use natural passages targeting about 120 French words (normally 80–150), preserve authored thought-unit boundaries, and avoid single-sentence sections unless unavoidable.
- A word or prepared expression becomes encountered only when the learner views the specific thought unit containing that occurrence. Opening a work, changing its shelf status, preloading another section, or reading in Book View must not encounter unseen material.
- Vocabulary is underlined only at mastery Levels 1–3. At Levels 4–8 it remains tappable without an underline.
- Leaving a learning section triggers review of due identities in that section. The learner may complete it, skip to the next section without changing due state, or return to reread the section.
- Book View presents large, book-like passages without underlining, interactive vocabulary, quizzes, encounters, mastery changes, or scheduling changes.
- Reading and Completed texts contribute previously encountered items to review. Available texts do not contribute their unique items, and changing shelf status never erases learner progress.
- Published experiences use only pre-generated, reviewed, stored content. AI generation is permitted only during pre-publication production and never at learner runtime.
- Keep canonical content, linguistic data, prepared quiz content, authentication/authorization, and learner state separate.

Before treating a change as the new working baseline, run `npm run check` and `npm run build`.
