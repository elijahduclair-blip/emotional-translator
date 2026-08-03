# Mirror Platform

Mirror Platform keeps three existing systems separate while giving them one emotional-translation vertical slice:

```text
MirrorRuntime.ask(input)
  -> ChromaBridge.evaluate(input)
  -> Codex.translateGraph(input)
  -> Codex.saveEvaluation(evaluation, translation)
```

- `codex/` is the Emotional Translator application and PostgreSQL API.
- `chromabridge/` is the constitutional and semantic governance layer.
- `mirror-runtime/` is the reasoning/runtime service.

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

| Anchor | Degree | Address root |
| --- | ---: | ---: |
| Red | 10° | `4` |
| Orange | 50° | `5` |
| White | 90° | `1` |
| Yellow | 130° | `6` |
| Blue | 170° | `2` |
| Green | 210° | `7` |
| Black | 250° | `3` |
| Purple | 290° | `8` |
| Gray | 330° | `9` |

Every direction is 40° from its neighbors. Address roots preserve the original White/Blue/Black/Red ordering, while the degree grid supplies equal visual spacing. A shade inherits a child address such as `1.1`; a word beneath that shade inherits another segment such as `1.1.1`. Addresses are dot-delimited strings, not floating-point numbers, so `1.10` remains distinct from `1.1`. New detail refines an existing direction and never creates a new anchor.

The original XYZ coordinate remains the node's exact structural position. `degreeOfVision` identifies its fixed compass direction, and `decimalAddress` identifies its color → shade → word location within that direction.

Open `http://127.0.0.1:3100` to use the combined emotional translator. ChromaBridge first traces natural climate signals and preserves a `proposal_only` boundary. Codex reads the approved relational graph first and consults imported color knowledge only when the approved graph has no exact result. Mirror Runtime returns the combined reading and Codex records it in `runtime_evaluations`, separate from approved graph nodes and edges.

Graph reads are transport-bounded to 12 nodes and 24 routes. The response includes detailed evidence once and a compact `knowledgeLayer` summary; runtime memory stores the landing, evidence summary, and node/route IDs rather than a second graph snapshot. This keeps persistence below the 64 KB API guardrail without merging knowledge into memory.

If neither the approved graph nor imported knowledge has an exact match, the translator keeps ChromaBridge's unresolved or natural-climate reading instead of inventing graph evidence. A translation does **not** approve or mutate durable semantic meaning.

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
```

The root development command supplies `mirror-platform-local` as the local token when no token is configured. For non-local environments, always set an explicit secret.

For a UI-only fallback preview without Codex or PostgreSQL, start Mirror Runtime with `MIRROR_ENABLE_CODEX_GRAPH_READ=false` and `MIRROR_ENABLE_PERSISTENCE=false`. The normal `pnpm dev` path keeps both integrations enabled.

Services:

- Codex API: `http://127.0.0.1:3000`
- ChromaBridge UI: `http://127.0.0.1:4173`
- Combined Emotional Translator and Mirror Runtime: `http://127.0.0.1:3100`

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
