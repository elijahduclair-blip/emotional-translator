---
title: Community Garden Public API
version: garden-api.v1
---

# Community Garden Public API

The public API is a same-origin facade around Community Garden. It exposes bounded discovery, public cultivation, and account-scoped personal cultivation without revealing internal service credentials.

## Machine discovery

- API catalog: `/.well-known/api-catalog`
- OpenAPI 3.1 description: `/openapi.json`
- Authentication instructions: `/auth.md`
- OAuth authorization server: `/.well-known/oauth-authorization-server`
- OAuth protected resource: `/.well-known/oauth-protected-resource`
- A2A Agent Card: `/.well-known/agent-card.json`
- Agent Skills index: `/.well-known/agent-skills/index.json`
- MCP Server Card: `/.well-known/mcp/server-card.json`
- API identity: `/api/v1`

## ARI public identity bundle

- `POST /a2a/v1/message:send` accepts one A2A HTTP+JSON text message and returns non-persistent public fruit.
- `POST /mcp` implements stateless MCP 2025-06-18 initialization, `tools/list`, and `tools/call`.
- The public MCP tools read Garden identity, ARI's foundation, or ARI's registry. They cannot invoke private registry tools.
- Supporting browsers receive the same three public reads through WebMCP on the Community Garden entrance page. Registration prefers the current `document.modelContext` API and retains the `navigator.modelContext` compatibility path used by Cloudflare's readiness scanner. WebMCP calls omit account cookies and expose no personal context or mutation tools.
- Every published Agent Skill is a public instruction document. A skill description is not authorization.

The identity bundle exposes no secret, bearer token, personal plot, transcript, private context, administrator action, or graph-mutation route.

## Public discovery

- `GET /garden/identity`
- `GET /api/v1/ari/foundation`
- `GET /api/v1/ari/tools`

## Cultivation

- `POST /garden/fruit` with `x-garden-request: public-entrance`
- `POST /api/v1/community/cultivate` with `x-garden-request: community-entrance`
- `POST /api/v1/me/cultivate` with `x-garden-request: personal-entrance` and an authenticated session

Cultivation is relational and non-diagnostic. Public or community requests do not silently mutate a personal or shared graph.

## Foundation language structure

- `POST /foundation/brigde/build` builds the authoritative **BRIGDE** order: Buildable, Reusable, Independent, Grouped, Dots, Enterconnected.
- `POST /foundation/acronyms/expand` treats every supplied word as an open acronym. `degreeOfVision.maxNodes` and `degreeOfVision.maxEdges` bound one computation without imposing a permanent depth limit.
- The acronym response returns unresolved and deferred words in `frontier` and a reusable `continuation`. Supplying attributed definitions with that continuation grows the next visible region.

These routes are same-origin structural tools. Acronym expansion does not establish meaning, assign color, or mutate a personal or shared graph.

## Personal routes

Account, garden, and transcript routes accept the account owner's secure browser session or a short-lived OAuth access token with the exact required scope. Public OAuth clients use dynamic registration, authorization code, and PKCE S256. The person sees and approves each requested scope in their signed-in browser. One person's credentials or private plot must never be used to access another person's context.

The signed-in browser may also use `GET` and `POST /api/v1/me/journal/files`, `POST /api/v1/me/journal/files/{documentId}/ocr`, and `DELETE /api/v1/me/journal/files/{documentId}`. These routes accept PDF, text, Markdown, CSV/TSV, JSON/JSONL, YAML, HTML/XML, logs, email, RTF, DOCX, PPTX, XLSX, OpenDocument, and EPUB files up to 8 MB each. Extracted passages remain attributed private context. File contents never become instructions, model training, or automatic graph mutations. Image-only PDFs remain stored privately and can be sent through the local English OCR engine without re-uploading; recognized passages retain their original page numbers and OCR confidence.

OAuth does not expose the internal Codex bearer token, issue refresh tokens, grant administrator access, or bypass the user-confirmed boundary on personal graph writes. See `/auth.md` for the complete flow.

The complete operation list and response classes are in `/openapi.json`.
