# French Reading Studio working baseline

Treat the checked-in `main` branch as the canonical working version for future French Reading Studio work.

Preserve these product rules unless the user explicitly changes them:

- Learner vocabulary identity is `Surface form + Sense` and mastery is shared across texts.
- A word or prepared expression becomes encountered only when the learner views the reading section containing that occurrence. Opening a work, changing its shelf status, or preloading another section must not encounter unseen material.
- Vocabulary is underlined only at mastery Levels 1–3. At Levels 4–8 it remains tappable without an underline.
- Reading and Completed texts contribute previously encountered items to review. Available texts do not contribute their unique items, and changing shelf status never erases learner progress.
- Published experiences use only pre-generated, reviewed, stored content. AI generation is permitted only during pre-publication production and never at learner runtime.
- Keep canonical content, linguistic data, prepared quiz content, authentication/authorization, and learner state separate.

Before treating a change as the new working baseline, run `npm run check` and `npm run build`.
