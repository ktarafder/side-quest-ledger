# Side Quest Ledger: state of the union

As of 2026-10-13, America/Los_Angeles. This is a factual engineering snapshot, not a promise of future features or a security certification.

## Executive assessment

The app is live and supports shared quests with independent participation, a one-time browser name prompt, creator labels on new quests, and an aubergine/teal interface. It is a working social prototype with substantial identity, authorization, session, and operational security debt. Security is now a stated priority; the current shared-key/name model does not meet that goal.

| Area | State | Meaning |
| --- | --- | --- |
| Functional core | Working, positively tested | Create, join, complete and leave through guarded API; multiple participants |
| Persistent records | Implemented | Quests, creator labels, participant labels/status in D1 |
| Name recall | Device-local only | `side-quest-name` in localStorage; clear storage and the prompt returns |
| Individual identity | Absent | Shared key admits users; names are editable labels |
| Ownership/roles | Absent | Any admitted requester can act under any name or delete any quest |
| Session lifecycle | Inadequate for strong security | Common deterministic token; browser lifetime only; no server revocation |
| Concurrency/error behavior | Partially handled | Database uniqueness exists; multi-write atomicity and consistent validation do not |
| Production readiness | Not established | No load/security/recovery certification or operational SLO evidence |

## Publication and provenance

- Live URL: https://side-quest-ledger.dreamycedar64.chatgpt.site
- Public source: https://github.com/ktarafder/side-quest-ledger
- GitHub application baseline: `1c20d8ccad8d9a2608b3ea3ec30c820e1d463f2e` on `main`.
- Latest runtime publication confirmed during development: Sites version 6, source `a64da21e0fd5ab0a1bcd4680220b94c4a7f73610`.
- GitHub contains a clean 127-file initial source snapshot, excluding generated publishing archives and TypeScript cache. It has its own history; it is not a mirror of all Sites commits.
- This documentation update adds repository records; it does not deploy new product behavior. Future operators must verify the current production version rather than treat this dated snapshot as live telemetry.

## Implemented product behavior

Visitors unlock a shared board and, if no browser name is saved, submit their name once. The modal uses a separate draft so typing cannot dismiss it before persistence. The header allows changing the remembered name. New quests save that name as creator attribution. Older quests explicitly show unavailable creator attribution instead of inventing it.

Each exact-name participant can join the same quest, complete it, reopen it, or leave independently. Cards list participants and mark completed entries. Existing single-person legacy claims are projected into participant responses. The active/completed filters are relative to the current display name; summary counts and XP are board-wide current-state aggregates. Reopening removes that completion's current contribution, so XP is not a cumulative event ledger.

The claimed-card formatting defect was traced to an old global `.claimed` CSS rule that overrode the card's alignment/padding. Removing that collision preserves full-width card sections and the established visual system. Browser screenshot verification of the corrected deployment was not completed; the source cause was inspected and the corrected build deployed successfully.

## Architecture and data

React client state and forms live in `app/page.tsx`. Vinext/Vite compiles the application for a Cloudflare Worker. The Worker routes call Drizzle against the D1 `DB` binding. `quests` and `quest_participants` are the only application tables. Three migrations establish quests, participant rows/uniqueness, and creator labels. Runtime secrets are `SITE_PASSWORD` and `SESSION_SECRET`; their values are not in these documents.

The hosting manifest retains its Sites identity, D1 binding, and disabled R2 binding. Platform ChatGPT identity helpers and connector scaffolding exist in the starter, but the running board does not use authenticated user identity or connected apps for quest authorization.

There is no users table, anonymous-profile cookie, per-user session table, membership/role model, durable audit trail, soft deletion, recovery UI, real-time sync, pagination, offline action queue, or cumulative achievement ledger. The discussion of D1 profiles plus a device cookie was a proposal; it has not been implemented. Even that proposal would not securely recover identity after all browser identifiers are removed.

## Verification evidence and its limits

| Check | Evidence | Does not establish |
| --- | --- | --- |
| TypeScript and production build | Passed for latest application source | Security correctness, a dependency CVE scan, or production performance |
| Multiple participation | Temporary live quest accepted two distinct participant names | Authenticated ownership or malicious-user isolation |
| Independent completion | Completing one test participant left the other claimed | All concurrent/failure cases |
| Creator persistence | New test creator survived API creation and subsequent GET | Creator authenticity |
| Existing data compatibility | Existing quests loaded after creator migration | Exhaustive legacy migration correctness |
| Production publication | Sites tool reported version 6 succeeded | Current operator settings, actual headers, backups or load capacity |
| GitHub publication | `main` updated; app page and schema retrieved and compared to uploaded source | Automatic synchronization with Sites |
| Formal-model check | See committed model report and scope | Verification of the running server or all possible real-world executions |

Temporary API fixtures were deleted after their checks. No adversarial production tests were conducted. No test result is invented for rate limiting, ownership, token expiry, audit, recovery, header policy, or dependency vulnerabilities.

## Security priorities and unresolved decisions

Immediate blockers are a prototype-strength shared key, client-supplied identities, unrestricted admitted deletion, and replayable board-wide session tokens. See [THREAT_MODEL.md](docs/THREAT_MODEL.md) for severity, traces, mitigations and acceptance criteria. Documentation is not remediation.

The recommended next milestone is **verified identity and server-side ownership**, with temporary containment of current public risks while that design is selected. Input validation, CSRF/origin policy, atomic SQL, quotas/pagination, auditing, restore procedures, and publication controls then need measured implementation and tests. These are proposed milestones, not work already done.

Owner input is required on membership, supported sign-in/recovery, admin permissions, legacy ownership, repeat-completion semantics, and retention. Visual/interaction decisions follow [AGENTS.md](AGENTS.md). A security correction may make an earlier convenience unsafe, but the alternative flow must be made concrete and reviewed.

## Operational unknowns and maintenance

Provider-level WAF/rate limits, effective HTTP security headers, D1 plan and retention, backup/export access, audit-log availability, branch protections, dependency advisories, secret scanning, monitoring/alerts, and rollback/restore procedures have not been inspected or demonstrated. D1 recovery features are available at the platform level; no configured access or tested RPO/RTO is claimed here.

Keep source/runtime documentation in sync, append migrations, and record evidence when closing a threat. A deploy rollback can leave newer schema or changed data in place; restoration is a separate decision. Use isolated environments for negative/concurrent/destructive tests. Never log real session credentials or publish database exports.

## Reading order

1. [Formal system model](docs/FORMAL_MODEL.md): exact current behavior and proposed invariants.
2. [Threat model](docs/THREAT_MODEL.md): risks and concrete hardening criteria.
3. [Changelog](CHANGELOG.md): delivered changes and provenance.
4. [Agent instructions](AGENTS.md): codebase, design authority, and change rules.
5. [Executable model](docs/model/README.md): repeatable abstract-state checks and counterexamples.
