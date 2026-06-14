# Color Synonym Evocative Converter Spec

## Purpose

This dataset supports a color-name converter that turns ordinary color inputs into evocative editorial alternatives. It is intended for naming systems in design, fashion, interiors, branding, writing, and product catalogs.

This phase defines the vocabulary and taxonomy only. It does not include a UI, CLI, API, or lookup implementation.

## Dataset

Primary artifact: `data/color-synonyms.json`

The dataset is organized by color family. Each family includes canonical aliases and mood clusters. A future converter should normalize a user input, match it against `aliases`, then return the matching family's mood groups and names.

The dataset also includes `bridgeTerms`. These are creative evocative metadata only; they are not part of the strict synonym graph and should not be treated as definition-backed color synonyms.

The dataset also includes a strict `graph` layer. The graph makes direct color-definition synonym relationships machine-readable so a future converter can render a network or explain why a color term belongs to a family. It also expands each alias into three cited synonym-word connections.

The dataset also includes `commonWords`, a separate layer for everyday English words imported from `100 common.docx`. These are not strict synonyms. Concrete terms can connect to color families or aliases with `associated_color`; abstract or function words stay in `neutralWords.unconnected`.

The dataset also includes `englishWords`, a larger index imported from `3,000 english words.docx`. It follows the same rule: concrete words with defensible color associations become `common_word` nodes, while unmatched words remain searchable in `neutralWords.unconnected`.

Common-word graph nodes may include `metadata.contextDefinition`. This definition clarifies the everyday sense being routed, such as `coffee` as a drink or `sky` as the space above the earth. It is input context only, not strict synonym evidence.

The dataset also includes `neutralWordConnections`, a cited lexical bridge layer for selected words that remain neutral. These connection paths combine concrete associations and cited synonym bridges for discovery, but do not promote neutral words into direct color mappings.

The dataset also includes `inputContext`, the Personal Shape layer. This is the beginning of the translator: it evaluates the input before graph retrieval so the system can decide whether it is looking at a direct color, a semantic bridge, or a neutral unresolved term.

The dataset also includes `translationResolver`, the path-first landing layer. This is the end of the translator: it ranks evidence-backed paths, chooses a color family or alias landing when one exists, labels confidence as `high`, `medium`, or `low`, and then returns existing evocative names from the landed family.

The dataset also includes `emotionTranslator`, a contextual emotional translation layer. Emotion words such as `anger`, `joy`, `fear`, `sad`, `love`, `peace`, and `hope` are allowed to start a translation path, but they are not strict color synonyms. Their edges use `emotion_association`, which means "this feeling can route toward this color in translator context." These routes are medium confidence by default and should always be shown as emotional associations, not dictionary definitions.

```json
{
  "id": "blue",
  "label": "Blue",
  "aliases": ["blue", "azure", "navy", "cobalt"],
  "moods": [
    {
      "id": "serene",
      "label": "Serene",
      "intensity": "soft",
      "names": ["harbor mist", "porcelain tide", "quiet azure"]
    }
  ]
}
```

## Input Mapping

Inputs should be compared case-insensitively after trimming whitespace. The first version expects simple color names or known aliases, such as `blue`, `navy`, `sage`, `crimson`, `pearl`, or `terracotta`.

If more than one family could plausibly match a word, prefer the family where the alias is most common in color naming. For example, `sage` maps to green, `navy` maps to blue, and `crimson` maps to red.

## Personal Shape Input Context Layer

The input context layer is the beginning of the system. It turns messy human language into graph-ready meaning before the strict color graph or creative naming layer is allowed to respond.

The layer uses three confidence states:

- `direct_color`: high confidence. The input is already a definition-backed color family, alias, or cited color synonym, such as `red`, `navy`, `crimson`, `sage`, or `gold`.
- `semantic_bridge`: medium confidence. The input is not itself a color term but has an evidence-backed route through concrete association or cited synonym paths, such as `cash -> money -> green`.
- `neutral_unresolved`: low confidence. The input does not safely point to a color without more context or citation, so it stays neutral.

Routing order:

- Normalize the input.
- Detect direct color terms.
- Detect concrete common-word associations.
- Detect cited neutral synonym bridges.
- Inspect phrase context and possible word senses.
- Score candidate paths by confidence and path length.
- Return a color landing or a neutral unresolved status.

Personal Shape signals include word sense, sentence context, domain, emotional framing, intended meaning, ambiguity, and user framing. For example, `cold` by itself can remain neutral, but `cold morning` may activate a weather shape that can look for frost, snow, blue, or white routes. `cold` as illness should stay unresolved unless a cited path is added.

The context layer must not invent synonyms, force every word into a color, or use mood names as evidence. It can choose which evidence-backed graph route to inspect; it cannot overwrite strict graph truth.

## Translation Resolver

The translation resolver turns graph retrieval into a path-first result. It should show the route before the recommendation: translation path, emotional read when present, color landing, evocative outputs, then alternative paths.

Resolver behavior:

- Direct color terms land on their family or alias with `high` confidence.
- Emotion words can land through `emotion_association` with `medium` confidence.
- Common-word associations land through `associated_color` with `medium` confidence.
- Neutral words can land through cited neutral synonym paths with `medium` or `low` confidence depending on path length.
- Unconnected neutral words remain unresolved with `low` confidence and no forced color.

For emotional inputs, the resolver should include an emotional read:

- detected emotion label
- tone, such as heated, alert, low, bright, tender, quiet, open, or steady
- confidence label
- emotion definition
- phrase cue or edge evidence that explains why the input entered that route

For mixed emotional inputs, the resolver should include an emotional blend when two or more distinct emotion routes are detected. The blend should show:

- emotion components, such as `fear / alert` and `hope / open`
- the family or landing each component contributes
- a compact blended palette made from the unique landed families

The blend is explanatory. It does not create a new strict synonym, and it does not generate new color names.

Primary landing selection:

- Prefer direct family, alias, or cited color synonym matches.
- Then prefer the shortest evidence-backed path to a color family or alias.
- Prefer alias landings over broad family landings when confidence and path length are equal.
- If no path reaches a color, keep the term neutral.

Evocative output should come only from existing mood clusters in the landed family. The resolver must not generate new names or use mood names as evidence.

Example resolver outcomes:

- `red` -> `Red`, high confidence, direct family path.
- `crimson` -> `crimson` / red, high confidence, direct alias path.
- `coffee` -> brown, black, or espresso paths, medium confidence, through concrete association.
- `joy` -> yellow, yellow-orange, or orange paths, medium confidence, through emotional association.
- `fear` -> black, blue-black, or gray paths, medium confidence, through emotional association.
- `cash` -> money -> green, medium confidence, through cited synonym plus mapped common word.
- `because` -> neutral unresolved, low confidence.

## Emotional Translator Layer

The emotional translator layer is the middle translator for feeling language. It gives the system a beginning for emotional inputs before the graph lands in color and before evocative names are returned.

Node type:

- `emotion_word`: a feeling word that starts an emotional translation path, such as `anger`, `joy`, `fear`, `sad`, `love`, `peace`, `hope`, `trust`, `calm`, or `danger`.

Edge type:

- `emotion_association`: the source emotion word has a contextual translator route to the target color family, subfamily, shade, or another canonical emotion word.

Rules:

- Emotion words are not direct color synonyms.
- Emotion routes are lower authority than strict color definitions and direct aliases.
- Emotion routes can suggest a color landing and evocative outputs.
- The UI should label these paths as emotional associations.
- If an emotion is ambiguous or unsupported, it should remain neutral instead of being forced into a color.
- Phrase cues can route natural emotional language to canonical emotion nodes. For example, `on edge` can route to `fear`, `heartbroken` can route to `sad`, and `hopeful` can route to `hope`.
- Phrase cues are input interpretation only. They are not color evidence, and they should be shown before the color landing as part of the translation path.

Examples:

- `anger -> red`, with an alternative heated route toward `red-orange`.
- `joy -> yellow`, with alternatives toward `yellow-orange` and `orange`.
- `sad -> blue`, with alternatives toward `gray` and `blue-gray`.
- `fear -> black`, with alternatives toward `blue-black` and `gray`.
- `love -> red`, with alternatives toward `pink` and `pink-red`.
- `on edge -> fear -> black`, with alternatives toward `blue-black` and `gray`.
- `heartbroken -> sad -> blue`, with alternatives toward `gray` and `blue-gray`.
- `scared but hopeful -> fear + hope`, producing a blended palette from black/blue-gray and green/yellow routes.

## Bridge Terms

Bridge terms make related evocative language explicit. They do not replace family aliases, and they are not valid evidence for the strict synonym graph.

For example, `rose` connects red, pink, and purple because it can suggest crimson romance, blush softness, or floral violet tones. `charcoal` connects gray, black, and blue because it can suggest slate, ink, or navy shadows.

A converter can use bridge terms in creative or exploratory modes:

- When an evocative name contains a bridge word, surface related color families as creative nearby suggestions.
- When a user searches a bridge word directly, return linked families only if the UI labels the result as evocative, not as a direct synonym.

Bridge term fields:

- `term`: the shared evocative word.
- `type`: the semantic kind, such as `material`, `botanical`, `mineral`, `earth`, or `atmosphere`.
- `families`: color families connected by the term.
- `relatedAliases`: family aliases that explain the connection.
- `evocativeUse`: short guidance for how the word shifts the feeling of a color.

## Synonym Graph

The `graph` object contains `nodes` and `edges`. It is strict: graph nodes and graph edges must be based on direct color-term definitions only. Do not add invented evocative phrases, poetic associations, mood links, or interpretive bridge nodes to the synonym graph.

Node types:

- `family`: a main color group, like red, blue, green, black, or white. This is the broad color bucket where related color words land.
- `alias`: a real color name that belongs to a color family, like crimson for red or navy for blue. This is a specific color word people can search for directly.
- `synonym`: a word connected by dictionary or thesaurus evidence. This helps the graph move from one real word to another without guessing.
- `subfamily`: an in-between color zone made from two color families, like red-orange or blue-gray. This makes cross-family routes easier to see.
- `shade`: a real natural or material color name, like persimmon, slate, coral, ochre, or ivory. The exact leaning phrase stays in metadata as evidence, such as reddish orange or bluish gray.
- `common_word`: an everyday word that is not a color, but can have a clear color association, like coffee, snow, or grass. This can suggest a color through a concrete object or idea.
- `neutral_word`: a word that does not safely point to a color by itself. This stays unresolved unless a cited synonym path or clear context connects it to color.

Edge types:

- `has_synonym`: the source family points to a directly defined color synonym.
- `has_subfamily`: the source family points to an in-between bridge color, such as red-orange or blue-gray.
- `definition_contains`: the source alias has a secondary color family explicitly present in its definition, such as `sage` being grayish green.
- `synonym_overlap`: two alias terms share a direct definition phrase, such as `deep red`, `pale purple`, or `bluish gray`.
- `has_expanded_synonym`: the source alias points to a cited synonym-word node.
- `shade_of`: the source color word points to a natural shade name backed by its exact definition phrase.
- `shade_of_subfamily`: the source natural shade name points to the in-between bridge color it belongs to.
- `shade_mentions_family`: the source natural shade name points to a family named or implied by its definition phrase.
- `same_term`: an alias node and synonym node have the same normalized label while serving different graph layers.
- `associated_color`: a common word points to a color family or alias through a concrete object/color association.
- `neutral_synonym`: a neutral word points to a cited synonym bridge node.
- `synonym_to_mapped_word`: a cited synonym bridge points to a mapped `common_word`.
- `synonym_to_color_alias`: a cited synonym bridge points to a color family or alias.

Edge direction:

- `Routes From This Node` means the selected node is the edge source. These routes show what the selected node can directly resolve, expand, or point toward.
- `Routes Into This Node` means the selected node is the edge target. These routes show what can arrive at the selected node through family, alias, synonym, common-word, or neutral-word paths.
- Direction should always be displayed as `source -> target`, with a role label such as `starts here` or `arrives here`.
- Direction is evidence flow, not visual similarity. Reversing an edge changes the meaning unless a separate reverse edge exists.

Lookup behavior:

- Direct alias lookup should still use the `families[].aliases` list as the strongest source of truth.
- Graph arrows represent definition flow: family to direct synonym, synonym to secondary family, or synonym to synonym by shared definition phrase.
- Every graph edge should include an `evidence` field with the definition phrase or direct relationship used for the connection.
- Every alias node should have exactly three outgoing `has_expanded_synonym` edges in this version.
- Every synonym node should include `sourceName`, `sourceUrl`, `sourceTerm`, `evidence`, and `definitionBasis` metadata.
- Repeated synonym words must reuse the same `synonym-*` node instead of creating duplicates.
- Common words should use `associated_color` only; they must not use strict synonym edge types.
- Words without a strong concrete association or cited synonym path should stay in `neutralWords.unconnected` with `status: "neutral"`.
- Neutral words should use only cited synonym bridge edges; they must not use `has_synonym`, `has_expanded_synonym`, or `associated_color` directly.
- Every neutral synonym bridge must include source name, URL, source term, evidence, and `bridgeBasis: "cited synonym"`.
- The graph should not use `bridgeTerms`, mood clusters, or generated evocative names as evidence.

Evidence modes:

- Strict color synonym edges use definition evidence between color families, aliases, and cited synonym nodes.
- Cited synonym expansion edges use source metadata on `synonym` nodes.
- Concrete common-word associations use `associated_color` and must be labeled as object/color associations, not synonyms.
- Common-word context definitions explain which everyday sense is being associated with color; they do not create a color edge by themselves.
- Common words may point to `subfamily` or `shade` nodes when the bridge makes a broad color jump clearer, such as `beer -> yellow-orange` or `coal -> dark charcoal`.
- Shade nodes should display natural/material names while preserving exact definition phrases in `metadata.definitionPhrase`.
- Neutral synonym bridges use cited dictionary/thesaurus evidence and are lower-confidence discovery paths, not direct color mappings.

Reverse search behavior:

- Searching a color family or alias should surface incoming common words as connected matches.
- Searching a common English word should surface its associated color families and aliases.
- Searching an unmatched neutral term should surface the neutral item and reason without creating a graph connection.
- Searching a bridged neutral term should surface a separate "Neutral connections" result showing the cited path to a mapped common word or color family/alias.
- Selected Theory of Alignment architecture terms may be listed in `neutralWords.reclassified`. These terms are removed from unresolved neutral search results and shown as theme-layer context instead.
- Reclassified neutral terms do not create graph synonym evidence, do not add strict color mappings, and still require composition/theme logic for interpretation.
- Searching any input should also surface a path-first translation result showing confidence, primary landing, existing evocative outputs, and alternative paths when available.

Examples:

- Red hub: `family-red` points to `alias-crimson`, `alias-ruby`, `alias-garnet`, `alias-scarlet`, `alias-cherry`, and `alias-vermilion`; `alias-crimson` points to `alias-ruby` by shared `deep red`, and `alias-scarlet` points to `alias-cherry` by shared `bright red`.
- Purple hub: `family-purple` points to `alias-lavender`, `alias-lilac`, and `alias-violet`; `alias-lavender` points to `alias-lilac` by shared `pale purple`, and `alias-violet` points to `family-blue` because its definition contains `bluish purple`.
- Orange/brown chain: `family-orange` points to `alias-terracotta`; `alias-terracotta` points to `family-brown` because its definition is `brownish orange`; `family-brown` points to `alias-copper`; `alias-copper` points to `family-red` because its definition is `reddish brown`.
- Synonym expansion: an alias such as `crimson` points to three cited synonym nodes; if another alias also expands to `ruby`, both aliases connect to the shared `synonym-ruby` node.
- Common word association: `common-coffee` points to `family-brown`, `family-black`, and `alias-espresso`; `common-water` points to `family-blue`; unmatched terms such as `because` remain in `neutralWords.unconnected`.
- Larger English index: `english-blood` points to red color language, `english-grass` points to green, `english-sky` points to blue, and unmatched words from the 3,000-word source remain in `neutralWords.unconnected`.
- Neutral connection path: `neutral-cash` points to the cited synonym bridge `money`, which points to `common-money`; `neutral-angry` points to `seeing red`, which points to red color language.
- Translation landing: `coffee` can land through `associated_color` paths to brown, black, or espresso, then display mood names from the selected landing family.

## Mood Clusters

Mood clusters describe the editorial direction of the returned names:

- `serene`, `quiet`, `minimal`, and `clean` are restrained, airy, and calm.
- `electric`, `juicy`, and `luminous` are vivid, bright, and energetic.
- `antique`, `earthy`, `sunbaked`, and `industrial` are tactile, aged, mineral, or grounded.
- `opulent`, `regal`, `rich`, and `classic` are polished, luxurious, and formal.
- `nocturnal`, `dramatic`, `mysterious`, and `stormy` are deep, shadowed, and high-contrast.
- `romantic`, `delicate`, `dreamlike`, and `ethereal` are soft, emotive, and atmospheric.

Intensity values describe the broad chromatic feel: `pale`, `soft`, `muted`, `vivid`, `warm`, or `deep`.

## Naming Style Rules

Names should be lowercase, editorial, sensory, and practical. Prefer short two- or three-word phrases that could plausibly name a paint color, textile, product finish, or brand palette.

Use concrete nouns and materials where possible: `porcelain`, `linen`, `copper`, `velvet`, `chalk`, `stone`, `cedar`, `glass`.

Avoid technical color values, abstract filler, repeated names, and phrases that are too long to scan in a palette interface.

## Example Conversions

Input `blue` resolves to the blue family:

- serene: `harbor mist`, `porcelain tide`, `quiet azure`, `morning inlet`, `washed linen blue`
- electric: `signal cobalt`, `neon surf`, `charged lapis`, `blue current`, `afterglow cyan`
- nocturnal: `midnight glass`, `naval shadow`, `inkwell blue`, `moonlit ultramarine`, `deep observatory`

Input `sage` resolves to the green family:

- botanical: `garden sage`, `fern milk`, `greenhouse veil`, `new leaf wash`, `herbarium green`
- antique: `aged olive`, `patina herb`, `library laurel`, `weathered celadon`, `old apothecary`
- quiet: `misted moss`, `soft juniper`, `shade garden`, `willow hush`, `lichen linen`

Input `crimson` resolves to the red family:

- romantic: `velvet rose`, `crushed raspberry`, `candlelit rouge`, `red satin`, `wine-kissed bloom`
- opulent: `imperial ruby`, `lacquered garnet`, `opera curtain`, `pomegranate silk`, `marble hall red`
- dramatic: `signal scarlet`, `stage blood red`, `ember lacquer`, `storm siren`, `hot vermilion`

## Acceptance Criteria

- Common color inputs resolve to these families: `blue`, `green`, `red`, `pink`, `purple`, `yellow`, `orange`, `brown`, `gray`, `black`, and `white`.
- Important aliases resolve sensibly, including `navy` under blue, `sage` under green, and `crimson` under red.
- Bridge terms are excluded from the strict synonym graph and must not be used as direct synonym evidence.
- Graph edges only reference existing graph nodes.
- Family graph nodes correspond to existing color families.
- Alias graph nodes with family metadata point to existing color families.
- Graph nodes only use `family`, `subfamily`, `shade`, `alias`, `synonym`, `common_word`, and `neutral_word` types.
- Graph edges only use `has_synonym`, `has_subfamily`, `definition_contains`, `synonym_overlap`, `has_expanded_synonym`, `shade_of`, `shade_of_subfamily`, `shade_mentions_family`, `same_term`, `associated_color`, `neutral_synonym`, `synonym_to_mapped_word`, and `synonym_to_color_alias`.
- Every graph edge includes definition evidence.
- Every alias node has exactly three outgoing `has_expanded_synonym` edges.
- Every synonym node has cited source metadata.
- Duplicate synonym labels do not create duplicate synonym nodes.
- Every term from `100 common.docx` is represented either as a `common_word` graph node or a `neutralWords.unconnected` item.
- Every unique term from `3,000 english words.docx` is represented either as a mapped `common_word` graph node or an `neutralWords.unconnected` item.
- `common_word` nodes do not use `has_synonym` or `has_expanded_synonym`.
- `neutral_word` nodes do not use `has_synonym`, `has_expanded_synonym`, or `associated_color`.
- Every neutral synonym bridge has citation metadata and non-empty evidence.
- Translation resolver returns high-confidence direct paths, medium-confidence association paths, and low-confidence unresolved neutral results.
- Translation resolver only pulls evocative suggestions from existing family mood clusters.
- The synonym graph contains no `bridge` or `evocative` nodes; `subfamily` and `shade` nodes are allowed only when backed by existing definition phrases.
- Every family has at least three mood clusters.
- Every mood cluster has at least five evocative names.
- Names are lowercase and should not be duplicated across the dataset unless a future spec explicitly marks them as shared.

