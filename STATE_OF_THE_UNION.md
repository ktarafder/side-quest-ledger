# Side Quest Ledger: state of the union

As of October 20, 2026, America/Los_Angeles. This is a source and verification snapshot, not a security certification.

## Current release and publication

The member/PP application is live at https://side-quest-ledger.dreamycedar64.chatgpt.site. Sites version 12 was deployed successfully from source `d6afeec2b321d001d8f72b387de80c0c8a96fb23`, deployment `appgdep_6ad81163f57c81919df783be1fb27590`, runtime environment revision 5. The public GitHub repository is https://github.com/ktarafder/side-quest-ledger. This synchronization brings the current application source into GitHub while preserving its documentation, model checker, and README synchronization workflow. GitHub and Sites have different histories; a GitHub push does not publish the site.

## Implemented behavior

- Supabase Google identity, a server-side three-question enrollment challenge, durable members, owner-bound admin permissions, and 100 PP issued once on enrollment. Names are display labels, never ownership keys. There is no first-user-admin bootstrap.
- Funded 10–35 PP quests and the approved 20 PP debt fallback. Interest and commitment are separate. Reported scheduled no-shows require admin confirmation before a 10 PP penalty.
- Two randomly assigned independent reviewers must approve completion. The first verified finisher wins the reserved pot; later completions can be verified without another payout. When too few reviewers exist, submissions wait. Admins can fill slots or replace a pending reviewer.
- Member-priced market listings, reservation/fulfillment/receipt/refund flows, revision-checked checkout, owner edits, and additive restocking.
- Immutable PP events, wallet history, leaderboard, tips, Kudos, memory archive, and audited recovery through compensating events and soft-deletion restore.
- A separate `/admin` route for circulation, purchases, reviews, no-shows, adjustments, legacy ownership, audit, and recovery. The member tabs do not include Admin and the normal board does not fetch admin data. Unauthorized API requests are rejected server-side.
- The established aubergine/teal interface, corrected registration/sign-in/modal spacing, and responsive wrapping. The oversized member-board banner was removed at the owner's request.

See [MEMBER_RELEASE.md](MEMBER_RELEASE.md) for exact rules and [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md) for provider setup and scope. Quick capture and chat automation are excluded.

## Architecture and cost boundary

Vinext/Vite builds React/TypeScript into a Sites Cloudflare Worker. Supabase Auth verifies Google identities. D1 under the existing `DB` binding stores members, quests, attendance, reviews/submissions, market records, PP events, audit entries, and counters. `components/ledger.tsx` shares UI behavior between `/` and `/admin`; authorization lives in `lib/server.ts`, `lib/authorization.ts`, and server mutation rules.

Existing migrations are retained and migrations 0003/0004 append member/PP records and revision support. Legacy name-only records are preserved without guessed ownership. Runtime secrets include `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ADMIN_EMAIL`, `GROUP_QUIZ_JSON`, and `MEDIA_STORAGE_ENABLED`; their values are not committed. The Google client secret belongs only in Supabase provider configuration.

Supabase remains Free. The hosting manifest retains its Site identity, `d1: "DB"`, and `r2: null`. Media is explicitly disabled and no paid object storage or other paid resources were enabled. Runtime data, environment files, local fixtures, build output, caches, and publishing archives stay out of GitHub.

## Verification and limits

The current application passed 128 domain/migration/permission/accounting/recovery/race checks, 12 owner-authorization edge cases, 11 local API access checks, TypeScript, and production build. Local API tests denied ordinary/anonymous admin access and forged-role balance changes. Local browser tests verified separate admin navigation, adjustment dialog availability, no admin link for ordinary members, and access denial on a direct `/admin` visit. Responsive formatting was inspected at 320, 390, 768, and 1512 px with synthetic fixtures.

The live owner account enrolled successfully and its `/admin` dashboard was observed read-only. Live multi-member review, marketplace fulfillment, recovery drills, provider revocation behavior, distributed load/rate limiting, effective hosted security headers, dependency scanning, and disaster-recovery targets remain unverified. No adversarial production testing or fake production members were used. Passing local checks is not a production security assessment.

## Documentation history

The [formal model](docs/FORMAL_MODEL.md) and [threat model](docs/THREAT_MODEL.md) now identify current scope and retain the October 13 shared-key prototype as historical evidence. Their old findings are not a current assessment. The executable checker under `docs/model/` still covers only that prototype; its passing result does not verify member/PP semantics. README scope and diagrams are generated from the canonical model sections. Preserve marker pairs and run `pnpm docs:sync` and `pnpm docs:check` after editing those sections.
