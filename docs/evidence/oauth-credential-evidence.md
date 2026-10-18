# OAuth and credential lifecycle implementation evidence

Date: 2026-10-18. Status: campaign-level OAuth extension implemented and locally verified. The mock HTTP flow and isolated/local additive migration checks passed. Google/YouTube and Zoho credentials are configured only in the ignored local API environment; provider-console callback registration and live account-owner consent are still pending. The separate connected-account AAN-02 implementation is recorded in [account-first verification evidence](account-first-analytics-verification.md).

## Implemented behavior

- Added Administrator-only OAuth start for campaign connections and public provider callback routes for Meta, LinkedIn, Zoho Campaigns, and Google/YouTube. Each callback is bound to a one-use attempt initiated by an active Administrator. The routes use fixed provider endpoints and scopes; no provider URL, redirect URL, or raw token is accepted from the browser.
- Authorization attempts are bound to the configuring Administrator and connection. The database stores a hash of the one-use state, a ten-minute expiry, provider/connection identity, and a connection generation. New flows, disconnect, or auth-mode changes invalidate older attempts. Google also uses S256 PKCE with an encrypted verifier.
- Added AES-256-GCM encrypted token-bundle persistence with a required server-only base64 key. API connection responses expose only credential status, expiry, scopes, and safe error codes; they never select the token ciphertext.
- Added expiry refresh for Meta long-lived tokens, Zoho, and Google, plus LinkedIn when the app is eligible for and receives a programmatic refresh token. Expired refresh tokens and explicit provider rejection codes (`invalid_grant` for Google and `invalid_code` for Zoho) require reauthorization; temporary provider and network failures preserve the connected credential and return a retryable safe error. A successful reconnect replaces the old credential atomically; denial and failure leave it intact.
- Added an Administrator **Connect with provider / Reconnect provider account** action to the existing Integrations view. It validates the returned provider origin before redirecting to consent. Existing environment-token references remain available for current connectors until AAN-03 account discovery and the account-first connection workflow replace manual setup.
- Disconnect removes the local OAuth credential, invalidates pending flows, stops local sync, and retains analytics history. The response and UI state that provider-side permission may still need revocation in provider settings.
- Added an additive migration for credential and attempt persistence. It was applied to the isolated integration database and through the guarded local preparation script to the loopback application database; that script retained existing data and catalogue customizations.

## Requested scopes in the current server configuration

| Provider product         | Requested scopes                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Facebook / Instagram Ads | `ads_read`                                                                                                  |
| Facebook Page organic    | `pages_show_list`, `pages_read_engagement`, `read_insights`                                                 |
| Instagram organic        | `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`                  |
| LinkedIn Ads             | `r_ads_reporting`                                                                                           |
| LinkedIn Page organic    | `r_organization_social`                                                                                     |
| Zoho Campaigns           | `ZohoCampaigns.campaign.READ`                                                                               |
| YouTube Analytics        | `https://www.googleapis.com/auth/yt-analytics.readonly`, `https://www.googleapis.com/auth/youtube.readonly` |

These are read-only requests in code, not evidence of app approval or provider acceptance. Validate the requested scopes against each actual developer app and product before live consent.

## Files changed

- API OAuth routes, service, encryption helper, integration credential selection/refresh behavior, and safe integration response metadata.
- Integrations screen OAuth action and status messaging.
- Additive Prisma schema/migration and safe environment placeholders.
- [ADR-013](../decisions/ADR-013-oauth-credential-lifecycle.md), [this evidence](oauth-credential-evidence.md), the current completion ledger, progress log, and operator guide.

## Verification

| Check                                          | Result                                                                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| API unit suite                                 | Passed: 105 tests                                                                                                           |
| Campaign OAuth HTTP/PostgreSQL integration     | Passed: 14 tests, including Google PKCE exchange, Zoho callback, replay rejection, extra-scope rejection, and safe metadata |
| Connected-account Google/Zoho HTTP integration | Passed: YouTube and Zoho mock callbacks, exact scopes/routes, state consumption, safe metadata                              |
| Session boundary and OAuth service unit tests  | Passed as part of the API unit suite                                                                                        |
| Additive migration                             | Applied to the isolated integration DB and guarded loopback application schema                                              |
| `pnpm lint`                                    | Passed                                                                                                                      |
| `pnpm typecheck`                               | Passed for shared, API, and web workspaces                                                                                  |
| `pnpm build`                                   | Passed for shared, API, and web workspaces                                                                                  |
| Accounts and Integrations browser journeys     | Passed: 6/6 using the isolated E2E database and no provider credentials in test processes                                   |
| `pnpm format:docs` and `git diff --check`      | Passed                                                                                                                      |
| Provider consent/live token exchange           | Pending callback registration and account-owner approval                                                                    |

## Remaining campaign connector OAuth acceptance

- Live setup must confirm each provider app's approved product, exact permitted scopes, callback registration, refresh behavior, and token revocation semantics. In particular, LinkedIn programmatic refresh is app-access dependent, and the current Meta app's Marketing API use case has not been validated with this OAuth login flow.
- The current campaign connection must still be prepared manually before OAuth. This extension does not implement provider account discovery; that behavior belongs to the separate connected-account workflow.
- Provider-side grant revocation is not automatically performed by local disconnect. Validate provider revocation semantics for this campaign-level credential flow before live activation.
- Encryption key rotation needs a separately approved operational procedure.
