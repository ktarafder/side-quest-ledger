# Account deletion

Open the display-name button in the member header, choose **DELETE MY ACCOUNT**, type **DELETE**, and confirm. Successful deletion returns to Google sign-in. Signing in again requires the three group questions. This deletes the Google-authenticated account in this app, not the person's Google account.

## Retained history and PP

The member becomes an inactive `Deleted member` tombstone with its email/auth link removed and admin role cleared. Owned quests and listings are archived; structured quest creator labels are anonymized. Shared purchase, completion, review, Kudos, PP and audit history is retained under that tombstone. Existing freeform stories, quest text and audit reasons are not scrubbed. This is account closure with retained shared records, not full erasure of all historical content.

Pending personal submissions are withdrawn and pending review assignments released. Other reviewers' previous decisions remain. Unawarded funded pots are refunded once and the resulting unused wallet balance retired through immutable compensating PP events. Other members' balances are unchanged. Debt, pending/ready purchases, unresolved past scheduled commitments/no-show reports, and other members' commitments or pending submissions on owned quests block deletion until resolved.

Re-registration creates a new member ID. A server-side HMAC fingerprint of the normalized verified email prevents another 100 PP starter grant; returning accounts start with 0 PP. Original members receive a fingerprint when closing their account. No fingerprint is claimed for an account deleted before enrollment. Keep `ACCOUNT_HASH_SECRET` stable: rotating or losing it breaks recognition of previous claims. Old history remains attached to the deleted member ID.

## Implementation and failure handling

- `POST /api/account/delete` accepts only same-origin JSON, server-validates Google identity, requires `confirmation: "DELETE"`, and rate limits attempts. Caller data cannot select a target identity.
- An atomic D1 batch checks obligations again, writes `account_deletions`, anonymizes the member, archives owned items and appends accounting compensation. Active-member guards prevent stale in-flight commands after closure.
- The Worker calls Supabase function `delete-ledger-account` with the caller's access JWT. The function independently validates that JWT with `getUser`, requires a verified Google identity and a `DELETE` header, and checks the fixed Site's authenticated `/api/account/deletion-status` endpoint. It then revokes sessions globally and deletes only that authenticated Supabase user ID.
- Supabase's function-runtime admin key stays inside Supabase; the Worker and browser never receive it. Gateway `verify_jwt` is false because the function performs its own live authentication, supporting modern project signing keys. Unauthenticated calls still receive 401.
- D1 closure precedes provider removal. If Supabase is unavailable, the profile remains closed and `/api/me` returns `deleting: true`. The entry screen offers **FINISH DELETION**. Retry is idempotent. If necessary, sign in with Google again to finish. Successful removal expires local auth cookies and clears client state. Existing JWTs cannot access the closed membership.

## Configuration and deployment

Migration `0005_lame_forge.sql` appends `account_deletions` and `welcome_claims`; it does not rebuild application tables or replace existing triggers. Deploy the Edge Function from `supabase/functions/delete-ledger-account/` with `verify_jwt: false`, set a random secret `ACCOUNT_HASH_SECRET` of at least 32 characters in Sites runtime secrets, then publish the Worker with migration 0005. No service-role key belongs in Sites or source control. The function's readiness origin is fixed to the existing Site URL; update it deliberately if the domain changes.

This uses the existing Supabase Free project and Sites D1 binding. No paid resources, plan upgrades, object storage or billing changes are required. Media remains disabled.

## Verification

`node scripts/test-account-deletion.mjs` runs 67 isolated checks covering authentication, target selection, obligations, rollback/races, retries, anonymous retention, reviewer reassignment, journal reconciliation, large balances and repeat enrollment grants. The built Worker also passed 44 local HTTP checks with a synthetic identity provider: confirmation/origin/auth boundaries, provider failure and retry, cookie clearing, a fresh group quiz, no repeat starter grant, and owner admin access after rejoining. Existing 128 domain checks and 12 owner-authorization checks also pass. TypeScript and the production build pass. The deployed Edge Function rejects an unauthenticated request with 401. Real production account deletion is deliberately not exercised; provider deletion/session revocation behavior for a real Google account and visual browser verification remain unverified.
