# Online Deployment

The public system uses three services:

- GitHub: source repository and GitHub Pages frontend
- Render: HTTPS Node/Express API
- Neon: managed PostgreSQL database

## 1. GitHub

Create the public repository `elijahduclair-blip/emotional-translator`, then push this repository's `main` branch.

In the GitHub repository:

1. Open **Settings -> Pages**.
2. Set **Source** to **GitHub Actions**.
3. Open **Settings -> Secrets and variables -> Actions**.
4. Later, add `PRODUCTION_DATABASE_URL` with the Neon connection string for scheduled private backups.

The Pages workflow publishes only `index.html`, `styles.css`, `app.js`, `config.js`, `.nojekyll`, `data`, and `docs`. It does not publish the backend, local profile, screenshots, or secrets.

## 2. Neon PostgreSQL

Create a Neon project named `emotional-translator`, then copy its pooled PostgreSQL connection string. Keep it private.

Each Render service start runs the idempotent database migration and seed before opening the API. This works on Render's free tier and creates or refreshes the approved graph from `data/color-synonyms.json`; it does not copy the exposed local password or local-only personal profile.

## 3. Render API

In Render, create a **Blueprint** from the GitHub repository. Render detects `render.yaml` and creates the free HTTPS web service `eli-emotional-translator-api`.

When prompted for `DATABASE_URL`, paste the private Neon connection string. Render generates and stores `AUTH_SECRET`, `RUNTIME_SERVICE_TOKEN`, and `WORDNET_READ_TOKEN`. Never put these values in Git, screenshots, browser URLs, or frontend JavaScript. Copy the generated runtime token into the separately deployed Mirror Runtime service so both services use the same value; do not reuse it as the WordNet token.

The production CORS allowlist contains only `https://elijahduclair-blip.github.io`. Keep localhost origins in local `.env` files, not in the deployed service.

Public learner accounts also require `PUBLIC_APP_URL` and generic SMTP configuration (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`). `PUBLIC_APP_URL` must be the HTTPS origin serving the combined Mirror Runtime shell. Render refuses production startup when public signup is enabled but these values are missing. Verify the sending domain with the selected SMTP provider before enabling public traffic.

After deployment, verify:

- `https://eli-emotional-translator-api.onrender.com/api/health`
- `https://eli-emotional-translator-api.onrender.com/api/v1/foundation/analyze` with a `POST` body like `{"text":"gold ritual gold"}`
- `https://eli-emotional-translator-api.onrender.com/api/v1/graph`

The public structure and translation endpoints are rate-limited to 120 requests per client per minute. Foundation session storage and retrieval require an authenticated administrator. WordNet is a bounded, read-only outside request and requires its separate bearer token:

```bash
curl "https://eli-emotional-translator-api.onrender.com/api/v1/wordnet/lookup?term=gold" \
  -H "Authorization: Bearer $WORDNET_READ_TOKEN"
```

Keep this call server-to-server. A browser frontend cannot safely hold the WordNet token; if public visitors need lexical results, route an intentionally bounded request through Mirror Runtime instead of embedding the credential.

Braille Math deployment checks:

- `GET /api/v1/braille/math/curriculum` returns eight versioned lessons and a `notation_only` boundary.
- `POST /api/v1/braille/math/translate` translates the supported subset without authentication and returns `422` for unsupported structures.
- Signup mail links use URL fragments so verification and reset tokens are not sent in ordinary HTTP request paths.
- Mirror Runtime sets the Codex session as an `HttpOnly; SameSite=Strict; Secure` cookie and never returns the bearer token to browser JavaScript.
- Account progress endpoints require authentication and do not contain raw submitted answers.

Foundation contract boundary:

- `POST /api/v1/foundation/analyze` is the structure-only endpoint for word counts, co-occurrences, Pareto ordering, and repeated structural patterns
- `POST /api/v1/foundation/letters/analyze` accounts for ordered Unicode letters, repeated positions, and reversible four-by-six-bit `StructuralCell` records; complete inputs are limited to 10,000 code points
- `POST /api/v1/foundation/letters/compare` returns an explicit substitution, insertion, and deletion ledger for two bounded word patterns
- `POST /api/v1/foundation/braille-runtime/compile` compiles bounded English conditionals into UEB text, a Nemeth condition, sortable Braille cell masks, and a proposal-only instruction record
- `POST /api/v1/foundation/language-loop` performs the reversible English → UEB → six-bit numbers → Foundation/relational evidence → UEB → English loop and reports whether canonical English returned exactly
- `POST /api/v1/foundation/braille-runtime/assemble` recompiles a met instruction and selects a predefined runtime handler after an explicit assembly approval; it returns a review draft without external mutation
- authenticated `POST /api/v1/foundation/braille-runtime/modules` persists a deterministic assembled module; administrators can list, review, issue authority, activate, and inspect its event ledger under `/modules/:id/*`
- activation authority is stored only as a SHA-256 hash, expires after fifteen minutes, is single-use, and is idempotent on safe retry
- route activation creates a pending `create_relationship` graph proposal with approved endpoints, provenance, evidence, and a counterexample; it never inserts an approved edge directly
- the Braille Runtime compiler never edits source or executes generated code; unsupported actions return `422`
- `StructuralCell` values are not Braille, do not inherit Braille meaning, and cannot assign colors or mutate graph knowledge
- it does not return color landings, family meaning, cluster summaries, or activation results
- if this endpoint returns `404`, compare the Render deploy commit and startup logs before changing frontend or Base44 code

Important repo note:

- Render should build from the `backend` folder described in `render.yaml`
- the top-level `api/` folder is an older scaffold and should not be treated as the live backend source

If Render assigns a different service hostname, update the production URL in `config.js`, commit, and push.

## 4. Final Verification

Open the GitHub Pages URL. The sidebar should show the production database connection and ask to create the first administrator account. Use a new password that has never appeared in a URL or local screenshot.

Expected frontend URL: `https://elijahduclair-blip.github.io/emotional-translator/`

The production backup workflow runs daily and retains each private GitHub artifact for 30 days after the `PRODUCTION_DATABASE_URL` repository secret is configured.
