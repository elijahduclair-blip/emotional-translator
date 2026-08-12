# Community Garden

Community Garden is the visible knowledge-cultivation shell. It keeps the existing systems separate while giving them one emotional-translation vertical slice:

```text
MirrorRuntime.ask(input)
  -> ChromaBridge.evaluate(input)
  -> Codex.translateGraph(input)
  -> Codex.saveEvaluation(evaluation, translation)
```

- `codex/` is the Emotional Translator application and PostgreSQL API.
- `chromabridge/` is the constitutional and semantic governance layer.
- `mirror-runtime/` is the reasoning/runtime service.

Mirror Runtime can also use a locally hosted Qwen3 model as its conversational reasoning engine. The local request remains orchestrated through the three services: Codex produces the reversible English → UEB → six-bit trace and approved relational evidence, ChromaBridge preserves the non-mutating boundary, and Qwen3 returns the English response. The same-origin endpoint is `POST /local-ai/respond` with `{ "input": "..." }`.

The imported ChromaBridge PDF is kept in a fourth logical layer inside Codex:

- `knowledge_nodes` and `knowledge_edges` contain shared color vocabulary, coordinates, hierarchy, synonyms, and antonyms.
- `nodes` and `edges` remain the separately governed, approved semantic graph.
- `runtime_evaluations` remains conversation/runtime memory.

The extracted knowledge artifact is `data/chromabridge-color-knowledge.json`. Every record retains its source document hash, page, row, and relationship-extraction confidence. Re-import it after migration with:

```bash
pnpm knowledge:import
```

The import replaces only rows from that same source document. It does not change runtime evaluations, the approved semantic graph, or user history.

### Fixed color space and decimal addresses

The imported knowledge layer uses a fixed nine-direction compass. The operative equal-spacing grid is:

| Address root | Anchor | Compass degree |
| ---: | --- | ---: |
| `1` | White | 90° |
| `2` | Red | 10° |
| `3` | Orange | 50° |
| `4` | Yellow | 130° |
| `5` | Gray | 330° |
| `6` | Green | 210° |
| `7` | Purple | 290° |
| `8` | Blue | 170° |
| `9` | Black | 250° |

Every compass direction remains 40° from its geometric neighbors. The permanent symbolic addresses mirror around Gray at `5`: White/Black (`1`/`9`), Red/Blue (`2`/`8`), Orange/Purple (`3`/`7`), and Yellow/Green (`4`/`6`). A shade inherits a child address such as `1.1`; a word beneath that shade inherits another segment such as `1.1.1`. Addresses are dot-delimited strings, not floating-point numbers, so `1.10` remains distinct from `1.1`. New detail refines an existing direction and never creates a new anchor.

The original XYZ coordinate remains the node's exact structural position, and `decimalAddress` identifies its color → shade → word location. The existing `degreeOfVision` field is retained as a compatibility name for the fixed compass degree; it does not define Codex's active reasoning view.

Open `http://127.0.0.1:3100` to use the combined emotional translator. ChromaBridge first traces natural climate signals and preserves a `proposal_only` boundary. Codex reads the approved relational graph first and consults imported color knowledge only when the approved graph has no exact result. Mirror Runtime returns the combined reading and Codex records it in `runtime_evaluations`, separate from approved graph nodes and edges.

Graph reads are transport-bounded to 12 nodes and 24 routes. Those visible nodes and routes are Codex's active degree of vision for one read. The response includes detailed evidence once and a compact `knowledgeLayer` summary; runtime memory stores the landing, evidence summary, and node/route IDs rather than a second graph snapshot. This keeps persistence below the 64 KB API guardrail without merging knowledge into memory.

WordNet lexical evidence is available through `GET /api/v1/wordnet/lookup?term=gold` and batch `POST /api/v1/wordnet/lookup` with `{ "terms": ["gold", "ritual"] }`. The endpoint uses exact or morphological lookup against the local WordNet lexicon and returns possible senses, synonyms, antonyms, hypernyms, related forms, source labels, and unresolved terms. It is read-only evidence: it cannot assign a color, create an address, activate a graph route, or mutate approved meaning. Princeton WordNet is distributed as a local lexical database rather than an official hosted REST service, so Codex owns this bounded API surface and can expand its lexicon without depending on an unofficial remote provider. Local development permits tokenless calls only from the loopback interface; production requires `Authorization: Bearer <WORDNET_READ_TOKEN>` and limits each client to 60 lookups per minute.

If neither the approved graph nor imported knowledge has an exact match, the translator keeps ChromaBridge's unresolved or natural-climate reading instead of inventing graph evidence. A translation does **not** approve or mutate durable semantic meaning.

### Garden Entrance

The first public-boundary slice treats Community Garden as something that receives seeds of information and grows useful fruit for people. `GET /garden/identity` returns a stable, non-secret description of the Garden's purpose, cultivation cycle, protected roots, and adaptation lanes. `POST /garden/fruit` accepts `{ "input": "..." }` from the same-origin visitor surface and returns only a compact cultivated response, relationship notice, and non-mutation boundary.

Garden seeds are limited to 2,000 Unicode code points and 20 requests per client per minute. The visitor response excludes model traces, service credentials, database records, training receipts, timing details, and mutation controls. Guest fruit is not persisted. When a valid account session is present, the response may consult that person's private relational context, but shared graph growth still requires the existing governed proposal workflow.

Mirror Runtime remains bound to `127.0.0.1`. The separate Garden gateway terminates the public application boundary and forwards only the intended visitor surface; Codex, PostgreSQL, ChromaBridge internals, Ollama, and administrative service tokens remain protected roots rather than public network services. Set `MIRROR_TRUST_PROXY=true` only when direct access to Mirror Runtime is blocked and the trusted gateway is the sole upstream connection.

The deployable public gateway runs separately at `http://127.0.0.1:3200`:

```bash
pnpm --dir mirror-runtime public:dev
```

It serves `public/entrance.html` and exposes only the bounded Garden entrance, Garden API routes described below, and a compact `/health`. It returns `404` for every internal Account, Research, Local AI, Governance, Foundation, Codex API, and internal health path. It never forwards browser bearer tokens, filters session cookies to `mirror_session`, and rebuilds upstream responses from explicit allowlists. Set `GARDEN_GATEWAY_TRUST_PROXY=true` only when an HTTPS tunnel or reverse proxy is the sole external connection to port `3200`.

#### Garden APIs: two for a person, one for people

`GET /api/v1` returns the public route catalog and its non-mutation boundaries. The two authenticated person APIs are:

- `POST /api/v1/me/cultivate` with `{ "input": "..." }` and `x-garden-request: personal-entrance` may consult only the signed-in person's reviewed relational overlay. It does not automatically save the seed or change shared knowledge.
- `GET /api/v1/me/garden` returns a compact owner-scoped view of that person's reviewed relationships. It cannot read another person's overlay.

The one people API is `POST /api/v1/community/cultivate` with `{ "input": "..." }` and `x-garden-request: community-api`. It is anonymous and consults only shared approved or imported reference knowledge. Cookies and authorization headers are deliberately discarded on this route, so an accidental signed-in browser request cannot mix personal memory into community output.

Personal API sessions use `POST`, `GET`, and `DELETE /api/v1/me/session`. New accounts use `POST /api/v1/me/account`, email verification uses `POST /api/v1/me/account/verify`, and verification-email retries use `POST /api/v1/me/account/resend-verification`. These account actions share a five-per-hour per-address abuse limit in Codex in addition to the gateway limit. The public gateway retains the Codex token only inside an `HttpOnly; Secure; SameSite=Strict` cookie; frontend JavaScript never receives it. All three cultivation surfaces are read-only: no call automatically mutates a personal overlay, the shared graph, the Color Atlas, or model weights. Personal growth still enters through the existing reviewed feedback workflow, and shared growth still requires governed proposal approval.

The public entrance includes a **My profile** portal at `/#profile`. A visitor can create an account, receive a single-use 24-hour email-verification link, and sign in after verification. Account holders can view their profile identity and private relationship count, cultivate through the personal-context API, inspect their reviewed personal routes, refresh their plot, and sign out. The signed-out page renders no personal data, and the profile workspace is available only while the owner-scoped session is valid. Public account creation requires working SMTP configuration; the route fails closed without it and removes an unverified record when mail delivery fails.

For a temporary development preview, Cloudflare's official Quick Tunnel command can target only this gateway:

```bash
cloudflared tunnel --url http://127.0.0.1:3200
```

Quick Tunnel URLs are temporary and intended for testing. A stable public deployment should use a named tunnel, controlled domain, and gateway-level access and abuse policies.

The stable entrance is `https://acommunitygarden.garden`; `https://garden.acommunitygarden.garden` reaches the same protected public surface. Both addresses use the named Cloudflare tunnel `community-garden-entrance`. Its local Cloudflare configuration and tunnel credentials live outside the repository under `%USERPROFILE%\.cloudflared` and must never be committed. Start the named connector with:

```bash
cloudflared tunnel run community-garden-entrance
```

The named tunnel forwards only `acommunitygarden.garden` and `garden.acommunitygarden.garden` to the loopback Garden gateway on port `3200`; its final ingress rule returns `404` for every unmatched hostname.

On this Windows workstation, register the limited-user login supervisor with:

```bash
pnpm autostart:register
```

The `Community Garden Autostart` scheduled task begins 30 seconds after sign-in, ignores duplicate launches, checks PostgreSQL and Ollama, starts the protected application stack when it is absent, and keeps the named tunnel attached once the public gateway is ready. Runtime logs are stored outside the repository under `%LOCALAPPDATA%\CommunityGarden\logs`. Check its state with `pnpm autostart:status`. Disable automatic startup without deleting its definition with:

```powershell
Disable-ScheduledTask -TaskName 'Community Garden Autostart'
```

Automatic startup does not prevent Windows from sleeping and cannot keep the public site online while this computer is powered off or disconnected from the internet.

### Research Intake bed

The Community Garden shell exposes the existing governed research library as a focused Research bed. Signed-in users can search the allowlisted Wikipedia and Crossref APIs through `GET /research/search`, inspect source URLs, excerpts, retrieval context, and existing graph cues, then save the result as a reference without inventing a falsification condition. Saved records enter `research_items` with `proposed` status and remain separate from the approved graph.

Administrators may mark a reference approved, rejected, or in need of revision with an accountable review note. Only when an approved reference is promoted toward the graph must the proposal identify its specific claim and a condition that would weaken that claim. Even then, the reference cannot alter graph data: it may create only a second `graph_proposals` record, which must complete the existing graph review and approval workflow. Browser JavaScript never receives the Codex bearer token; the same-origin Mirror Runtime facade carries the HttpOnly account session. External source failures are bounded, cached briefly, and reported independently so one provider cannot silently stand in for another.

### Braille mathematics room

The combined Mirror Runtime shell includes an accessible UEB-with-Nemeth learning room. Codex owns a versioned eight-lesson arithmetic/pre-algebra curriculum and the bounded routes under `/api/v1/braille/math`; ChromaBridge marks every result `notation_only`; Mirror Runtime keeps account tokens in an HttpOnly same-origin cookie. The translator accepts strict ASCII math or Unicode Braille, produces canonical print, MathML, spoken structure, Unicode Nemeth, and dot-number cells, and returns `422` instead of guessing at unsupported advanced structures.

Public lessons and translation do not require an account. Verified accounts synchronize lesson status, scores, durations, and mistake categories; raw practice answers are not stored. The optional color overlay is visual tracing only and never changes Braille, assigns color meaning, or mutates graph knowledge. Notation fixtures are pinned to [BANA's Nemeth Code 2022 and errata](https://www.brailleauthority.org/nemeth-code), [ICEB's UEB publications](https://iceb.org/publications/ueb/), and [APH Braille Brain](https://braillebrain.aphtech.org/nemeth).

### Foundation letter accountability

The sixth room preserves each word as an ordered Unicode-letter signature. Repeated occurrences reference one reusable signature, while every original surface form and occurrence remains in sequence. Each code point is also represented by four reversible six-bit `StructuralCell` values. These cells are computational structure only: they are not Braille, do not inherit Braille meaning, and never activate color or graph semantics. Explicit comparison reports substitutions, insertions, and deletions without converting them into identity or emotional meaning.

The Foundation room can also generate verified JSONL training examples for a future local Qwen model. `POST /api/v1/foundation/training/dataset` accepts `{ "inputs": ["CAT", "BAT"] }` (up to 12 English passages) and returns a fixed 64-token six-bit vocabulary plus four deterministic records per passage: English-to-structure, structure-to-English, ordered-letter accountability, and relational grounding. Every record is produced from the existing deterministic language loop and rejected if its English round trip or structural-cell alignment fails. The same-origin Mirror Runtime facade is `POST /foundation/training/dataset`; the room can preview and download the records as JSONL.

`POST /api/v1/foundation/training/color-atlas` converts the reviewed four-page `ChromaBridge Export example.pdf` source into four verified lessons for each of its 95 rows (380 records total). The committed source manifest preserves the PDF SHA-256, page, row, and extraction confidence; three visually repaired bridge rows remain marked `medium`. Coordinate-neighbor facts use deterministic Euclidean distance only. Imported `base` tiers never become canonical compass anchors, and empty parent or semantic-label fields remain empty. The same-origin facade is `POST /foundation/training/color-atlas`, exposed by **Convert current color atlas** in the Foundation room.

This endpoint prepares data only. It does not train a model, change model weights, assign emotional meaning, mutate the Color Atlas, or alter Braille/Nemeth notation.

The same room also contains the bounded Braille Runtime Language compiler. It preserves an English conditional instruction, produces a Grade 1 UEB transcription, encodes the comparison through the verified Nemeth subset, derives exact sortable six-bit Braille masks, and attaches existing Foundation signature references. Version one accepts only allowlisted proposal/evaluation actions; it cannot modify source files or execute generated code.

The next-stage module assembler accepts only a met proposal plus the explicit `approved` assembly decision. It selects a frozen handler from the runtime registry and returns a deterministic, inspectable review draft. Assembly does not execute generated JavaScript, persist evidence, or commit a graph mutation; an actual commit remains in the existing administrator review workflow.

Governed modules can now be submitted to the persistent Governance queue. Administrators review or reject each draft, issue a hashed fifteen-minute single-use authority, and activate only its frozen handler. Route activation requires two approved graph node ids plus evidence and a falsification condition; it creates a `create_relationship` graph proposal. The approved graph changes only after that proposal completes the existing review and approval workflow. Every module transition is retained in an audit event ledger, and activation retries return the original result without duplicating the proposal.

Foundation also exposes the core reversible language loop at `POST /api/v1/foundation/language-loop`. It preserves the original English, canonicalizes display whitespace, transcribes bounded Grade-1 UEB, exposes every six-dot cell as binary and an integer mask, processes frequencies, transitions, words, and co-occurrences, consults local WordNet plus exact approved-graph relationships, and decodes the same UEB back to English with an explicit round-trip equality result. Encoding preserves the signal; relational evidence remains a separate meaning layer.

The next-stage module assembler accepts only a met proposal plus the explicit `approved` assembly decision. It selects a frozen handler from the runtime registry and returns a deterministic, inspectable review draft. Assembly does not execute generated JavaScript, persist evidence, or commit a graph mutation; an actual commit remains in the existing administrator review workflow.

## Setup

Requirements: Node.js 20+, pnpm, and PostgreSQL.

```bash
pnpm install
copy codex\backend\.env.example codex\backend\.env
pnpm migrate
pnpm dev
```

Set these values in `codex/backend/.env`:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:4180/emotional_translator
AUTH_SECRET=replace-with-at-least-32-random-characters
RUNTIME_SERVICE_TOKEN=replace-this-outside-local-development
WORDNET_READ_TOKEN=replace-with-at-least-32-random-characters
PUBLIC_SIGNUP_ENABLED=true
PUBLIC_APP_URL=http://127.0.0.1:3100
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=replace-me
SMTP_PASS=replace-me
SMTP_FROM=Community Garden <no-reply@example.com>
```

Local Qwen defaults for Mirror Runtime are:

```dotenv
MIRROR_ENABLE_LOCAL_MODEL=true
LOCAL_MODEL_URL=http://127.0.0.1:11434
LOCAL_MODEL_NAME=mirror-qwen3-conversation:v2
```

The active conversation model is the deployment-verified `mirror-qwen3-conversation:v2`, built from the `qwen3:4b-instruct` training base and installed locally in Ollama. `GET /health` reports whether the configured model is available; the browser never calls Ollama directly.

The root development command supplies `mirror-platform-local` as the local token when no token is configured. For non-local environments, always set an explicit secret.

For a UI-only fallback preview without Codex or PostgreSQL, start Mirror Runtime with `MIRROR_ENABLE_CODEX_GRAPH_READ=false` and `MIRROR_ENABLE_PERSISTENCE=false`. The normal `pnpm dev` path keeps both integrations enabled.

Services:

- Codex API: `http://127.0.0.1:3000`
- ChromaBridge UI: `http://127.0.0.1:4173`
- Combined Emotional Translator and Mirror Runtime: `http://127.0.0.1:3100`
- Local Qwen3 through Ollama: `http://127.0.0.1:11434`

Exercise the complete slice after the services are ready:

```bash
pnpm smoke "I feel pulled between ember motion and silver revision."
```

Or call it directly:

```bash
curl -X POST http://127.0.0.1:3100/ask ^
  -H "Content-Type: application/json" ^
  -d "{\"input\":\"I feel pulled between ember motion and silver revision.\"}"
```

## Checks

```bash
pnpm build
pnpm test
```
