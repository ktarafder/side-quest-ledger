# Member release — implementation and setup

Current status (October 21, 2026, Pacific): Sites version 15 is live from `febf0ca5809b5a12f594aac2b7f80df93abf1942`, runtime revision 6; Supabase deletion function version 1 is active. The owner previously enrolled and its dashboard was observed read-only. The new deletion flow passed 67 isolated and 44 local HTTP checks, alongside 128 domain checks, 12 authorization checks, TypeScript and production build. No production account was deleted; real-provider revocation and browser visuals remain unverified. Earlier release notes below remain historical.

Implemented October 19, 2026 (Pacific); Sites version 8 deployed October 20, 2026 (Pacific). Google provider and exact callback configuration are saved. The production sign-in button reached Google; real-user code exchange, enrollment, and a production recovery drill remain unverified.

## Self-service account deletion — October 21, 2026 (Pacific)

The header display-name button opens account settings with a typed-confirmation deletion flow. The D1 profile is closed atomically, shared history is anonymized, unused PP is retired through journal events, and the Supabase Auth user is removed by a caller-authenticated Edge Function. Pending obligations block deletion. A failed provider call has an explicit finish-deletion retry screen. Rejoining repeats Google sign-in and the group quiz without another 100 PP grant. See [ACCOUNT_DELETION.md](ACCOUNT_DELETION.md) for retention, deployment, and verification. No paid resource or upgrade was added.

## Quest/market editing and reviewer recovery — October 20, 2026 (Pacific)

Sites version 9 deployed successfully on October 20, 2026 (Pacific), using runtime environment revision 5. Source commit: 33a23f41896c7e3843e435aff52a37be43f184d7. Deployment ID: appgdep_6ad80acee07081918d5e602bc9699f3b. URL: https://side-quest-ledger.dreamycedar64.chatgpt.site.

- Owners can edit an open quest's title, description, extra reward, category, and scheduled time before any submission and while nobody is committed or has a recorded attendance outcome. Interested members do not lock details; legacy participation does. The original stake and PP journal remain unchanged.
- Commitments carry the quest revision the member saw. A stale form or concurrent edit rejects the commitment and refreshes the board.
- Listing owners can change title, description, and price, and add up to 100 available units per operation. Additive restocking preserves concurrent sales/refunds. Existing purchases retain their original title and price.
- Checkout requires the displayed listing revision and price. A stale or concurrently changed offer fails without debiting PP or reserving stock; the board refreshes for review.
- Admins can replace a pending reviewer with a different random eligible active member. Submitters, quest owners, and current assigned reviewers are excluded. Existing approvals remain, and two independent approvals are required. If no replacement exists, the assignment stays. A required reason and immutable member IDs are recorded in the audit.
- Successful edit, restock, purchase, and replacement retries remain actor-bound and idempotent.

Migration `0004_nifty_wraith.sql` appends default-zero revision columns to quests and listings. It does not rebuild tables, alter balances/journal entries, or replace migration 0003's custom triggers/indexes. Browser tabs left open across release must refresh because commitment and checkout now require revision fields.

The Mac edits were not accessible in the resumed Linux session. The saved version 8 source was restored, and this batch and its tests were recovered from the conversation. All 128 domain, migration, permission, accounting, recovery, and race checks pass again, together with TypeScript and a production build. Races exercise both orderings of quest edit/commit, checkout against price change, restocking during purchase, and reviewer approval during replacement. All balances reconcile afterward.

The earlier release's 78 HTTP and browser checks below are historical evidence; they do not establish verification of these new controls. The resumed Linux preview rendered the app entry correctly. Full authenticated browser and real Google enrollment checks remain outstanding. No paid resource, subscription, storage binding, or billing change was added. Photos remain disabled.

## Authorized product rules

Kamrul selected Supabase with Google, first verified finisher wins, and a 10 PP confirmed no-show fee. Quick capture is excluded. The current aubergine/teal design remains the baseline.

- Every new enrolled member receives 100 PP once. Re-registering with the same normalized verified email after account deletion starts at 0 PP; a secret HMAC claim prevents repeated starter grants.
- Funded quests reserve 10–35 PP. If the creator cannot cover the requested stake, the quest is worth 20 PP and the balance is debited 20 even below zero.
- The first submission approved by two assigned independent reviewers wins the single pot. Other committed participants may record verified completions for the archive without another payout.
- Reviewer assignment uses a cryptographic shuffle; the submitter and quest creator are excluded. With fewer than two eligible members, the submission waits. New enrollment and an admin action fill empty slots without lowering the threshold.
- Anyone can post a market offer with a defined PP price and quantity. Purchases reserve the buyer's PP. Buyer confirmation releases PP to the seller; cancellation refunds and restores stock.
- Tips require a positive balance sufficient to fund the transfer. Kudos are unique per giver/completion and do not move PP.
- Interested and committed are distinct. Commitments can be withdrawn before a scheduled event; an organizer can report a no-show only after its start. Only the admin can confirm the 10 PP penalty or dismiss the report.
- Admin tools expose balances, debt, quest and purchase reservations, purchases, storage, pending reviews, PP history, and audit entries.
- Admin recovery includes soft-deletion restore, purchase refunds, reversal of tips/no-shows/payouts, cancellation/refund of unawarded pots, explicit PP adjustments, and deliberate legacy ownership assignment.

## Identity, membership, and registration

Supabase is the identity provider only. D1 remains the application database; no second application database was added. Every protected endpoint verifies the provider's user server-side with Supabase's getUser(). Authentication cookies are HttpOnly, same-origin, secure on HTTPS, and refreshed by the SSR SDK.

Google sign-in establishes identity. It does not establish group membership. New members must answer three distinct questions selected from the server-configured pool. The pool, including all accepted answers, is a runtime secret. Matching is case/spacing/punctuation insensitive; the configured two-name answer also accepts either order.

Challenges are tied to a verified identity, expire after 30 minutes, and allow three attempts. Challenge creation and answer attempts are rate limited. Clients never receive accepted answers or per-question correctness. This gates app membership; it is not a claim that outsiders cannot create a bare account at the identity provider.

The admin dashboard is a separate `/admin` route, linked only for the admin account; the member navigation has no Admin tab and does not fetch admin data. Unauthorized visitors see an access-only message, while `/api/admin` and every admin mutation enforce server-side authorization. The admin is bound to the current verified Google email configured as ADMIN_EMAIL. Stored admin roles are downgraded for a request if the current verified email or stored member email does not match; `/api/me` reports the same effective role. No first-user-admin bootstrap, editable-name authority, or browser-side admin flag is used.

Legacy creator and participant labels remain historical data. They do not prove ownership and are not automatically associated with a new account. Existing computed scores are not turned into money.

## Hosted configuration

The dedicated project `side-quest-ledger` (`rizjupbjnojmkjlmymti`) was created in `ktarafder's Org` after the owner selected that organization. Supabase reported plan `free` / `tier_free` and quoted $0 per month before creation. Project status was `ACTIVE_HEALTHY`. The existing inactive `scheduly-vector` project was left untouched.

SUPABASE_URL and the modern SUPABASE_PUBLISHABLE_KEY are now configured as hosted runtime secrets, alongside ADMIN_EMAIL and GROUP_QUIZ_JSON. These values take effect only on deployment. No service-role key, paid branch, add-on, custom domain, or email service was created.

Google is enabled with the owner's existing OAuth client, and the exact Site URL/callback allowlist are saved. See [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md) for configuration evidence and remaining real-user checks. The Google client secret lives only in Supabase's provider configuration.

Sites version 8 deployed successfully using hosted runtime environment revision 5. The production button reached Google's account chooser. Google-only login does not use Supabase's default email delivery; Google supplies account recovery.

## Media and cost controls

The owner's strict $0 requirement takes precedence over R2's larger free allowance. R2 can bill for usage above its allowance; an application storage cap alone cannot establish a provider billing guarantee.

- `.openai/hosting.json` leaves `r2` as `null`, so this release requests no object-storage provisioning.
- Hosted MEDIA_STORAGE_ENABLED is set to `false`. Both that flag being exactly `true` and an existing BUCKET binding are required before any R2 read or write.
- The board advertises media availability; file selectors stay hidden while media is disabled. Written stories and market listings remain usable.
- No standalone Cloudflare subscription, bucket, Worker, D1 database, or billing change was created through the Cloudflare connector. The existing Sites DB binding is retained.
- Cloudflare billing inspection returned 403 because the OAuth connector lacks Billing Read. Subsequent calls required reauthentication. Neither is evidence of a provider-level $0 cap.

The media implementation remains available for a future verified no-cost setup: JPEG/PNG/WebP signatures, 2 MiB per image, 30 uploads per member per day, and an atomic 8 GiB reservation ceiling. Cleanup failures retain reservations. Browser uploads resize to 1600 pixels and re-encode JPEG. These safeguards do not replace a billing cap. Do not enable the binding or media flag based only on a free-tier allowance or a billing alert.

## Accounting and concurrency

pp_events is an immutable journal; triggers apply debits and credits. Balances reconcile to events. Pending quest and purchase reservations are shown separately in the admin dashboard.

D1 batch transactions contain all writes and precondition checks for each domain action. An actor-bound idempotency key and request digest protect retries. Unique event IDs and conditional winner selection prevent duplicate pot payouts. Stock reservation, purchase creation, and buyer debit share a transaction.

Normal tips and purchases cannot overdraw. Quest fallback stakes, confirmed penalties, and explicit admin corrections can create debt under the approved rules. Corrections append compensating events rather than deleting history.

Custom indexes and triggers live in migration 0003 alongside generated schema SQL. Preserve them if later migrations rebuild affected tables.

## Validation

- 82 domain/migration/permission/accounting checks in scripts/test-members.mjs.
- 78 HTTP checks through built Worker routes, local D1, local R2, and Supabase SSR cookies with a synthetic loopback identity provider. This is integration evidence, not a live Google authorization test.
- TypeScript and production build passed.
- All four migrations applied successfully to an isolated local D1 database.
- Browser inspection of sign-in entry, authenticated board, and admin metrics used synthetic local fixtures.
- Source scan found none of the real quiz answers in app, library, schema, migration, or test code.
- Live Google sign-in and a production recovery drill remain unverified. Production media is deliberately disabled; no R2 provisioning was attempted.
- The no-spend follow-up passed 15 additional HTTP checks with a built Worker and a local R2 binding: production manifest has no bucket; disabled requests return 503 without creating an asset reservation or changing PP; the board reports media disabled; anonymous uploads remain unauthorized. TypeScript, the production build, and all 82 domain checks passed again.
- Reproduce the no-spend smoke check with `node scripts/test-media-disabled.mjs` against the local synthetic-auth preview with an enrolled test admin. Never point synthetic auth at production.

Run domain checks with Node 23+ (node:sqlite) using:
    node scripts/test-members.mjs

Build with the Sites skill's supported build-site helper. Source publication and production deployment are separate operations.

## Operational scope

List endpoints have bounded results. The archive is paginated; PP history supports older-event pagination. Ordinary board/listing/member views show bounded recent records suitable for this group. There is no background messaging automation or external notification service.

The app does not silently import private group messages, publish jokes as quests, or use an agent to award PP. Registration questions and answers must remain runtime secrets, never client code or public documentation.
