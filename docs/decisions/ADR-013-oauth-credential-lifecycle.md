# ADR-013: OAuth authorization and credential lifecycle

Date: 2026-10-15. Status: accepted and locally verified for campaign-level `IntegrationConnection` OAuth; the connected-account AAN-02 flow is implemented separately. Provider callback registration and live consent remain pending.

## Context

Existing campaign connectors use server-managed environment token references. This extension lets administrators authorize those existing `IntegrationConnection` records without entering raw tokens in the dashboard. The account-first flow uses separate `ConnectedAccount` records and OAuth state; this ADR covers campaign-level credentials only. The implementation remains within the existing NestJS/PostgreSQL modular monolith and keeps provider credentials out of API responses and logs.

## Decisions

1. OAuth starts from an existing `IntegrationConnection` and is available only to an Administrator who configured that connection. The provider callback is public because it cannot rely on the local session cookie; one-use state binds it to the initiating Administrator, and callback handling rechecks that the owner is still an active Administrator. This extension does not discover or create campaign provider assets; account-first discovery uses the separate connected-account workflow.
2. Authorization endpoints and token endpoints are fixed per provider family in server code. The API callback origin is configured server-side and must match an exact configured allowlist entry. Browser-supplied callback URLs and provider URLs are not accepted.
3. Every authorization attempt stores only a SHA-256 hash of a random state value, a ten-minute expiry, the requesting Administrator, provider, connection, and an incrementing connection generation. State is consumed atomically once. A new authorization, disconnect, or auth-mode change invalidates prior attempts. Google authorization also uses S256 PKCE; its verifier is encrypted at rest.
4. OAuth access/refresh tokens are stored in one encrypted token bundle using AES-256-GCM and a server-only, base64-encoded 32-byte `INTEGRATION_OAUTH_ENCRYPTION_KEY`. Ciphertext uses a versioned envelope. A dedicated credential-mode field prevents fallback to an environment token after an OAuth connection has been disconnected or needs reauthorization.
5. Reconnect replaces credentials only after a successful exchange. Denial or failed exchange preserves any existing credential. Expired tokens are refreshed where provider support allows it. An expired refresh token or explicit provider rejection (`invalid_grant` for Google and `invalid_code` for Zoho) moves the connection to `REAUTH_REQUIRED`; temporary provider or network failures preserve `CONNECTED` and return a retryable safe error.
6. Disconnect stops local sync, invalidates pending authorization, removes the local encrypted OAuth credential, and preserves campaign performance history. It does not guarantee revocation of the provider-side grant; the UI explains that the provider may still retain the authorization. The separate account-first AAN-06 workflow handles explicit analytics-data deletion.
7. LinkedIn programmatic refresh tokens require provider enablement for a limited set of partners. Without a returned refresh token, expiry requires user reauthorization. See [LinkedIn's refresh-token documentation](https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens).

## Consequences

- The additive migration introduces OAuth attempt and encrypted credential tables, connection auth mode, and a generation counter. Existing connections remain `SERVER_ENVIRONMENT` with no data rewrite.
- The current UI can initiate OAuth for an existing campaign connection. It does not discover campaign provider assets or create account connections; account-first discovery is handled separately.
- Automated mock-flow acceptance and migration application to isolated and guarded local databases passed. Provider callback registration, live consent, account identity matching, and live provider behavior remain unverified or scheduled follow-up work.
- Replacing or losing the encryption key makes stored tokens unreadable. Key rotation requires a separate migration/operational procedure; do not rotate it casually.
