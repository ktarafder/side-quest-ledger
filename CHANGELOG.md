# Changelog

## Engraved sign-up page — 2026-10-20 (Pacific)

Replaced the entry card with a single-page, teal-on-aubergine field-guide layout inspired by the owner's Hermes reference. Added original compass/friends/mountain-portal artwork, a compass seal, condensed display type, and a compact editorial footer. The Google action and helper now occupy separate grid rows with a fixed 28 px gap; phone layouts keep the action first and stack the artwork. Registration and access/error states share the new shell. Self-hosted the licensed Barlow Condensed font and illustration; no new provider services or paid resources were enabled. Member board and auth rules are unchanged.

Checked sign-in at 320, 390, 768, 1280, and 1512 px: no horizontal overflow; the Google button/helper gap is 28 px. Desktop/laptop sign-in fits one viewport at 1512×740 and 1280×720. Group registration was checked at 320, 390, 768, and 1512 px with local synthetic questions: inputs fit and the registration action gap remains 16 px. Font and artwork were confirmed to load. TypeScript and production build pass.


## GitHub source synchronization — 2026-10-20 (Pacific)

Synchronized the tested Sites version 12 application source, member/PP migrations, Google setup notes, formatting fixes, banner removal, and separate admin route into the public GitHub repository. Preserved repository documentation and README synchronization automation, updated current scope, and labeled the earlier executable model and assessment as historical. Retired the obsolete shared-key auth module. Runtime secrets, data, fixtures, build outputs, and deployment archives are excluded. This GitHub update does not redeploy Sites.

## Separate admin route — 2026-10-20 (Pacific)

Moved the dashboard from the member tabs to `/admin`, with an admin-only entry link and a return link to the board. The normal board no longer loads admin data. Kept all dashboard recovery actions and server permission checks. Centralized registration/effective role checks and require both the stored admin role and the current verified Google email to match the configured owner; stale/mismatched roles are reported as member in `/api/me` too. No production member records or balances were changed.

Validation: 128 domain checks, 12 owner-authorization checks, 11 local API access checks, TypeScript, and the production build passed. Local browser checks confirmed separate admin navigation, the adjustment dialog, no admin entry for an ordinary member, and a denied direct visit to `/admin`. All authentication tests used isolated synthetic users; no paid resources were enabled.

## Simplified board — 2026-10-20 (Pacific)

Removed the large “Do something sideways” banner from the member board. Board stats and section navigation now follow the header directly. Removed unused banner styles and moved the existing top anchor to the board container. Sign-in and registration screens are unchanged.

## Spacing and responsive formatting — 2026-10-20 (Pacific)

Separated the registration actions into a vertical group with a 16 px gap and added 18 px beneath the Google sign-in button. Added explicit registration intro spacing and a 20 px form rhythm for all ledger dialogs, including stacked fields at phone widths. Modal titles wrap without squeezing the close button; inputs and dialogs fit narrow screens. Long quest, reward, listing, member, and admin-row text wraps or ellipsizes within its container. Participant chips use working ellipses; the mobile header keeps the PP balance readable alongside a long member name. The existing palette and overall design are preserved.

TypeScript and the production build pass. Browser inspection used only isolated local synthetic members and data. Sign-in and registration actions, board cards/header, quest dialog, market, admin rows/metrics, and leaderboard were checked at 320, 390, 768, and 1512 px; all measured page/container overflow checks passed. Wallet, review empty state, and archive empty state were also checked at 320 px. Live real-user onboarding was not changed or exercised, and no paid services or media storage were enabled.

## Quest/market edits and reviewer recovery — 2026-10-20 (Pacific), Sites version 9 deployed

Recovered the unsynchronized feature batch from the conversation onto canonical Sites version 8 source. Added owner quest edits before commitments/submissions, revision-checked commitments, market edits and additive restocking, protection against changed offers/prices at checkout, and audited admin replacement of pending reviewers with another random independent member. Appended migration 0004 without rebuilding existing tables or changing journal balances. All 128 domain/migration/permission/accounting/recovery/race checks, TypeScript, and the production build pass in the resumed Linux session. Authenticated browser and real Google enrollment checks remain outstanding. Sites version 9 deployed successfully from commit 33a23f41896c7e3843e435aff52a37be43f184d7 with runtime environment revision 5 (deployment appgdep_6ad80acee07081918d5e602bc9699f3b). No paid resources or object storage were enabled.

## Google configured and member release deployed — 2026-10-20 (Pacific)

Configured the owner-created Google OAuth client in Supabase and saved exact production URLs under explicit authorization. Google ENABLED was verified. Published the previously saved Sites version 8 artifact using runtime environment revision 5; its sign-in button reached the expected Google account chooser with email/profile scopes. Real-user code exchange and enrollment remain unverified. Removed the unrelated response convention from the separate GitHub AGENTS.md in commit 534f75c9d0d8e0be9d391a919b9078888bf4959c.

## No-spend setup follow-up — 2026-10-19 (Pacific)

Created a dedicated Supabase Free project after a $0/month quote and configured its URL and modern publishable key as hosted runtime secrets. Added explicit default-off media access and availability-aware photo controls. Removed the R2 provisioning request until no-charge billing terms can be verified. Updated the release status and added exact Google OAuth setup instructions. Google provider configuration remains the production rollout blocker; the previous board stays live.

## Member / Power Points release — 2026-10-19

Added Supabase Google identity and member ownership, a server-side registration quiz, a transaction-backed PP wallet, staked quests and debt fallback, two random completion reviewers, market reservations and fulfillment, tips, Kudos, a leaderboard, memories, and an owner-only admin/recovery dashboard. Shared-key mutation endpoints are retired. Legacy records are preserved without guessed ownership.

See MEMBER_RELEASE.md for exact rules, setup, verification evidence, and live configuration limits. This source release does not itself establish that production OAuth or media provisioning is complete.

## Earlier GitHub history

Dates use America/Los_Angeles. Sites publication numbers are distinct from package versions, GitHub commits, and release tags. The package still declares `0.1.0`; no semantic-version release tag is implied by the entries below. Credential values are deliberately omitted.

## README synchronization and maintainer conventions — 2026-10-13

### Added / changed

- README includes the formal model's full scope/system-boundary section and the threat model's trust-boundary diagram.
- `scripts/sync-readme.mjs`, `pnpm docs:sync`, and `pnpm docs:check` generate those sections and detect drift; missing/duplicate markers or diagrams fail explicitly.
- A GitHub workflow checks pull requests and regenerates README on relevant `main` pushes, subject to Actions/write-permission availability.
- Design decision provenance moved to the end of `AGENTS.md`.
- Agent instructions record Kamrul's weekly Chipotle visit and required response closing sentence.

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
