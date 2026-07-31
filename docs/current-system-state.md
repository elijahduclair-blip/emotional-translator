# Current System State

## Structural Space

Before the condition engine can activate anything, the system needs a space to exist inside.

The order is:

```text
Structural Space
-> Core Rules
-> Stored Graph
-> Condition Engine
-> Current Read
```

The graph does not begin with meaning.
It begins with position.

### Space Laws

1. **The Space Exists**
   - The engine operates inside a finite structural space.
   - Nothing can be stored, read, or activated outside that space.
2. **Every State Has a Position**
   - Every valid node has one canonical coordinate.
   - If it has no position, it has no defined structural state.
3. **Movement Is Measurable**
   - A change in state is movement through space.
   - That movement can be measured.
4. **Relationships Are Geometric**
   - Nearness, distance, direction, and paths matter.
   - Labels alone are not enough.
5. **Conditions Change Movement, Not the Space**
   - The condition engine changes what becomes active.
   - It does not rewrite the underlying geometry.

### Structural Space Axioms

```text
S = (X, Y, Z)
Node = (x, y, z)
```

- `X` = horizontal separation / activation-regulation spread
- `Y` = degree of differentiation / revealed structure
- `Z` = signal vividness / opacity lift out of suppression

Reference anchors:

```text
White = (0, 100, 0)
Black = (0, 0, -96)
Blue  = (-94, 64, 8)
Green = (-62, 78, -18)
Yellow = (62, 88, 18)
Red   = (94, 74, 68)
```

These are reference coordinates, not just labels.

### Positioning Evidence Rule

This system measures influence, not meaning.

HEX/RGB values are secondary. They can render, label, or export a color, but they do not decide where the node belongs.

Primary positioning evidence comes from WordNet-style lexical structure and stored graph relationships:

- `hierarchy`: parent/child constraint for where a node can sit.
- `synonym`: proximity evidence for nodes that should sit nearer together.
- `opposite`: contrast evidence that creates a boundary or exclusion pressure.

Positioning math uses those connections first. A node belongs where its hierarchy, synonyms, opposites, bridge parents, and measured routes place it. Color values remain display metadata unless a later pass explicitly uses them as visual evidence only.

### Geometry Before Interpretation

Geometry enters the system in five steps:

1. give every stored node a canonical coordinate
2. measure distance between nodes
3. measure direction as vectors
4. resolve bridge colors between parent anchors
5. let conditions act on movement and activation without rewriting the baseline space

In plain language:

```text
position
-> distance
-> vector
-> neighborhood
-> route
-> activation
-> meaning
```

## Summary

The project is now best described as a structural-space-first **Condition Engine** built on top of the canonical color synonym graph. The graph stores possibilities as experience paths. Nodes store experience. Routes connect experiences. Condition sources decide which stored routes become relevant now. Activated routes produce meaning. Repeated activation produces pattern.

Shortest rule:

- **This system measures influence, not meaning.**
- **`activationWeight` is the graph's first real unit.**

Core runtime rule:

```text
Node + Stored Route + Condition Source -> Activation
Activation + Context + Gradient Travel -> Meaning
Repeated Activation / Meaning -> Pattern
```

Important ordering:

```text
Structural Space -> Influence -> Activation -> Meaning
```

Measurement rule:

```text
Entry + Reuse + Proximity + Recurrence + Condition weight = Influence
Influence + activationWeight + Context + Gradient travel = Meaning
```

This system measures influence, not meaning.

It is measuring:

- what enters
- what repeats
- what stays near what
- what recurs across reads
- what current conditions weight more strongly

That combined pressure is `Influence`. Meaning comes later as a read outcome.

`activationWeight` is the graph's first real unit.

It measures:

- how strongly present condition sources are weighting a stored route
- how close that route is to visible activation now
- how much influence is actually pressing into the current read

Most important correction:

- the system does **not** start from meaning
- it starts from **entry pressure**
- meaning only appears after pressure has become influence, influence has activated routes, and those routes have been read in context

## Context In Structure

Context is the structure around a local read. It is not a mood label and not a free interpretation layer.

```text
Context =
External Environment
+ Exposure
+ Structural Change
+ Current State (Patina)
+ Future Behavior
+ Revision Boundary
```

Context gives the engine the frame needed to decide whether stored possibilities should stay quiet, become context-selected, or become active.

For a node read, context should expose:

- the external environment surrounding the node now
- the exposure/contact event between the node and that environment
- the measurable structural change created by the exposure
- the current state/patina produced by accumulated changes
- the likely future behavior under similar conditions
- the revision boundary that would invalidate the active read

Without this structure, the engine can count and connect nodes, but it cannot defend why one route matters now.

## Structural Humility

Every Local Climate Read is provisional.

The engine does not claim direct certainty about subjective experience or permanent identity. It computes the route that is presently best supported by the local structural evidence available now.

Every supported read should expose:

- the active route
- the supporting structural evidence
- the condition-source and environmental influence
- the historical pattern contribution, when present
- the current support strength, usually through `activationWeight`
- the revision boundary: what would need to change for the current route to lose support

Shortest rule:

```text
best-supported now
not fixed forever
```

Revision rule:

```text
if evidence changes
or condition sources change
or contradictory route pressure enters
then recompute
```

When that happens, the earlier result becomes historical context rather than active truth.

`Unresolved` is a valid outcome.

If the graph cannot sufficiently distinguish among competing routes, returning unresolved is the correct computational result.

System rules:

```text
Foundation
- Node: stored experience; a starting point in the system.

Foundation
- Stored route: a possible path that connects experiences even when nothing is using it right now.

Condition Engine
- Condition source: anything that can weight, select, or activate a stored route, changing which experiences matter now.

Condition Engine
- Activation: the event where a stored route becomes relevant now.

Condition Engine
- activationWeight: the measurable amount of present route relevance created by current condition sources.

Read
- Gradient: the difference in accumulated experience between nodes, routes, or local fields.

Read
- Influence: measurable route pressure created by entry, reuse, proximity, recurrence, and condition weight.

Read
- Meaning: what emerges from traversing active routes and gradients under current context after influence has activated them.

Read
- Pattern: repeated activation behavior across reads.
```

Entry rule:

```text
direct naming
or defensible route support
+ reuse
+ proximity
+ recurrence
+ condition weight
= entry pressure

enough entry pressure
= node influence
```

Operationally:

- language does not enter a node just because it vaguely feels related
- it enters when the system can defend the route and the local pressure is strong enough to count
- repeated entry adds local weight / gravity
- added weight changes later activation behavior and can raise activationWeight on nearby stored routes
- meaning emerges after that, not before that

Interface split:

```text
Foundation = Color map
Condition = Word bank
```

Operational meaning:

- **Foundation / Color map** = the stored structure of base colors, secondary colors, shade language, and routed support
- **Condition / Word bank** = the currently entered, counted, or active language that moves through the stored structure
- the color map stores what is available
- the word bank shows what is being used now
- activation is the bridge between them
- entered language is treated as new experience entering the system

Shortest shared formula:

```text
Foundation + Condition -> Activation
Activation + Context + Gradient Travel -> Meaning
Repeated activation -> Pattern
```

Runtime route unit:

```text
stored possibility
+ condition source pressure
= activationWeight

activationWeight
+ context
= active route visibility
```

## Bridge-Distance Baseline

The stored color map now follows a cleaner anchor-and-bridge rule:

```text
Base colors = fixed anchors
Bridge colors = secondary colors between two strongest base parents
Closer to one side = stronger influence from that parent
Shades = inherit through the strongest bridge/base path
```

Operationally:

- `Base color family` holds the fixed backbone coordinates.
- `Secondary color` is treated as a bridge color, not a free-floating family.
- `Shade` is a refinement that inherits its baseline from the nearest defensible base-or-bridge route.
- `Synonym` remains language support and does not become its own geometry anchor.
- `Main colors never move` inside the stored baseline.
- `All positions are relative`, forming a balanced color space.

Optional 3D extension:

```text
X-axis = Cool (Blue-Green) <-> Warm (Yellow-Red)
Y-axis = Degree of Differentiation
Z-axis = Muted (Gray-Brown) <-> Vivid (Pink-Orange)
```

Interpret the Y-axis as revealed structure:

- `0 = Black` = field / abstract baseline / zero revealed information
- `Gray` = partial differentiation / becoming / structure emerging
- `Bridge colors` = multiple influences between anchors
- `Primary colors` = stable attractors
- `100 = White` = maximum differentiation / fully revealed information

Stored backbone order:

```text
Black
  -> Gray
    -> Bridge colors
      -> Primary colors
        -> White
```

That means:

- `Black` is not merely a negative point; it is the field everything begins inside
- `Gray` is not merely halfway brightness; it is partial differentiation
- `Bridge colors` show mixed influence between anchors
- `Primary colors` behave like stable attractors
- `White` is maximum differentiation / most revealed structure

Boundary:

- the **stored baseline map** uses the bridge-distance rule
- the **live runtime map** can still be temporarily shifted by theme conditions, atlas influence, personal influence, environment conditions, and other condition sources
- removing those condition sources returns the graph to the stored bridge-distance baseline

Question split:

- Foundation asks: `What is available?`
- Condition asks: `What is being used now?`
- Activation asks: `What became relevant?`
- Meaning asks: `What emerged from that relevance?`
- Pattern asks: `What keeps repeating?`

Expanded node rule:

- A node is usually a `word`, `emotion`, `color`, `shade`, `object`, `theme`, or `condition`.
- A node is not limited to only a word or emotion.

## Three Dimensional W.A.T.E.R

The current movement model inside the condition engine is named **Three dimensional W.A.T.E.R**.

`Three dimensional` means route behavior is not treated as one flat straight-line jump. A condition or route can move:

- horizontally
- vertically
- diagonally

W.A.T.E.R expands to:

```text
W = Words
A = Altered
T = Together
E = Entering
R = Reuse
```

Its working formula is:

```text
Word enters node -> node gains weight -> repeated entry increases gravity -> gravity changes later route behavior -> repeated weighted routes create pattern
```

Graph travel rule:

```text
Stored route + entering words + reuse pressure -> heavier node influence
heavier node influence + current condition -> stronger activation pull
stronger activation pull + context -> clearer meaning
```

Interpretation rule:

- words are the entry material
- entering changes the local route field
- meaning is shaped together rather than in isolation
- reuse creates history
- history creates local gravity / weight
- gradients reveal the differences in accumulated experience across that local field

In system terms:

- stored routes remain the possibility layer
- condition sources still decide what can activate
- W.A.T.E.R explains how repeated language travel adds runtime weight to nodes and routes
- meaning becomes clearer when the read traverses those gradients instead of treating every node as equally flat

Current gravity rule:

- each time route activity enters a node, that node can gain local weight
- heavier nodes can influence later route selection more strongly
- repeated weighted behavior is one path by which patterns become visible

Boundary:

- W.A.T.E.R does not automatically rewrite stored graph truth
- it explains movement, reuse, and runtime influence inside the condition engine

The app still translates feelings, words, and concepts into explained color-climate paths, but the product center is no longer "the graph" by itself. The product center is the activation layer that decides which graph possibilities matter under current conditions.

The frontend can still run statically from `index.html`, `styles.css`, `app.js`, and `data/color-synonyms.json`. It now checks the local API at `http://localhost:3000/api/v1/graph` and overlays database graph records when available. If the API is offline or its graph is empty, the complete local atlas remains active. Custom concepts and the Personal profile overlay are still saved in browser `localStorage`. `person-0.json` is a local-only seed/stress-test file and is not included in the GitHub Pages publish bundle.

The live backend source of truth is the Express service in `backend/`. The separate top-level `api/` folder is an older scaffold and should not be treated as the deployed backend contract.

## Public App Layers

- Input context layer: interprets typed words and phrases before graph lookup.
- Condition engine model: keeps approved edges as the persistent possibility store, then marks routes at runtime as `stored`, `context-selected`, or `active` depending on search, theme conditions, environment conditions, personal influence, atlas influence, history index, or manual pinning.
- Node info cluster model: turns the selected-node view into a local activation bundle rather than a flat dump. The cluster holds the selected node, stored possibilities nearby, condition sources affecting this node now, activated routes now, why they activated, route evidence, emergent meaning, and a pattern note only when repeated behavior justifies it.
- Theme-centered cluster mode: when the selected node is a theme condition, the cluster becomes a local effect field. It shows the nearby routes that the condition is actively weighting, separates active field routes from stored field possibilities, and treats the condition as a selector that reshapes local visibility rather than as a normal content endpoint.
- Art + Religion history index: adds an era-first historical cabinet with `religion` and `arts` lanes. History records are condition-source context objects backed by a Wikipedia source layer; they contribute route seeds and runtime activation, but they do not become graph truth automatically.
- Schema-pack model: keeps the color synonym graph as the canonical backbone, then lets the same local cluster be read through different reusable concept languages without duplicating graph truth.
- Translation resolver: ranks graph-backed paths, color landings, and evocative outputs.
- Emotional translator: routes supported emotions and phrase cues into contextual color associations.
- Foundation API: provides the structure-first layer at `POST /api/v1/foundation/analyze`, returning only counts, co-occurrences, Pareto ordering, and repeated structural patterns.
- Foundation session API: provides saved structure-only analysis records at `GET/POST /api/v1/foundation/sessions`, `GET /api/v1/foundation/sessions/:id`, and `DELETE /api/v1/foundation/sessions/:id`.
- Theme translator: maps white light, filters, and themes into relational climates.
- Theme trace rule: supports both `forward trace` (`source + filter -> theme`) and `reverse trace` (`theme -> probable filter -> probable color-climate condition`) as reading tools.
- Theme composition engine: explains how themes affect each other, such as `religion + arts`.
- Cross-domain bridges: connects anchors and rivers through myth, history, science, and arts.
- Theme conditions: organizes supported themes under Religion and Arts as condition fields rather than static bins.
- History activation layer: allows reviewed history records to act as condition sources beside theme condition, environment condition, personal influence, atlas influence, search context, and manual pinning.
- Theme filters: lets supported themes be added or removed as active relational filters. Active filters are applied to typed searches until removed.
- Read language / schema pack control: lets the current cluster switch between `color` and `theme` reads. The graph stays shared, but the labels, local role descriptions, and trace framing change with the chosen pack.
- Custom concepts: lets the user add searched concepts into a best-fit theme condition locally.
- Shared graph editor: adds reviewed nodes and optional relationships directly to PostgreSQL through the local API. Every entry requires a definition and boundary; relationship entries also carry route evidence and confidence.
- Approval workflow: shared changes move through `proposed -> reviewed -> approved` or `rejected`. Proposals retain author, rationale, reviewer, notes, and timestamps. Only approved changes enter the visible graph.
- Route evidence: proposed relationships require source, evidence type, confidence, boundary, author, date, review status, and a counterexample/falsification condition.
- Version history: approved create, edit, and delete operations write immutable before/after snapshots. History entries can be undone once; node deletion and restoration include its connected edges.
- One source of truth: approved active rows in PostgreSQL `nodes` and `edges` are authoritative. Theme, emotion, and common-word API lists are derived views of those nodes rather than separate stores.
- Database seeding updates baseline nodes and edges in place instead of truncating the graph, so entries created in the Shared graph editor survive later seed runs.
- Personal profile: lets a local-only life-context overlay shift a read for one person without changing the shared graph.
- Neutral reclassification: moves selected architecture words out of unresolved neutral status and into theme context without making them strict color synonyms.
- Emotion connection layer: connects words to nearby emotions through shared color-climate landings, while preserving the boundary that the emotion is related context rather than a fixed label.
- Emotion shade layer: gives emotion nodes their own shade position; when an emotion routes through multiple color climates, the app mixes those supported colors into one displayed emotion shade.
- Word shade layer: gives common words and supported neutral bridge words graph-derived shade positions; multi-route words mix their connected color climates while unresolved neutral words remain unforced.
- Natural atlas influence: keeps family coordinates fixed while letting atlas-linked word/object/shade nodes shift through temporary weighted influence vectors. The UI shows this as atlas influence, not as a permanent rewrite of the node’s base coordinates.
- Environment condition layer: treats base and mixed color families as conditions such as heat, depth, exposure, growth, fog, absorption, reflection, or grounding before they become emotional interpretations. Color-climate follows the rules set by these environment conditions. This layer now changes the graph by adding condition nodes and condition-synonym nodes while keeping them separate from strict dictionary color synonyms.
- Evocative association layer: uses the baseline color route, emotion connections, and existing mood clusters to explain interpretive meaning without treating it as proof.
- Association map: a Word bank view that groups direct color words, common-word routes, neutral bridge routes, emotion routes, and reclassified theme words into one organized association atlas.
- Shade language lane: the Color map now keeps direct shades, exact shade phrases, and synonym-style wording support together so shade naming reads as one connected support system.
- Neutral words tab: a Word bank view that groups unresolved neutral words by reason while excluding reclassified theme-layer terms.
- Shade graph: a Word bank tool that keeps Hex/RGB values as secondary display/export metadata while comparing color words through hierarchy, synonym, opposite, route, and X/Y/Z coordinate evidence.
- Natural shade atlas: a Word bank view that groups natural source terms into sky/weather, water/ice, earth/stone, plants, fire/light, body/material, and season/time. Each entry shows source, shade family, environment condition, X/Y/Z position, and graph route; this supports the noun/source plus adjective/condition vocabulary without making nature words strict color synonyms.
- 3D color web: a graph mode that projects nodes into stable shade-space. X moves cool/blue-green to warm/yellow-red, Y measures **degree of differentiation** from `0 = black field / abstract` to `100 = white / fully differentiated`, and Z moves muted/gray-brown to vivid/pink-orange. The stored Y ladder now reads `black -> gray -> bridge colors -> primary colors -> white`; numbered ticks mark the axes, the Z axis is attached to the graph, the axis-view control aligns the view through Free/X/Y/Z perspectives, drag creates a custom view, and clicking a sphere inspects that node.

## Theme Conditions

The current theme-condition system is:

- Religion: sacred and cultural meaning systems.
- Arts: form, perception, symbol, performance, and composition.

These theme conditions are translator context. They do not create strict color synonym evidence.

Current theme-read rule:

- Forward trace: `source + filter -> theme`
- Reverse trace: `theme -> probable filter -> probable color-climate condition`

Reverse trace is interpretive inference. It is useful for explaining how a visible theme may have been shaped, but it is not treated as automatic proof of one single cause.

Neutral words from the imported source lists remain neutral by default. A curated overlay reclassifies Theory of Alignment architecture terms such as `signal`, `context`, `pressure`, and `habit` into their best-fit theme layers. Function words such as `because` remain unresolved.

## History Index Vocabulary

- History index: a curated cabinet of historical context records that can act as condition sources and weight or activate graph travel without replacing stored route truth.
- Era: the first organizing shelf in the cabinet.
- Lane: the second organizing shelf, currently `religion` or `arts`.
- Route seed: a graph bridge term contributed by a history record, such as `ritual`, `icon`, `architecture`, `memory`, `devotion`, or `empire`.
- Historical context activation: the runtime moment a history record becomes relevant enough to shape a local cluster.
- Wikipedia source layer: the first-pass orientation source used to structure history records before any separate graph proposal is made.

The current cabinet is era-first:

- Prehistory / Ancient
- Classical
- Medieval / Post-classical
- Early Modern
- Modern
- Contemporary

Inside each era, the two active indexing lanes are:

- Religion
- Arts

Each history record is kept separate from graph truth. It can contribute:

- era
- lane
- region / civilization
- type
- summary
- boundary
- route seeds
- theme conditions
- anchor hints
- related entries

That record can then appear in a local cluster only when it is materially affecting the current read.

## Foundation API Contract

Foundation is the first gear beneath translation and activation:

```text
text in -> structure out
```

The endpoint is:

```text
POST /api/v1/foundation/analyze
```

Current contract:

- request requires `text: string`
- request supports optional `options.windowSize`
- response returns:
  - `input`
  - `engine`
  - `version`
  - `boundary`
  - `stats`
  - `wordCounts`
  - `coOccurrences`
  - `pareto`
  - `patterns`
  - optional `wordNet`

Boundary:

- Foundation does not assign color
- Foundation does not return family landings
- Foundation does not produce cluster summaries
- Foundation does not activate routes
- Foundation does not produce semantic meaning
- WordNet evidence inside Foundation is lexical evidence only

WordNet evidence can support structure-first language work:

- possible senses
- synonyms
- antonyms
- hypernyms
- related forms
- unresolved words

It does not assign color, climate, activation, route meaning, or identity. It gives later layers better language evidence to inspect, but the Foundation layer still stops before translation and before the Condition Engine.

If a running environment returns `404` for `/api/v1/foundation/analyze`, that means the deployed or local process is older than repo truth or the wrong backend instance is being hit.

## Node Info Cluster Vocabulary

- Node: starting point.
- Node info cluster: the smallest local context bundle that gives enough nearby truth to explain why a selected node matters right now.
- Core cluster: selected node plus direct local routes.
- Extended cluster: second-hop local web shown only when active routes chain or reconverge strongly enough.
- Stored route: graph-supported possibility.
- Context-selected route: present conditions make that route more relevant now.
- Active route: the route currently being used in the read.
- Condition source: any source that activates, weights, or reshapes which part of the cluster matters now.
- Activation: the event where a stored route becomes meaningful in context.
- Reasoning: why this route is being followed now instead of another stored route.
- Pattern: repeated route behavior across clusters, not a permanent field stored inside one node.
- Local context: the current nearby bundle being read.
- Network: the larger graph beyond the current cluster.
- Theme-centered cluster: a cluster mode where a selected theme condition is read as a local effect field acting on nearby routes instead of only as a direct endpoint node.
- Schema pack: a reusable concept language that reads a local cluster through its own node-role labels, route vocabulary, and trace rules.
- Active schema pack: the currently selected readable lens for the cluster.
- Cluster schema mode: whether the local bundle is being read as node-centered or theme-centered under the chosen pack.
- Schema reasoning: why the current pack is a defensible way to read this local cluster.

The cluster can now also surface `History context now` when a reviewed Art or Religion record is locally influencing the selected node. This keeps the history layer quiet and conditional instead of dumping all history under every node.

## Condition Engine Vocabulary

- Graph: the canonical store of possibilities.
- Stored possibility: a route that exists whether or not anything is using it right now.
- Condition source: any current input that can weight or activate a route.
- Activation: the event where a route becomes relevant now.
- Meaning: what emerges from activated routes under present context.
- Pattern: repeated activation behavior across reads.

Current condition sources in v1:

- theme conditions
- environment conditions
- personal influence
- atlas influence
- history index
- manual pin
- search / input context

Each runtime condition source can be described by:

- `sourceType`
- `sourceLabel`
- `weight`
- `scope`
- `whyItApplies`

## Current Example Routes

- `religion` -> Religion base climate.
- `religion + arts` -> sacred form / ritual expression / embodied symbol.
- `crimson` -> red landing -> related emotions such as anger, danger, and love.
- `cash` -> green landing through cited bridge -> related emotions such as hope, calm, and trust.
- Expanded emotion set: 51 emotion words now route into color-climate landings, including `passion`, `serenity`, `grief`, `clarity`, and `comfort`.
- Expanded common word associations: 116 common words and 311 associated-color routes now connect concrete/culturally legible words into color and emotion context.
- New examples: `moon`, `volcano`, `wedding`, `church`, `mask`, and `electricity` all land in color-climate routes and surface related emotions.
- Evocative association examples: `coffee` -> brown/black baseline -> dread, seriousness, comfort, earthy/rich language; `passion` -> red baseline -> love, anger, danger, romantic/dramatic language.
- Associations tab -> maps direct color words, common words, neutral bridge words, emotion words, and reclassified theme words under their families or theme layers.
- Neutral words tab -> shows unresolved words such as `because` while excluding reclassified terms such as `signal`.
- Shade graph tab -> converts inputs like `#6c8499`, `rgb(108,132,153)`, or known color words into centered X/Y/Z condition coordinates where `0` is the middle of each axis.
- Graph mode button -> cycles Ring, Graph theory, Connected scatter, and 3D color web views; the 3D view keeps the same graph relationships but lets the color nodes sit in a numbered X/Y/Z shade-space. X and Z still read as opposing poles, while Y now reads as a `0..100` differentiation ladder from black field to white. The axis-view button cycles Free, X, Y, and Z views so the graph can stay still while the viewer aligns through a chosen axis.
- Selected node detail -> shows **Environment Condition** for supported base and mixed color families. Example: red reads as heat / activation / urgency before it routes to anger, passion, danger, or intensity; green reads as regulation / growth / living balance before it routes to calm, hope, trust, envy, or endurance.
- Graph Show filters -> includes **Conditions**, which toggles environment-condition nodes and condition-synonym nodes on or off.
- Node detail -> now reads as a **Node info cluster**. It keeps **Routes From** and **Routes Into** separate, shows **Stored routes nearby** as quieter local truth, and only opens an **Extended cluster** when active routes chain or reconverge strongly enough to justify a second hop.
- Associations tab -> includes **Environment condition synonyms**, grouped under their color families. These are condition-language routes such as heat, urgency, depth, atmosphere, fog, grounding, and reflection; they are translator context rather than strict color synonyms.
- Associations tab -> each association card can show a compact **Synonyms** line. These are drawn from graph neighbors, environment-condition terms, emotion connections, and a curated local association vocabulary; they expand relational language without becoming strict color synonym evidence.
- Natural atlas tab -> groups existing graph terms by natural source fields such as sky/weather, water/ice, earth/stone, plants, fire/light, body/material, and season/time. Common words follow their supported color routes, so a source like `ocean`, `soil`, `coffee`, `snow`, or `rose` can be read as a source-condition entry rather than a loose synonym.
- Emotion words in the graph and Shade graph now display graph-derived shades; mixed emotions such as multi-route feelings blend their connected color-climate components and list the component colors in the detail panel.
- Common words and supported neutral bridge words also display graph-derived shades; examples such as `coffee`, `apple`, `cash`, and `ocean` can mix multiple connected color routes while `because` stays unresolved.
- Active `Christianity` filter + `architecture` -> Christianity + Arts layered theme.
- `scared but hopeful` -> blended emotional climate.
- `because` -> unresolved; no forced category or theme.

## Personal Profile And Local Seed

The Personal profile tab stores a local-only overlay in browser `localStorage`. It can hold anchors, pressures, relationships/roles, seasons/time periods, memories/places, and boundary notes that produce a **Personal read** when a search matches profile context.

`person-0.json` can seed the local profile and provide stress-test terms. It contains the current Theory of Alignment vocabulary, category hints, rivers, and anchor families used to test the translator against the user's own framework.

Rules:

- Use the Personal profile as an overlay only; it does not rewrite the shared graph.
- Do not include `person-0.json` in the GitHub Pages publish bundle.
- Seed hints may influence local category assignment.
- If `person-0.json` is missing online, the app should continue working with an empty local profile.

## Public/Private Boundary

Public publish bundle:

- `index.html`
- `styles.css`
- `app.js`
- `scripts/vendor/three.min.js`
- `data/color-synonyms.json`
- `README.md`
- `docs/`
- `.nojekyll`

Local-only:

- `person-0.json`
- Browser `localStorage` saved custom concepts
- Browser `localStorage` saved Personal profile
- Any private stress-test notes not explicitly copied into the publish folder

## Current Verification Targets

Local app URL:

- `http://localhost:4174`

Expected local checks:

- `/` returns `200`.
- `/app.js` returns `200`.
- `/styles.css` returns `200`.
- `/scripts/vendor/three.min.js` returns `200`.
- `/data/color-synonyms.json` returns `200`.
- `/person-0.json` may return `200` locally only.
- The publish folder and zip do not include `person-0.json`.

Behavior checks:

- Theme categories render under the Theme system tab.
- My concepts can save new searched concepts locally.
- Personal profile tab renders local entries and can seed from local stress terms.
- Function words such as `because` stay unresolved.
- 3D color web renders nonblank nodes and edges, supports Free/X/Y/Z axis-facing views, supports drag rotation into a custom view, and keeps node selection working by click.

## Geometric Discovery

This system measures influence, not meaning.

Geometric Discovery is a review layer over the structural space. It looks for unconnected node pairs that are close in the graph geometry and asks whether that closeness is a possible missing bridge, a useful boundary, or coincidence.

It must not create permanent graph truth automatically.

For every pair of nodes without a stored semantic route, the engine can:

1. Measure geometric distance.
2. Check shared neighbors.
3. Check compatible node types.
4. Check whether placements came from independent evidence.
5. Rank the pair as a candidate.
6. Require review before any permanent route is created.

Distance is normalized inside the discovery radius:

```text
D(A,B) = 1 - d(A,B) / r
```

Candidate score:

```text
S(A,B) = wdD(A,B) + wnN(A,B) + wtT(A,B) + wpP(A,B)

Default weights:
wd = 0.4
wn = 0.3
wt = 0.2
wp = 0.1
```

Where:

- `D` is normalized geometric proximity: `1 - d(A,B) / r`.
- `N` is shared-neighbor support: `min(1, shared_neighbors / 5)`.
- `T` is tier/type compatibility.
- `P` is placement-source independence.

Candidate type:

```text
if shared_neighbors < 2 and local_density > 4:
  candidate = new_node
else:
  candidate = bridge
```

`new_node` means the local geometry may be pointing to a missing intermediate concept. `bridge` means the local geometry may be pointing to a missing route between existing concepts.

The first interface is the Discovery panel in the selected-node cluster. A selected suggestion may show a temporary dotted ghost connection, but only as review evidence. The reviewer decides whether the candidate becomes a bridge, a boundary, or an ignored coincidence.
