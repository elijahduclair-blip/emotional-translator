# Current System State

## Summary

The project is a local-first Emotional Color Translator and Theme Composition Engine. It translates feelings, words, and concepts into explained color-climate paths, then tests how themes combine through categories such as Religion, Season, History, Science, Arts, and the newer language-architecture layers.

The frontend can still run statically from `index.html`, `styles.css`, `app.js`, and `data/color-synonyms.json`. It now checks the local API at `http://localhost:3000/api/v1/graph` and overlays database graph records when available. If the API is offline or its graph is empty, the complete local atlas remains active. Custom concepts and the Personal profile overlay are still saved in browser `localStorage`. `person-0.json` is a local-only seed/stress-test file and is not included in the GitHub Pages publish bundle.

## Public App Layers

- Input context layer: interprets typed words and phrases before graph lookup.
- Translation resolver: ranks graph-backed paths, color landings, and evocative outputs.
- Emotional translator: routes supported emotions and phrase cues into contextual color associations.
- Theme translator: maps white light, filters, and themes into relational climates.
- Theme composition engine: explains how themes affect each other, such as `religion + history`.
- Cross-domain bridges: connects anchors and rivers through myth, history, science, and arts.
- Theme categories: organizes supported themes under Religion, Season, History, Science, Arts, Foundation, Pattern, Translation, Movement, and Identity.
- Theme filters: lets supported themes be added or removed as active relational filters. Active filters are applied to typed searches until removed.
- Custom concepts: lets the user add searched concepts into a best-fit theme category locally.
- Shared graph editor: adds reviewed nodes and optional relationships directly to PostgreSQL through the local API. Every entry requires a definition and boundary; relationship entries also carry evidence and confidence.
- Approval workflow: shared changes move through `proposed -> reviewed -> approved` or `rejected`. Proposals retain author, rationale, reviewer, notes, and timestamps. Only approved changes enter the visible graph.
- Structured evidence: proposed relationships require source, evidence type, confidence, boundary, author, date, review status, and a counterexample/falsification condition.
- Version history: approved create, edit, and delete operations write immutable before/after snapshots. History entries can be undone once; node deletion and restoration include its connected edges.
- One source of truth: approved active rows in PostgreSQL `nodes` and `edges` are authoritative. Theme, emotion, and common-word API lists are derived views of those nodes rather than separate stores.
- Database seeding updates baseline nodes and edges in place instead of truncating the graph, so entries created in the Shared graph editor survive later seed runs.
- Personal profile: lets a local-only life-context overlay shift a read for one person without changing the shared graph.
- Neutral reclassification: moves selected architecture words out of unresolved neutral status and into theme context without making them strict color synonyms.
- Emotion connection layer: connects words to nearby emotions through shared color-climate landings, while preserving the boundary that the emotion is related context rather than a fixed label.
- Emotion shade layer: gives emotion nodes their own shade position; when an emotion routes through multiple color climates, the app mixes those supported colors into one displayed emotion shade.
- Word shade layer: gives common words and supported neutral bridge words graph-derived shade positions; multi-route words mix their connected color climates while unresolved neutral words remain unforced.
- Environment condition layer: treats base and mixed color families as conditions such as heat, depth, exposure, growth, fog, absorption, reflection, or grounding before they become emotional interpretations. This layer now changes the graph by adding condition nodes and condition-synonym nodes while keeping them separate from strict dictionary color synonyms.
- Evocative association layer: uses the baseline color route, emotion connections, and existing mood clusters to explain interpretive meaning without treating it as proof.
- Association map: a Word bank view that groups direct color words, common-word routes, neutral bridge routes, emotion routes, and reclassified theme words into one organized association atlas.
- Neutral words tab: a Word bank view that groups unresolved neutral words by reason while excluding reclassified theme-layer terms.
- Shade graph: a Word bank tool that converts Hex/RGB values and compares color words on X/Y/Z shade axes.
- Natural shade atlas: a Word bank view that groups natural source terms into sky/weather, water/ice, earth/stone, plants, fire/light, body/material, and season/time. Each entry shows source, shade family, environment condition, X/Y/Z position, and graph route; this supports the noun/source plus adjective/condition vocabulary without making nature words strict color synonyms.
- 3D color web: a graph mode that projects nodes into stable shade-space where every axis is centered at `0`: X moves cool negative to warm positive, Y moves dark negative to light positive, and Z moves muted negative to vivid positive; numbered ticks mark the axes, the Z axis is attached to the graph, the axis-view control aligns the view through Free/X/Y/Z perspectives, drag creates a custom view, and clicking a sphere inspects that node.

## Theme Categories

The current category system is:

- Religion: sacred and cultural meaning systems.
- Season: time, weather, cycle, and environmental mood.
- History: memory, institution, pressure, rupture, survival, and inheritance.
- Science: process, mechanism, evidence, structure, and revision.
- Arts: form, perception, symbol, performance, and composition.
- Foundation: experience, perception, emotion, adaptation, and behavior as the human engine.
- Pattern: repetition, structure, connection, relation, context, similarity, and difference as the meaning engine.
- Translation: signal, symbol, representation, color, shade, climate, meaning, and interpretation as the bridge between experience and language.
- Movement: change, response, pressure, growth, stability, regulation, adjustment, and transition as the Spring Method layer.
- Identity: preference, tendency, habit, trait, character, personality, and individuality as the output layer.

These categories are translator context. They do not create strict color synonym evidence.

Neutral words from the imported source lists remain neutral by default. A curated overlay reclassifies Theory of Alignment architecture terms such as `signal`, `context`, `pressure`, and `habit` into their best-fit theme layers. Function words such as `because` remain unresolved.

## Current Example Routes

- `religion` -> Religion base climate.
- `religion + history` -> sacred memory / institution / preservation / inherited pressure.
- `christianity winter` -> vigil / birth in darkness / ritual light / sheltered warmth.
- `islam geometry` -> devotion / order / pattern / sacred abstraction.
- `judaism history` -> covenant / exile / archive / endurance / return.
- `season religion` -> ritual calendar / sacred time / cyclical devotion.
- `foundation` -> human engine / lived input / felt perception.
- `pattern translation` -> relational language / color-climate map / readable network.
- `movement identity` -> pressure-shaped identity / habit under change / recovery pattern.
- `habit` -> Identity Layer base climate.
- `signal` -> Translation layer; no unresolved neutral result.
- `context` -> Pattern layer; no unresolved neutral result.
- `crimson` -> red landing -> related emotions such as anger, danger, and love.
- `cash` -> green landing through cited bridge -> related emotions such as hope, calm, and trust.
- Expanded emotion set: 51 emotion words now route into color-climate landings, including `passion`, `serenity`, `grief`, `clarity`, and `comfort`.
- Expanded common word associations: 116 common words and 311 associated-color routes now connect concrete/culturally legible words into color and emotion context.
- New examples: `moon`, `volcano`, `wedding`, `church`, `mask`, and `electricity` all land in color-climate routes and surface related emotions.
- Evocative association examples: `coffee` -> brown/black baseline -> dread, seriousness, comfort, earthy/rich language; `passion` -> red baseline -> love, anger, danger, romantic/dramatic language.
- Associations tab -> maps direct color words, common words, neutral bridge words, emotion words, and reclassified theme words under their families or theme layers.
- Neutral words tab -> shows unresolved words such as `because` while excluding reclassified terms such as `signal`.
- Shade graph tab -> converts inputs like `#6c8499`, `rgb(108,132,153)`, or known color words into centered X/Y/Z shade coordinates where `0` is the middle of each axis.
- Graph mode button -> cycles Ring, Graph theory, Connected scatter, and 3D color web views; the 3D view keeps the same graph relationships but lets the color nodes sit in a numbered X/Y/Z shade-space with negative and positive directions. The axis-view button cycles Free, X, Y, and Z views so the graph can stay still while the viewer aligns through a chosen axis.
- Selected node detail -> shows **Environment Condition** for supported base and mixed color families. Example: red reads as heat / activation / urgency before it routes to anger, passion, danger, or intensity; green reads as regulation / growth / living balance before it routes to calm, hope, trust, envy, or endurance.
- Graph Show filters -> includes **Conditions**, which toggles environment-condition nodes and condition-synonym nodes on or off.
- Associations tab -> includes **Environment condition synonyms**, grouped under their color families. These are condition-language routes such as heat, urgency, depth, atmosphere, fog, grounding, and reflection; they are translator context rather than strict color synonyms.
- Associations tab -> each association card can show a compact **Synonyms** line. These are drawn from graph neighbors, environment-condition terms, emotion connections, and a curated local association vocabulary; they expand relational language without becoming strict color synonym evidence.
- Natural atlas tab -> groups existing graph terms by natural source fields such as sky/weather, water/ice, earth/stone, plants, fire/light, body/material, and season/time. Common words follow their supported color routes, so a source like `ocean`, `soil`, `coffee`, `snow`, or `rose` can be read as a source-condition entry rather than a loose synonym.
- Emotion words in the graph and Shade graph now display graph-derived shades; mixed emotions such as multi-route feelings blend their connected color-climate components and list the component colors in the detail panel.
- Common words and supported neutral bridge words also display graph-derived shades; examples such as `coffee`, `apple`, `cash`, and `ocean` can mix multiple connected color routes while `because` stays unresolved.
- Active `Christianity` filter + `pressure` -> Christianity + Movement layered climate.
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
