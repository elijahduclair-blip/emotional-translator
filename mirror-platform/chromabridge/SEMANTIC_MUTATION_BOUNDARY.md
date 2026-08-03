# Semantic Mutation Boundary

The Evidence Card is not a component. It is a **constitutional boundary**: the single crossing point between *temporary understanding* and *persistent memory*. Every command in the system that can change semantic meaning must pass through this boundary the same way — whether the caller is the Mirror, the Epistemic Lab, the Librarian, a future mobile app, or a voice interface. There should be one commit experience, not five.

This document lists every command that can mutate semantic meaning and answers, for each:

- **Autonomous?** — Can it run without a user in the loop (scheduled, background, or service-role)?
- **Through HonestConversationService?** — Must it pass through the observe → mirror → confirm → consent → commit lifecycle in `base44/shared/honestConversation.ts`?
- **Explicit user participation?** — Does a human choice gate the mutation?
- **Authorizing article** — Which Constitutional article permits it?
- **Verifying test** — Which test proves the boundary holds (or shows it is unenforced)?

A command that can mutate semantic meaning *without* passing through the boundary is a **constitutional violation**, regardless of how convenient or harmless it appears.

---

## Classification key

- **Integrity** — may run autonomously. Maintains the *structure* of memory without changing its *meaning*: rebuild projections, repair indexes, remove duplicate storage, detect anomalies, recompute derived addresses. These operations are reversible from the event stream and touch operational metadata only.
- **Semantics** — may NOT run autonomously. Changes *what a concept means or whether it is remembered*: create/merge/rename/re-parent a concept, alter confidence, create a semantic relationship, resolve a contradiction, shift a persona origin, archive a memory. These must become *proposals* the user accepts through the boundary.

---

## The boundary contract (what "passing through" means)

A semantic mutation passes through the boundary only if it satisfies all of:

1. It originates as a `ConversationEvent` in a session reduced by `reduceSession`.
2. It reaches the ledger exclusively as a `LedgerCommand` emitted at the commit or reconciliation boundary — never before.
3. No provisional proposal, confirmation, or disposition becomes a `PersistentConcept` until `commitMemory` succeeds.
4. The resulting write is a `ConceptEvent` applied through `reduceConceptEvents`, not a direct field update.

Anything that writes a semantic field by a shorter path violates the contract.

---

## I. Concept lifecycle (PersistentConcept + ConceptEvent)

### 1. `promoteHypothesis` — ❌ VIOLATION (P0)
Creates a `PersistentConcept` and emits a `promoted` `ConceptEvent` directly from a hypothesis.
- **Autonomous?** No — user-invoked. But invoked from a single button click in `EpistemicLab.jsx` (`handlePromote`), with no conversation.
- **Through HonestConversationService?** No. It is a direct button → `PersistentConcept.create` + `ConceptEvent.create` shortcut.
- **Explicit user participation?** A click. Not informed consent — no mirror is presented, no disposition is chosen, no commit boundary is crossed.
- **Authorizing article:** None. This is the core sequence the Constitution requires (Observe → Mirror → Confirm → Consent → Commit) collapsed into Hypothesis → Promote.
- **Verifying test:** None. The honest-conversation suite proves the *correct* path works; nothing proves this shortcut is forbidden.
- **Required fix:** `promoteHypothesis` must no longer be callable as a persistence endpoint from the UI. It must be replaced by a command such as `beginConversationFromHypothesis` / `requestUserConfirmation` that opens a session and routes through `commitMemory`. The function may keep its validation logic, but only `applyCommitMemory` (the ledger side of the commit boundary) may create the `promoted` event.

### 2. `observeAndHypothesize` — ⚠️ PARTIAL VIOLATION
Creates an `EvidenceRecord` and creates/updates `SemanticHypothesis` records (strengthens, contests, or creates new) from an LLM interpretation of a user statement.
- **Autonomous?** No — user-submitted observation. But the *interpretation* is LLM-autonomous: the mirror is generated and the hypothesis state is written *before* the user sees or confirms any inference.
- **Through HonestConversationService?** No. It writes `SemanticHypothesis` (a semantic claim with status and confidence) directly, not through a session.
- **Explicit user participation?** The user provides the observation. They do **not** confirm the interpretation. The mirror step is skipped — the system decides what the observation means and persists that decision.
- **Authorizing article:** Article I (human primacy) is strained: the user's words become a tracked claim without their confirmation of the inference.
- **Verifying test:** None.
- **Required fix:** Split the function: (a) `recordObservation` — creates only the immutable `EvidenceRecord`, no hypothesis. (b) The interpretation becomes a `MirrorProposal` presented through `presentMirror`. (c) Hypothesis state is written only after the proposal is confirmed and committed. The LLM interpretation must be a *proposal*, never a *fact*.

### 3. `applyTransition` — ⚠️ VIOLATION (parallel persistence path)
Appends a `ConceptEvent` (`confidence_adjusted`, `stability_adjusted`, `split`, `merged`, `superseded`, `archived`, `clarify`, `hold_uncertainty`) and persists the reduced projection. This is the ledger write path.
- **Autonomous?** No — user-invoked. But invokable directly as a backend function, not gated by a session.
- **Through HonestConversationService?** No. It is a *second* persistence path parallel to `commitMemory`. Directives like `split`, `merged`, `superseded`, `archived` are meaning-changing, yet they bypass the reconcile/consent flow.
- **Explicit user participation?** Only if the caller chooses to ask. The function itself enforces optimistic concurrency but not user consent.
- **Authorizing article:** Article IV (memory with integrity) — the event sourcing is sound. But Article I (human primacy) is violated for the meaning-changing directives.
- **Verifying test:** The honest-conversation suite covers reconciliation via `resolveConflict`, but `applyTransition`'s split/merge/supersede directives have no consent test.
- **Required fix:** Restrict `applyTransition` to *integrity* directives only (`confidence_adjusted`/`stability_adjusted` derived from committed evidence — and even these should be event-sourced from the commit, not directly callable). Meaning-changing directives (`split`, `merged`, `superseded`, `archived`, `clarify`) must route through `startRevisitSession` → `resolveConflict`/`applyRevisitAffirm` → ledger command. There should be one write path to the ledger, not two.

### 4. `evaluateStateDecision` — ✅ boundary-safe (read-only)
Produces a `TransitionDirective` proposal. Does not write.
- **Autonomous?** No writes at all.
- **Through boundary?** N/A — it only *proposes*. Its output must feed the boundary, never `applyTransition` directly for meaning-changing directives.
- **Required guardrail:** Its directives must be classified; meaning-changing ones must not be auto-applied.

### 5. `reconcileConcept` — ✅ boundary-safe (read-only)
Produces a non-mutating reconciliation proposal. Does not write. Correct pattern — this is what an *advisor* looks like.

### 6. `migrateLegacyConcepts` — ✅ acceptable (integrity)
Emits synthetic `legacy_concept_baselined` / `legacy_supersession_linked` events to bring pre-event-system concepts into the event stream.
- **Autonomous?** Yes — designed to run without per-record user consent.
- **Through boundary?** No — but this is **integrity**, not semantics. It captures *existing* meaning into the event stream without reinterpreting it. The baseline payload is copied from the stored record; no new interpretation is introduced.
- **Explicit user participation?** No, and justifiably — this is a one-time structural migration that preserves history rather than changing it.
- **Authorizing article:** Article IV — it *creates* the immutable history the article requires.
- **Verifying test:** `verifyProjection` confirms projections rebuild correctly from the synthesized stream.
- **Guardrail:** Must remain a one-time migration. If ever extended to "re-interpret" legacy concepts, it crosses into semantics.

---

## II. Persona identity (UserProfile semantic origin & labels)

The semantic origin is the "fixed star." Shifting it reorients the *entire* graph — every node's "accuracy" is measured against it. This is a high-order semantic mutation.

### 7. `PersonaAgent` — ⚠️ VIOLATION (conversational but ungated)
Writes `semantic_origin_x/y/z` and appends `semantic_labels` to `UserProfile` after a free-form interview.
- **Autonomous?** No — the agent asks questions. But the *write* is an LLM tool call, not a boundary command.
- **Through HonestConversationService?** No. The agent's instructions *say* "confirm before writing" and "ask one question at a time," which mirrors the spirit — but there is no session, no commit boundary, no idempotency key, no event sourcing. A confirmed coordinate shift is a direct `UserProfile.update`.
- **Explicit user participation?** Yes, via conversational confirmation — but it is unenforced and unverifiable.
- **Authorizing article:** Article I — the intent is right. The mechanism is not.
- **Verifying test:** None.
- **Required fix:** Persona origin shifts and label additions must become ledger commands through a persona-scoped honest conversation. The agent may *propose*; only the commit boundary may *write*. Until then, the PersonaAgent is an unbounded author of the user's identity center.

### 8. `PersonaLibrarian` — ⚠️ VIOLATION (same class as 7)
Updates `UserProfile` `semantic_labels` and `semantic_origin` from conversation, with a "confirm before writing" instruction.
- Same classification and same fix as `PersonaAgent`. Two agents writing the star without a shared boundary is exactly the "five different commit experiences" anti-pattern.
- **Note:** `PersonaLibrarian` correctly has *read-only* on `ColorNode` — it does not mutate the graph. Its violation is scoped to the persona origin/labels, which is still semantics.

---

## III. Trait promotion (persona trait → graph structure)

### 9. `promoteTraitToBridge` — ⚠️ VIOLATION (user-gated but ungated boundary)
Creates a `ColorNode` trait bridge with LLM-assigned coordinates and updates `UserProfile.trait_node_ids`.
- **Autonomous?** No — user-invoked from the Persona Dashboard.
- **Through boundary?** No. The Librarian instructions correctly say "NEVER auto-promote — only report candidates," and the user *does* approve. But the approval is a button, not a boundary: no mirror of *what the trait will mean in the graph*, no disposition, no commit event.
- **Explicit user participation?** Yes — but it confirms an action ("promote"), not an interpretation ("this trait sits at these coordinates near this anchor").
- **Authorizing article:** Article I — participation exists; Article II (transparent reasoning) is thin (the LLM assigns coordinates invisibly).
- **Required fix:** Trait promotion should present the proposed coordinates and anchor as a mirror and require confirmation of the *positioning*, not just the act of promotion. The resulting node is a semantic structure; its creation is a semantic act.

### 10. `promoteAllTraits` — ❌ VIOLATION (P1)
Bulk-promotes every un-promoted trait across all profiles, bypassing the density threshold.
- **Autonomous?** Effectively yes — a single invocation promotes an unbounded set of traits with no per-trait confirmation.
- **Through boundary?** No.
- **Explicit user participation?** No per-trait consent. This directly contradicts the Librarian's own "report candidates, user approves" rule.
- **Authorizing article:** None.
- **Required fix:** Remove the bulk path, or restrict it to *integrity* (re-create known-missing trait bridges for traits the user has *already* individually approved). Promoting a trait the user never saw as a candidate is autonomous meaning creation.

---

## IV. Librarian / graph maintenance (ColorNode + TrajectoryEdge)

### 11. `librarianRunMaintenance` (scheduled every 5h) — ❌ VIOLATION (P0)
Dispatches `LibrarianAgent`, which holds full `create/update/delete` on `ColorNode` and `TrajectoryEdge`. The maintenance directive instructs it to: fix coordinates, re-link orphans (re-parent), merge duplicates, append `semantic_labels`, bias coordinates toward the star, and archive nodes.
- **Autonomous?** Yes — runs on a 5-hour schedule with no user present.
- **Through boundary?** No.
- **Explicit user participation?** None.
- **Classification of its operations:**
  - *Integrity (permitted):* re-index `inherited_address`, recompute `address_dissonance`, detect duplicates, identify orphans, report trait candidates, verify hierarchy acyclicity.
  - *Semantics (forbidden autonomously):* merge nodes, append `semantic_labels`, re-parent orphans, adjust coordinates toward the star, archive nodes (`memory_status`).
- **Authorizing article:** None for the semantic operations. This is an invisible author of the user's history.
- **Verifying test:** None.
- **Required fix:** (a) Strip `create/delete` from `LibrarianAgent`'s `ColorNode`/`TrajectoryEdge` permissions. (b) Restrict `update` to operational fields (`inherited_address`, `address_dissonance`, `last_accessed_at`). (c) Every semantic operation (merge, label append, re-parent, coordinate shift, archive) must become an *advisory proposal* persisted for the user to accept through the boundary — "Suggested semantic merge, with supporting evidence."

### 12. `librarianOrganizeUnlinked` (scheduled) — ❌ VIOLATION (P1)
Dispatches `LibrarianAgent` to re-link orphaned nodes (re-parent) and flag un-linkable ones with the `needs-review` label.
- **Autonomous?** Yes.
- **Through boundary?** No.
- Re-parenting is semantics; flagging `needs-review` is semantics (it appends a label).
- **Required fix:** Same as 11 — become advisory. Re-linking must be a proposal.

### 13. `LibrarianAgent` (admin agent config) — ❌ VIOLATION (the enabling permission)
The `tool_configs` grant `create/update/delete` on `ColorNode` and `TrajectoryEdge`. This is the root cause of 11 and 12.
- **Required fix:** Reduce to `read` + `update` (operational fields only) on `ColorNode`; `read` only on `TrajectoryEdge` (edges are semantic relationships — the Librarian should propose them, not write them).

---

## V. Graph structural operations (ColorNode bulk functions)

These are invoked manually/administratively, not scheduled. Each must be classified individually, because "graph operation" spans both integrity and semantics.

### Integrity (permitted, with audit logging)
- `reindexInheritedAddresses` — recomputes `inherited_address`/`address_dissonance` from existing coordinates. Pure projection rebuild.
- `detectDomains` — computes domain partitions (derived metadata).
- `assignAnchorVectors` / `assignMissingAnchors` — assigns `parent_anchor_id`/`anchor_bearing` from proximity. **Borderline:** assigning an anchor is a semantic parent assignment. Should be advisory if it changes an existing anchor.
- `verifyProjection` — read-only integrity check.

### Semantics (must not run autonomously; route through boundary)
- `assignOpposites` / `assignSynonyms` / `assignShadeOpposites` / `assignShadeSynonyms` — create **semantic relationships** (opposites/synonyms). These define what a concept *means relative to others*. Must be advisory.
- `connectAllToBases` / `connectNodeToAllBases` / `connectNodeToBridges` / `connectNodeToShades` / `connectNodesToBases` / `connectNodesToWords` / `connectNodesWithWordNet` / `connectParentlessToShades` / `connectPhraseToBaseBridge` / `connectPhraseWords` / `connectShadesToBridges` / `connectWordsToConcepts` — create **hierarchy and relationships**. Re-parenting and linking are meaning. Must be advisory; `connectParentlessToShades` is the same violation as the Librarian's orphan repair.
- `deduplicateNodes` — **merges** nodes. Collapsing two records into one is a semantic merge. Must be advisory.
- `positionWord` — assigns coordinates to a word node. Coordinates are semantic positioning. Must be advisory (or at minimum present the proposed position for confirmation).
- `propagateShapeTraits` / `resolveAttributeTraits` / `associateNodeTraits` — assign trait/shape semantics to nodes. Meaning. Must be advisory.
- `seedControlledHierarchy` / `seedWordNetHierarchy` — **create** the base hierarchy. One-time seeding is acceptable as a bootstrap (like migration), but any re-seed that reinterprets existing nodes is semantics.
- `cleanseBaseTier` — alters the base tier. Base anchors are the most semantically load-bearing nodes in the system. Must never run autonomously.

---

## Summary of violations

| # | Command | Class | Severity | Autonomous meaning-change? |
|---|---|---|---|---|
| 1 | `promoteHypothesis` | Semantics | P0 | No, but bypasses consent |
| 2 | `observeAndHypothesize` | Semantics (interpretation) | P1 | LLM interpretation written before confirmation |
| 3 | `applyTransition` (split/merge/supersede/archive) | Semantics | P0 | Parallel persistence path, no consent |
| 7 | `PersonaAgent` origin/label writes | Semantics | P1 | Conversational but ungated, no boundary |
| 8 | `PersonaLibrarian` origin/label writes | Semantics | P1 | Same as 7 |
| 9 | `promoteTraitToBridge` | Semantics | P2 | User-gated action, not interpretation |
| 10 | `promoteAllTraits` | Semantics | P1 | Bulk, no per-trait consent |
| 11 | `librarianRunMaintenance` | Semantics | P0 | Yes — scheduled, autonomous |
| 12 | `librarianOrganizeUnlinked` | Semantics | P1 | Yes — scheduled, autonomous |
| 13 | `LibrarianAgent` permissions | Enabler | P0 | Grants the autonomy for 11/12 |
| V | Graph ops (connect/assign/dedupe/position) | Semantics | P2 | Manual but ungated |

## One origin

Every semantic mutation must have exactly one origin — not one implementation, **one origin**. The constitutional source of authority is a single chain:

```
User interaction → HonestConversationService → SemanticMutationService → Event Store Authorization → Ledger
```

Nothing else originates semantic commitment. Agents, graph utilities, background jobs, maintenance scripts, admin panels, importers, and tests may all produce **observations** or **proposals**. Only this one origin produces durable meaning. This is a stronger statement than "everything goes through the service": it defines where authority is *born*, not merely which code path happens to carry it. A function that writes semantic state but cannot trace its authority back to a committed conversation session has no origin, regardless of how correct its logic is.

## Single-use authority (consent cannot be replayed)

Semantic meaning is append-only; authority is consumed. A conversation session's decision may authorize exactly **one** mutation. Once that authorization is spent on a commit, it cannot be reused to authorize a second mutation — even months later, even by the same user, even for a semantically adjacent change.

This prevents the subtle replay problem where an old, captured authorization is used to slip in an unconsented meaning change. The boundary enforces it at two layers: the service rejects a commit whose `(sessionId, userDecisionEventId)` was already spent on a different mutation, and the event store independently rejects any append that reuses a consumed authorization. An exact idempotent replay of the *same* commit is permitted (it returns the original event); only reuse of the authority for a *different* mutation is forbidden.

Consent, in ChromaBridge, is a consumable resource — not a standing permission.

## Boundary, restated

There is one legal path from observation to persistent memory:

```
submitObservation → presentMirror → respond(confirm) → selectDisposition → commitMemory
                                                              ↓
                                                     LedgerCommand (commit_concept)
                                                              ↓
                                                  ConceptEvent (promoted) via reducer
```

And one legal path for revisiting committed memory:

```
startRevisitSession → openConflict / affirm → resolveConflict
                                          ↓
                              LedgerCommand (reconcile / reaffirm)
                                          ↓
                          ConceptEvent (superseded / context_added / …) via reducer
```

Every other path that writes a semantic field — a button, a scheduled task, an LLM tool call, a bulk function — is a hole in the boundary. The fixes above close them by converting each into either an *integrity* operation (autonomous, operational fields only) or an *advisory proposal* (presented through the boundary, accepted by the user, written only at the commit boundary).

The verifying principle: **if a command can produce a `ConceptEvent` or a `ColorNode` semantic-field write, and it is not the reducer applying a `LedgerCommand` from a committed session, it is a violation.** No test currently enforces this. The next artifact should be a test suite that asserts it — a `semanticMutationBoundary.test.ts` that attempts every shortcut path and asserts each is rejected.