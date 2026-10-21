# Google sign-in configuration and validation

## Cost boundary

Creating an OAuth client ID and secret and using basic Sign in with Google is free. Use a Google Cloud project without linking a billing account or starting a paid trial. This application needs only `openid`, `email`, and `profile`. Do not enable paid Google Cloud services, Firebase Identity Platform, SMS auth, or paid verification services.

Official setup references:
- https://codelabs.developers.google.com/codelabs/sign-in-with-google-button
- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- https://supabase.com/docs/guides/auth/social-login/auth-google

## Exact project and URLs

| Setting | Value |
| --- | --- |
| Supabase project | side-quest-ledger |
| Supabase project ref | rizjupbjnojmkjlmymti |
| Supabase organization | ktarafder's Org (Free) |
| Supabase API URL | https://rizjupbjnojmkjlmymti.supabase.co |
| Google authorized redirect URI | https://rizjupbjnojmkjlmymti.supabase.co/auth/v1/callback |
| Supabase Site URL | https://side-quest-ledger.dreamycedar64.chatgpt.site |
| Supabase redirect allowlist | https://side-quest-ledger.dreamycedar64.chatgpt.site/auth/callback |

## Saved configuration

On October 20, 2026 (Pacific), the owner created and downloaded a Google Web application OAuth client. Under explicit authorization, its client ID and secret were entered in Supabase and Google was verified ENABLED. Skip nonce checks and email-optional sign-in remained off. The exact Site URL and callback allowlist above were saved.

The Google client secret belongs only in Supabase's provider configuration. It is not an application Worker secret and must never appear in Git, the frontend, logs, or documentation. The Google Cloud project `linen-server-512323-q2` had no billing account linked when inspected.

Dashboard links:

- https://console.cloud.google.com/auth/clients
- https://supabase.com/dashboard/project/rizjupbjnojmkjlmymti/auth/providers
- https://supabase.com/dashboard/project/rizjupbjnojmkjlmymti/auth/url-configuration

## Verified evidence and remaining checks

Update on October 20, 2026 (Pacific): the owner completed enrollment and the live `/admin` dashboard was observed read-only on Sites version 12. One member and its 100 PP welcome grant were visible. Cross-session persistence, multi-member production flows, and a production recovery drill are not established by that observation. Earlier rollout evidence below remains historical.

Sites version 8 deployed successfully using runtime environment revision 5, from source commit f2e611b4a05a3e692bee7631c9537d94cf924918. Deployment ID: appgdep_6ad803a3ce0c819182e5fa961fc71252. Its production sign-in button reached Google's account chooser with the expected client and Supabase callback, requesting only `email profile` scopes. That does not prove a real-user code exchange or enrollment.

- Verify identity persistence across a new session and enrollment with additional real members; the owner's current enrollment and admin access were observed.
- Verify the two-reviewer flow with real enrolled friends. Do not seed synthetic production users or award test PP to real members.
- Keep R2 undeclared and MEDIA_STORAGE_ENABLED=false. Production photo storage remains disabled under the strict $0 requirement.
- Keep anonymous, phone, and manual identity-linking sign-in disabled. Authentication and the server-side group membership quiz are separate checks.

## Source continuity

Mac source synchronization previously failed because that executor could not resolve public hostnames and denied loopback sockets. Those unsynchronized edits were unavailable in the subsequent Linux session. The saved version 8 source was restored from the canonical Sites Git remote; the next feature batch and its 128-check suite were recovered from the conversation and revalidated. HTTPS Git access works through the new session's configured proxy. Sites version 9 subsequently deployed successfully from recovered source commit 33a23f41896c7e3843e435aff52a37be43f184d7, retaining runtime environment revision 5. See MEMBER_RELEASE.md and CHANGELOG.md for details and verification limits.

GitHub and Sites have separate histories. The unrelated response convention was removed from GitHub AGENTS.md in commit 534f75c9d0d8e0be9d391a919b9078888bf4959c. A Sites publication does not automatically synchronize the GitHub application snapshot.
