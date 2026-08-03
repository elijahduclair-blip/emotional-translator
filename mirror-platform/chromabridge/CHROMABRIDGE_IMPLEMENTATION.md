# ChromaBridge Implementation Map

A living document mapping the constitutional principles to the current architecture. This map evolves as the implementation changes; the Constitution does not.

---

| Constitution Article | Current Implementation |
|---|---|
| **Article I — Human Primacy** | Persona origin calculated as a weighted mixture of component concepts, never a singular centroid. Visual summaries are one projection of the evidence, not the person. |
| **Article II — Transparent Reasoning** | `ConceptEvent` entity — immutable event stream. `reduceConceptEvents` reducer in `base44/shared/conceptEvents.ts`. `verifyProjection` function audits stream-to-projection consistency. |
| **Article III — Evolution Over Permanence** | `lifecycle_status` enum: `emerging → active → transitioning → superseded → archived`. Derived `epistemic_condition`: `stable / evolving / contested / transitioning / uncertain`. |
| **Article IV — Memory With Integrity** | Immutable event log. Events are never deleted; concepts are superseded, not overwritten. `legacy_concept_baselined` events preserve historical honesty during migration. |
| **Article V — Collaborative Interpretation** | `reconcileConcept` (Stage 8) produces proposals, not mutations. `evaluateStateDecision` (Stage 8.5) decides. `applyTransition` executes with optimistic concurrency. Contradictions surface as `hold_uncertainty` directives. |
| **Article VI — Representation Serves Understanding** | `generateSemanticSnapshot` builds the mediator boundary. Visualization reads from snapshots, not raw entities. Graphs/colors/shapes are explanatory projections. |
| **Article VII — Evidence Before Assertion** | Four-layer distinction: `EvidenceRecord` (observation) → `SemanticHypothesis` (interpretation) → `PersistentConcept` (persistent assertion) → `epistemic_condition` (uncertainty). `epistemicAssessment.ts` computes confidence from accumulated evidence dimensions, not presentation. |

---

### Architectural Layers

```
EvidenceRecord        Observation layer — raw captured input
      ↓
SemanticHypothesis    Interpretation layer — assessed claims with confidence
      ↓
PersistentConcept    Persistent layer — promoted, event-sourced projections
      ↓
SemanticSnapshot      Mediator boundary — what consumers (LLM, UI) read
      ↓
Visualization         Explanatory layer — graph, colors, shapes, trajectories
```

### Core Invariants

1. **Projection Integrity** — `reduce(eventStream) === storedProjection`. Verified by `verifyProjection`.
2. **Reducer-First Writes** — All semantic field updates pass through `reduceConceptEvents`. No direct field writes.
3. **Immutable History** — Events are never modified or deleted. Corrections are new events.
4. **Optimistic Concurrency** — Directives must match `last_stream_version` before applying.
5. **Evidence-Gated Promotion** — Hypotheses require accumulated evidence and threshold confidence before becoming PersistentConcepts.

---

### Milestone: Constitutional Authority Enforcement

**Status:** Complete

Durable semantic meaning is now governed by an enforceable capability boundary rather than application convention.

The implementation distinguishes three classes of persistence:

- **Evidence** — observations that may be stored without becoming remembered meaning.
- **Proposals** — interpretations that remain provisional until explicitly authorized.
- **Semantic Memory** — durable meaning created only through the constitutional authorization process.

The implementation enforces this through:

- `SemanticMutationService` (`base44/shared/semanticMutationBoundary.ts`) as the single semantic commit gateway.
- Independent event-store authorization validation (the enforced store rejects appends lacking valid `honest_conversation` authorization).
- Single-use authorization tied to explicit user participation — a conversation decision may authorize exactly one mutation.
- Full provenance attached to every committed semantic mutation (authorizer, evidence, session, replaced prior state).
- Dedicated unit, integration, and regression tests covering both authorized and unauthorized paths (`test/semanticMutationBoundary.test.ts`, `test/constitutionalFullPath.integration.test.ts`, `test/semanticMutationBypass.integration.test.ts`, `test/librarianSemanticIsolation.integration.test.ts`).

### Design Principle

The semantic mutation boundary is an internal architectural guarantee, not a user interface.

The interface may evolve independently, provided every path that creates remembered meaning continues to pass through the constitutional authorization boundary.

### Chain of Trust

- The **Constitution** defines enduring authority — what must always be true.
- The **Implementation** defines the current mechanism — how it is true today.
- The **Tests** prove the mechanism satisfies the authority.

If the implementation changes, the invariants that must be preserved and the tests that must keep passing are both named explicitly.