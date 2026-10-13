# Changelog

Dates use America/Los_Angeles. Sites publication numbers are distinct from package versions, GitHub commits, and release tags. The package still declares `0.1.0`; no semantic-version release tag is implied by the entries below. Credential values are deliberately omitted.

## Documentation baseline — 2026-10-13

### Added

- Formal architecture/data/API specification, participant and browser-state machines, current invariants and counterexamples, concurrency/failure analysis, and a clearly marked proposed identity model.
- STRIDE threat model with asset/trust-boundary inventory, risk priorities, source evidence, mitigations, acceptance tests, and operational unknowns.
- State-of-the-union report distinguishing implemented features, observed checks, open decisions, and proposed work.
- `AGENTS.md` covering code ownership, design-decision provenance, security rules, migrations, publishing, and verification.
- An offline finite-state checker and recorded model report. Its checks concern the abstraction, not production security.

### Scope

This entry documents the existing app. It does not implement authenticated users, persistent D1 profiles, owner-only deletion, session expiry/revocation, CSRF middleware, rate limiting, or any other hardening proposal.

## GitHub source publication — 2026-10-13

### Added

- Public repository `ktarafder/side-quest-ledger`, branch `main`.
- Clean 127-file source snapshot and project README; generated deployment archives and TypeScript cache excluded.
- Initial repository commit `e69d4b44851fa284864373d4318b749ece50c482` and application import `1c20d8ccad8d9a2608b3ea3ec30c820e1d463f2e`.

### Validation

GitHub app permissions were updated to allow the new repo. Main-branch page/schema contents were retrieved and compared with the uploaded source. GitHub publication does not automatically publish the live Site.

## Sites version 6 — 2026-10-13

Source: `a64da21e0fd5ab0a1bcd4680220b94c4a7f73610`.

### Added

- `quests.created_by` via additive migration `0002_greedy_star_brand.sql` with an empty default for legacy records.
- New quests submit the saved browser name as `createdBy`; cards show “Added by [name].” Older quests show “Creator not recorded.”

### Fixed

- Removed the obsolete global `.claimed` CSS rule that applied chip-style alignment and padding to claimed quest cards.

### Validation

TypeScript and production build passed; publication succeeded. A temporary live quest's creator was verified through a later GET; existing quests loaded. Creator labels remain unverified client submissions.

## Sites version 5 — 2026-10-13

Source: `35fad90260f9bbc127bcf8edcf0055b739685287`.

### Fixed

- Separated `nameDraft` from saved `name`, so the one-time identity modal stays open while typing and stores the name only on submission.
- Changing a saved name seeds the new prompt with the old name.

### Validation

TypeScript/build passed and publication succeeded. No claim of authenticated identity was added.

## Sites version 4 — 2026-10-13

Source: `d7bdc2538bd605402c20dc7443a146758d472182`.

### Added / changed

- `quest_participants` table, quest foreign key, and exact `(quest_id,name)` unique index through migration `0001_curly_alex_wilder.sql`.
- Multiple independent participants per quest, participant chips, individual completion/reopen/leave actions.
- One-time name prompt and localStorage persistence under `side-quest-name`; header control changes it.
- User-relative active/completed filters and board-wide participant/XP aggregates.
- Read-time legacy single-claim compatibility to preserve prior participation.

### Validation

Migration generation/type/build checks completed, then publication succeeded. A temporary live quest accepted two participants, and completing one preserved the other. The identity-modal bug in this version was corrected in version 5.

## Earlier Sites publications — 2026-10-13

Sources retained in Sites history: `111d81c` (initial application), `74270a6` and `f4fd57b` (visual iterations). The latter commits predate participant-table support.

### Added / changed

- Initial password-gated shared quest board, D1-backed quests, categories, reward/XP display, creation/deletion and single-participant claim/completion.
- Shared access-key configuration updated; actual value is not part of public change history.
- Aubergine/teal seasonal palette and alignment/typographic refinements, retaining the established editorial card layout.

### Limits of history

These entries summarize inspected source/history and the development conversation. They are not retroactive security releases, signed tags, or evidence of exhaustive testing. Generated archives exist in historical Sites commits but were excluded from the GitHub source import.
