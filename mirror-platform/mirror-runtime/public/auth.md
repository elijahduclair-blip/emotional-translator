---
title: Community Garden Authentication
version: garden-auth.v3
agent_auth:
  skill: https://acommunitygarden.garden/auth.md
  register_uri: https://acommunitygarden.garden/agent/auth
  claim_uri: https://acommunitygarden.garden/agent/auth/claim
  identity_types_supported:
    - identity_assertion
  identity_assertion:
    assertion_types_supported:
      - verified_email
    credential_types_supported:
      - access_token
---

# Auth.md

## Community Garden Authentication

Community Garden supports three person-controlled authentication methods: a secure browser session, OAuth authorization code with PKCE for registered public clients, and an Auth.md verified-email claim for AI bots. None grants administrator authority, cross-person access, or shared graph mutation.

The `agent_auth` profile is intentionally person-authorized. An AI bot receives no credential until the person supplies the one-time token delivered to their verified account email. Community Garden does not offer anonymous agent credentials, autonomous mailbox access, or unattended account claiming.

## Auth.md registration for AI bots

### Step 1 - Start a verified-email claim

Send JSON to `POST https://acommunitygarden.garden/agent/auth`:

```json
{
  "email": "person@example.com",
  "scope": "garden:session:read garden:cultivate"
}
```

The response is always generic about whether an account exists. For an existing verified account, the Garden emails a single-use verification token to the person. The response includes an opaque `claim_token`, the `claim_uri`, the approved scope request, and a ten-minute expiry. The AI bot must ask the person to provide the emailed token; it must never read or control the person's mailbox.

### Step 2 - Complete the person-approved claim

Send the opaque claim and the token supplied by the person to `POST https://acommunitygarden.garden/agent/auth/claim`:

```json
{
  "claim_token": "garden_claim_...",
  "verification_token": "person-supplied-one-time-token"
}
```

A valid, unexpired, unused pair returns a `garden_at_...` bearer access token for only the scopes fixed into the original claim. The token expires after one hour and has no refresh grant. Invalid, expired, or replayed claims return `400 invalid_grant` without a partial credential.

## Discover the OAuth pair

```yaml
service: Community Garden
resource_server: https://acommunitygarden.garden
authorization_server: https://acommunitygarden.garden
authorization_server_metadata: https://acommunitygarden.garden/.well-known/oauth-authorization-server
protected_resource_metadata: https://acommunitygarden.garden/.well-known/oauth-protected-resource
dynamic_client_registration: https://acommunitygarden.garden/oauth/register
authorization_endpoint: https://acommunitygarden.garden/oauth/authorize
token_endpoint: https://acommunitygarden.garden/oauth/token
grant_type: authorization_code
pkce_method: S256
token_endpoint_auth_method: none
```

The OAuth server issues opaque Garden access tokens. The internal Codex service bearer token and the browser session token are never returned to the client.

## OAuth step 1 - Register a public client

Send `POST /oauth/register` as JSON with one to five complete redirect addresses. HTTPS addresses and HTTP loopback IP addresses are accepted. The registration supports only `authorization_code`, response type `code`, and `token_endpoint_auth_method` `none`.

```json
{
  "client_name": "Example Garden helper",
  "redirect_uris": ["https://client.example/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

The returned client identifier is short-lived and contains no reusable client secret.

## OAuth step 2 - Ask the person

Open `/oauth/authorize` in the person's browser with `response_type=code`, the registered `client_id` and exact `redirect_uri`, a `state` value, a requested `scope`, and an RFC 7636 `code_challenge` using `code_challenge_method=S256`.

The person must already be signed in to Community Garden. The Garden shows the client name, redirect address, and requested scopes before the person can choose **Allow once** or **Deny**. An AI agent must not approve its own request or attempt to bypass this screen.

Supported scopes are:

- `garden:session:read`
- `garden:cultivate`
- `garden:graph:read`
- `garden:graph:write`
- `garden:transcript:read`

## OAuth step 3 - Exchange the code

Send the one-time code to `POST /oauth/token` as `application/x-www-form-urlencoded` with `grant_type=authorization_code`, `client_id`, the same `redirect_uri`, and the original `code_verifier`. Codes expire after five minutes and cannot be replayed. Garden access tokens expire after one hour.

Use the result only in the HTTP `Authorization` header:

```http
Authorization: Bearer garden_at_...
```

Protected writes still require `x-garden-request: personal-entrance`. The resource server returns a `WWW-Authenticate` challenge containing the protected-resource metadata address when a token is missing, expired, or under-scoped.

## Browser account registration

Community Garden also keeps its original user-directed account and session flow. An agent may carry a person's explicit request, but it cannot register autonomously or control the person's mailbox.

```yaml
registration_type: user_authorized_account
registration_endpoint: https://acommunitygarden.garden/api/v1/me/account
verification_endpoint: https://acommunitygarden.garden/api/v1/me/account/verify
session_endpoint: https://acommunitygarden.garden/api/v1/me/session
credential_type: secure_session_cookie
```

### Register

```http
POST /api/v1/me/account
Content-Type: application/json
x-garden-request: personal-entrance

{"username":"chosen-name","email":"person@example.com","password":"person-controlled-password"}
```

The response is `202 Accepted`. The person must control the email address and complete the single-use email verification step themselves.

### Sign in

```http
POST /api/v1/me/session
Content-Type: application/json
x-garden-request: personal-entrance

{"email":"person@example.com","password":"person-controlled-password"}
```

A successful response sets `mirror_session` as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie. Do not copy the cookie into browser JavaScript, prompts, logs, URLs, transcripts, graph evidence, or another person's session.

## Errors and revocation

- `400` means the request shape, client registration, verification token, authorization code, or PKCE proof is invalid.
- `401` means the browser session or access token is absent, expired, or invalid.
- `403` with `insufficient_scope` means the token did not receive the required permission.
- `429` means the entrance rate limit was reached; stop and wait for the response's retry window.
- `5xx` means the Garden could not complete the request; do not bypass the entrance.

The person revokes the browser credential with `DELETE /api/v1/me/session`. Password reset increments the account token version, invalidating the underlying session carried by existing Garden access tokens. OAuth access tokens are intentionally short-lived and no refresh-token grant is supported.

## Authorization boundary

- Account creation, authorization, and graph-writing scopes require explicit person action.
- OAuth access is limited to the approved account and scopes.
- Personal APIs never expose another person's plot.
- The Codex service bearer token remains internal.
- OAuth does not authorize administrator actions, automatic learning, Color Atlas mutation, or shared graph mutation.

See `/openapi.json` for the machine-readable API description.
