# Condition Engine

Local-first condition engine for exploring the Theory of Alignment through the canonical color synonym graph in `data/color-synonyms.json`.

Production frontend: `https://elijahduclair-blip.github.io/emotional-translator/`

## Core Runtime Rule

The visible product center is now the **Condition Engine**.

```text
Node + Stored Route + Condition Source -> Activation
Activation + Context -> Meaning
Repeated Activation / Meaning -> Pattern
```

Read that as:

- `Graph` = store of possibilities
- `Node` = starting point
- `Stored route` = path that exists whether or not anything is using it right now
- `Condition source` = any input that can weight or activate a route
- `Activation` = the event where a stored route becomes relevant now
- `Meaning` = what emerges from activated routes under current context
- `Pattern` = repeated activation behavior across reads

Important rule:

- **The graph stores possibilities. The condition engine decides which possibilities matter now.**

## Foundation Layer

The project now also has a stricter **foundation** pass beneath the condition engine.

Its job is deliberately smaller:

```text
text in -> structure out
```

Foundation does not assign color, meaning, cluster summaries, or active routes. It only returns structural evidence that later layers can use:

- word counts
- co-occurrence counts
- Pareto ordering
- repeated structural patterns

The core shape is:

```json
{
  "stats": {
    "totalWords": 120,
    "distinctWords": 48
  },
  "wordCounts": [
    { "word": "gold", "count": 14 }
  ],
  "coOccurrences": [
    { "word": "gold", "related": "ritual", "count": 7 }
  ],
  "pareto": [],
  "patterns": []
}
```

That layer is available from:

```text
POST /api/v1/foundation/analyze
```

Foundation sessions are stored through:

```text
GET /api/v1/foundation/sessions
POST /api/v1/foundation/sessions
GET /api/v1/foundation/sessions/:id
DELETE /api/v1/foundation/sessions/:id
```

Production target:

```text
https://eli-emotional-translator-api.onrender.com/api/v1/foundation/analyze
```

Request shape:

```json
{
  "text": "gold ritual gold icon memory",
  "options": {
    "windowSize": 2
  }
}
```

Response shape:

```json
{
  "input": "gold ritual gold icon memory",
  "engine": "foundation",
  "version": "1.0.0",
  "boundary": "Foundation returns structure only: counts, co-occurrences, Pareto, and repeat patterns. Color, route activation, and meaning belong to later layers.",
  "stats": {
    "totalWords": 5,
    "distinctWords": 4,
    "totalCoOccurrences": 4,
    "windowSize": 2
  },
  "wordCounts": [],
  "coOccurrences": [],
  "pareto": [],
  "patterns": []
}
```

Boundary:

- **Foundation returns structure only.**
- color assignment belongs to the graph / translator layer
- activation belongs to the condition engine
- meaning belongs to the read that emerges after activation
- `topCluster`, family landings, active routes, and semantic summaries do not belong to this endpoint

Foundation session contract:

- `POST /api/v1/foundation/sessions` accepts:

```json
{
  "title": "Gold ritual pass",
  "text": "gold ritual gold icon memory",
  "options": {
    "windowSize": 2
  }
}
```

- `GET /api/v1/foundation/sessions` returns lightweight saved-session summaries for dashboard/list views
- `GET /api/v1/foundation/sessions/:id` returns the full stored Foundation structure
- `DELETE /api/v1/foundation/sessions/:id` removes a saved structure session

Returned full session shape:

```json
{
  "session": {
    "id": "uuid",
    "title": "Gold ritual pass",
    "input": "gold ritual gold icon memory",
    "options": {
      "windowSize": 2
    },
    "stats": {},
    "wordCounts": [],
    "coOccurrences": [],
    "pareto": [],
    "patterns": [],
    "createdAt": "2026-06-25T10:00:00.000Z",
    "updatedAt": "2026-06-25T10:00:00.000Z"
  }
}
```

Runtime note:

- the authoritative backend service lives in `backend/`
- the separate top-level `api/` folder is an older scaffold and is not the deployed Render source of truth
- if `/api/v1/foundation/analyze` returns `404`, treat that as a deployment/runtime mismatch rather than a reason to substitute `/api/v1/translate`

Search now runs through a path-first translator:

- Personal Shape input context
- graph path discovery
- ranked color landing
- existing evocative names from the landed family

The translator also includes a `Selection climate` layer for pasted sets such as `teal green, blue sapphire, evergreen, red mahogany, sand yellow, irregular quadrilateral`. That layer reads repeated preference pattern across the whole set, separates observable repetition from inference, and keeps the result as a boundary-checked relational climate rather than a fixed personality label.

The graph now follows a **stored vs active route model** inside the condition engine:

- `Node` = starting point
- `Node info cluster` = the smallest local context bundle that gives enough nearby truth to explain why a selected node matters right now
- `Core cluster` = selected node plus direct nearby local routes
- `Extended cluster` = second-hop local web shown only when active routes chain or reconverge strongly enough
- `Route` = possible path
- `Stored possibility` = a route exists in the graph as possibility
- `Context-selected route` = present conditions make that route more relevant now
- `Active route` = the route is currently being used in the read
- `Condition source` = any input that activates, weights, or reshapes which part of the cluster matters now
- `Reasoning` = why this route is the one being followed now
- `Activation` = the event where a stored route becomes meaningful in context
- `Pattern` = repeated activation across clusters rather than a permanent field inside one node
- `Local context` = the current nearby bundle being read
- `Network` = the larger graph beyond the current cluster

This keeps the graph alive without pretending every possible edge is equally active at once. Evidence still belongs on the route: evidence explains why a route is valid at all, while condition sources and reasoning explain why it is active now.

The selected-node panel now uses **Node Info Cluster** as the first visible condition-engine surface. That cluster is not the whole network. It contains:

- the selected node
- stored possibilities nearby
- direct routes in
- direct routes out
- condition sources affecting this node now
- activated routes now
- why those routes activated
- route evidence
- meaning emerging from active routes
- a small local pattern note only when repeated route behavior justifies it

By default the cluster stays at one hop. It expands to a two-hop local web only when active routes chain strongly, reconverge on the same downstream concept, or current conditions make the next step locally necessary.

The graph now also supports **schema packs**. A schema pack is a reusable concept language that can travel through the same shared graph without replacing stored graph truth.

- `Color synonym graph` = canonical backbone / base system
- `Theme condition` = condition-source cover that changes what becomes visible, weighted, or active
- `Language` = a reusable concept schema that can travel through the graph with its own vocabulary rules
- `Schema pack` = the definition bundle for one language domain

Core rule:

- **The graph is shared; the language changes the read.**

For v1 there are two read languages:

- `color` schema pack = the canonical family / branch / source / shade / synonym read
- `theme` schema pack = the same local graph read through filter, condition, source image, theme term, theme expression, and nearby effect

This means the same stored node can stay in one shared network while its local cluster explanation changes under a different readable lens.

The graph now also carries a clearer **node schema** for color structure. The current ladder is:

- `Base color family`
- `Secondary color`
- `Natural source`
- `Shade`
- `Synonym`

These are not interchangeable. A base color family is the root anchor. A secondary color is a branch under that family. A shade is a more exact variation. A synonym is an alternate language path into an existing color route. A natural source is the real-world origin image, such as `ocean`, `pine`, `ember`, `mist`, or `clay`, that gives color its felt context. Natural source does not always sit like a strict child node; it can connect across family, branch, and shade levels because it acts as source context rather than just another color label.

The selected-node panel now exposes this schema directly by showing:

- schema role
- parent bucket
- child branch
- nearby natural sources
- nearby synonyms
- nearby associations

This keeps the node from collapsing into a single flat meaning. The node stores enough local structure to answer: **what kind of thing is this, what belongs to it, and what does it belong to?**

Theme conditions now support **theme-centered clusters**. When you select a theme condition, the cluster stops acting like a plain endpoint card and instead becomes a local effect field: it shows the nearby routes that the theme is actively weighting right now, keeps weaker possibilities stored nearby, and only opens a wider second hop when the weighted routes chain or reconverge strongly enough.

Theme conditions are also the official cross-language selector layer. They sit above node identity and can shape both color reads and future non-color reads. A theme condition can:

- activate one stored route over another
- weight cluster members without rewriting them
- let the same node be read differently under different active conditions
- stay visible as a selector even when it is not acting like a content node

It also exposes a `Pattern extraction` surface for the same kind of set input. That layer names extracted attributes first, then observable patterns, then inferred tendency, so an AI or human reader can inspect how the climate read was built instead of jumping straight to a conclusion.

## Condition Sources

All current runtime inputs now feed one shared activation engine. In v1 the condition sources are:

- theme conditions
- environment conditions
- personal influence
- atlas influence
- history index
- manual pin
- search / input context

Each condition source is treated as:

- `sourceType`
- `sourceLabel`
- `weight`
- `scope`
- `whyItApplies`

Those sources do not rewrite stored graph truth. They decide:

- which stored routes become context-selected
- which context-selected routes become active
- how strongly they become active
- whether they should become visible inside the local cluster

Pattern extraction and survey analysis now also surface **Growth patterns** directly. These are the repeated structures the system thinks are starting to deepen the graph, rather than staying isolated preferences or one-off observations.

The Pattern extraction tab also includes a local-only survey workspace for notebook data shaped like `(name)(date)(color)(shape)`. It extracts color counts, shape counts, month clusters, and color-shape pairings while keeping names out of the shared graph. This is for pattern evidence, not identity claims.

The Personal profile tab now includes a fixed **Personal influence** section. A user can save their name, date of birth, chosen color, chosen shape, and chosen blue/red/green/yellow shades. Those answers act as a private weighting overlay: they can brighten matching nodes and routes, strengthen season/time conditions such as a birth month, and prioritize personal graph visibility without rewriting the shared base model.

The graph uses an **Ecosystem foundation**. The ecosystem is not another object inside the graph; it is the condition field that lets the graph exist and change. The foundation flow is `Experience -> Conditions -> Emotion -> Adaptation -> Behavior -> Language -> Pattern -> Identity tendency`. Natural drivers such as **Light**, **Water**, **Soil**, and **Temperature** sit near the condition level. **Bedrock** holds slower foundation words, **Evergreen** carries repeated growth signals, **Weather** carries temporary search context, and theme conditions/filters act as conditions that change how connected words react. In this model, `color-climate` follows the rules of the environment conditions rather than standing as a separate condition system. This makes the graph alive without silently rewriting baseline truth.

Shared nodes now use a simpler model: node description stays in node metadata, while **evidence belongs on the route/edge**. The graph no longer treats faces or textures as a primary node system. Trust should rise when node type, node description, and route evidence agree.

The color map now groups **shade language** together: direct shades, exact shade phrases, and synonym-style wording support live in the same lane so the computer can treat them as one family of color-language support instead of splitting them into competing tabs.

The system also uses **Node relationships effect** as a core node rule. This replaces the older `Relationship River` wording. It means a node is not only read by itself; it is also read by how it changes when another node is involved. Relation can make a node stronger, weaker, brighter, quieter, more visible, more strained, or differently routed without replacing the underlying node.

Theme conditions are selectors inside that route model. They do not become separate fixed meanings. A theme condition, environment condition, personal influence, or natural atlas influence can make one stored route brighter than another for the present read, then let it fall back to stored-only when the condition is removed.

Theme conditions can also create a **runtime position pull** for nodes inside the shade/condition space. This does not rewrite stored family coordinates. It means a node like `yellow` can temporarily move closer to different routes under a condition such as `Religion`, `Christianity`, or `Arts`, because the active condition changes which relational gravity matters in the current read.

Natural atlas influence now works the same way at the visible-node level. A node can be pulled by nearby natural-source context and that pull can shift the runtime graph position of the node without changing the stored backbone coordinates.

Schema packs plug into that same route model. They do not duplicate nodes or edges. Instead, they define:

- supported node roles
- supported route types
- preferred route evidence language
- optional condition vocabulary
- local display labels
- trace rules for that language

Theme reading now uses two simple trace rules:

- `Forward trace` = `source + filter -> theme`
- `Reverse trace` = `theme -> probable filter -> probable color-climate condition`

Reverse trace is an inference layer, not automatic proof. It helps explain how a visible theme may have been produced without pretending one theme can come from only one filter.

Themes also use their own wording layer. Internally the older `baseClimate` and `composedClimate` fields are still supported for compatibility, but the live read now treats them as **theme terms** and **theme expressions** rather than forcing theme output to sound like a color card.

The frontend uses a hybrid data loader. It keeps `data/color-synonyms.json` as the complete theory reference and checks `http://localhost:3000/api/v1/graph` for a live PostgreSQL graph overlay. If the API is offline or the database graph is empty, the app remains usable from the local atlas and shows its current source status in the sidebar.

Use **Theme system -> Shared graph** to govern PostgreSQL graph changes. Changes are proposals first, then separately reviewed and approved or rejected. Approved create, edit, and delete operations retain version history and can be undone. Relationships require structured route evidence: source, evidence type, confidence, boundary, author, date, review status, and a falsification condition. PostgreSQL `nodes` and `edges` are the authority; theme, emotion, and common-word endpoints are derived from them. Baseline reseeding updates known records without deleting direct database entries.

Use **Theme system -> Research inbox** to search curated public reference sources without letting internet material rewrite the graph. The first sources are Wikipedia for orientation and Crossref for scholarly metadata. A saved result must include a boundary, confidence, and counterexample. It enters as `proposed`, requires administrator review, and can only create a separate graph proposal after approval. The graph still changes only through the existing graph-governance workflow.

Research queries are sent only to the public sources selected in the form. Account details and personal-profile entries are not included. Results are evidence leads rather than strict synonyms, diagnoses, or permanent identity claims.

## Art + Religion History Index

The graph now includes a separate **history index** dataset in [data/history-index.json](C:\Users\eli\Documents\New project\data\history-index.json). This is an era-first cabinet that uses **Religion** and **Arts** as the two active indexing covers for human history while keeping the **color synonym graph** as the canonical backbone.

Core rule:

- `Human history era -> Religion lane / Arts lane -> indexed traditions, movements, symbols, practices, works, institutions -> graph routes into color-climate/context`

This means:

- the **graph** stays the source system
- the **history record** is a condition-source context object
- the **route seeds** are the bridge into graph travel
- the **theme condition** and current context decide when a history record should matter now

Wikipedia is the current **source layer** for this first pass. It is used for orientation and structured indexing, not as automatic graph truth.

Important vocabulary:

- `History index` = curated historical context records that can act as condition sources and weight nearby graph routes
- `Era` = the first organizing shelf, such as `Prehistory / Ancient`, `Classical`, or `Early Modern`
- `Lane` = the second organizing shelf, currently `Religion` or `Arts`
- `Route seed` = a defensible graph bridge term such as `ritual`, `icon`, `architecture`, `memory`, or `devotion`
- `Historical context activation` = the runtime moment a history record becomes relevant enough to shape a local cluster
- `Wikipedia source layer` = the first-pass public orientation source used to structure the history cabinet

The first history cabinet is intentionally quiet:

- era-first navigation
- Religion / Arts lane filter
- region and type filter
- local history detail panel
- `Send to graph read` behavior that activates route seeds without mutating stored graph truth

History indexing does not automatically create graph meaning. A record like `Byzantine art` or `Ancient Greek religion` can contribute route seeds and condition-source weight, but the graph still follows:

1. stored route truth
2. active conditions
3. cluster-local reasoning
4. governed route evidence

The current history index is designed to help the computer travel **history as context** rather than flattening historical material into one more synonym list.

In other words:

- history is not parallel truth
- history is a structured condition source inside the condition engine
- activation decides when a record matters now

## Use With A Custom GPT

The production API includes a separate read-only ChatGPT tool surface. It exposes framework rules, single-input translation, selection-climate pattern reads, and compact approved graph context while excluding profiles, research drafts, proposals, credentials, and administrative operations.

- Action schema: `docs/chatgpt-action-openapi.json`
- GPT instruction block: `docs/custom-gpt-instructions.md`
- Public privacy policy: `privacy.html`
- Public setup page: `gpt-setup.html`

In the Custom GPT editor, add an Action, choose no authentication, and import the public schema URL:

```text
https://elijahduclair-blip.github.io/emotional-translator/docs/chatgpt-action-openapi.json
```

Then place the contents of `docs/custom-gpt-instructions.md` into the GPT's Instructions field and use this privacy-policy URL:

```text
https://elijahduclair-blip.github.io/emotional-translator/privacy.html
```

If you want one page with the public setup links and recommended test prompts, open:

```text
https://elijahduclair-blip.github.io/emotional-translator/gpt-setup.html
```

## Authentication

The public atlas, graph, and translator remain readable without an account. Shared graph proposals, approval records, history, undo, and user profile endpoints require a signed account token.

On the first local run, use the account panel in the sidebar to create the first administrator. Passwords must contain at least 10 characters, including a letter and a number. The browser keeps the signed token in `sessionStorage`, so closing the browser session signs that browser out.

Administrators can review, approve, reject, and undo graph changes. Regular users can submit proposals but cannot alter approved truth directly. The API secret belongs only in `C:\Users\eli\Desktop\api\.env`; the API `.gitignore` excludes that file.

Signed-in users can change their password from the account panel. Password changes increment the account token version and invalidate every earlier browser session. Administrators can create accounts, change roles, require password rotation, and delete other accounts; the final administrator cannot be removed.

## Tests And Backups

Run the API security suite from `C:\Users\eli\Desktop\api`:

```powershell
npm.cmd test
```

Windows Task Scheduler runs `Emotional Translator Daily Backup` at 2:00 AM each day while the Windows user is signed in. The job writes PostgreSQL dumps and logs beneath `C:\Users\eli\Desktop\api\backups`, and removes dumps older than 30 days.

Theory notes:

- `docs/current-system-state.md` summarizes the current app, data layers, category system, and local-only Person 0 boundary.
- `docs/chatgpt-alignment-reference.json` is the AI-usable tool contract for interpreting the color-climate system outside the app.
- `docs/chatgpt-color-web-reference.md` is the human-readable companion reference for the same system.
- `docs/white-light-filter-theme.md` defines the upstream white light, filter, and theme layer.
- `docs/alignment-cross-domain-bridges.md` connects the color-climate anchors through myth, history, science, and arts.

## Run Locally

From this folder, start any static file server and open the printed URL:

```powershell
npx serve .
```

or:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

Opening `index.html` directly may not load the JSON because browsers often block `fetch()` from local files.

## Put Online

This site is static. Host the whole folder with any static hosting service:

- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

The required public files are:

- `index.html`
- `styles.css`
- `app.js`
- `data/color-synonyms.json`
- `docs/chatgpt-alignment-reference.json`

No build step is required.
