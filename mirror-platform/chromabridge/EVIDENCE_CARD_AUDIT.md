# Evidence Card Interactional Honesty Audit

Scope: every surface currently acting as an "evidence card" — the hypothesis/concept tiles in `src/pages/EpistemicLab.jsx`, the dialogue in `src/pages/Mirror.jsx`, and the message bubbles in `src/components/agents/MessageBubble.jsx` + `PersonaLibrarianChat.jsx` — traced through their action handlers into the session commands and the semantic ledger.

Lens: the three-layer model (Reflection / Reasoning / History) and the Aviation Checklist (epistemic risk × interactional risk).

---

## Summary
- **Critical violations:** 4 (semantic shortcut, machinery in default view, background meaning-change, burdensome consent)
- **Moderate risks:** 6
- **Existing strengths:** 3 (Mirror's restraint, event-sourced ledger, session/ledger separation in `honestConversation.ts`)

A foundational note: **no `EvidenceCard` component exists yet.** The honest-conversation state machine (`base44/shared/honestConversation.ts`) and its 46-test suite are fully built, but no UI renders session phases, proposals, or dispositions. The surfaces that *do* render semantic state predate the conversation model and were never designed as evidence cards — which is why nearly every default state is an inspection console.

---

## Layer 1: Reflection

### Finding EC-01 — Default card is an inspection console, not a mirror
**Current behavior:** `EpistemicLab.jsx` renders each hypothesis tile with: a status enum badge (`observed`/`interpreted`/`candidate`/…), a category badge, supporting/counter evidence counts, a `ConfidenceBar` with seven labeled dimension bars and a numeric `XX%`, and a last-evaluated timestamp — all visible by default.
**Risk:** Moderate (interactional) / the tile answers "how confident is the model?" before it answers "what did I hear?"
**Constitutional impact:** Article IV (Memory With Integrity) is technically satisfied, but the *user's* integrity is compromised — the surface demands evaluation, not reflection.
**Recommended change:** A true Evidence Card Layer 1 shows only: **What I heard** (verbatim observation), **What I think it may mean** (provisional inference), and one action: *"Does this reflect what you meant? [Yes] [Clarify]"*. Move every number and enum to Layer 2/3.
**Acceptance criterion:** A first-time user can identify what was observed, what was inferred, and what action is requested without opening any secondary panel and without encountering a percentage, an enum string, or a count.

### Finding EC-02 — Numeric confidence leads, provisional language does not
**Current behavior:** `ConfidenceBar` (EpistemicLab L28–69) renders `aggregate_confidence * 100` as a prominent percentage and a seven-bar dimension grid (`Interp`, `Source`, `Cross-Ctx`, `Repeat`, `Temporal`, `Conflict`, `User Conf`) with weights, all in the default tile.
**Risk:** Critical (interactional) / a number like `72%` reads as precision while communicating almost nothing about *what* is uncertain.
**Constitutional impact:** Violates the "transparent reasoning" spirit of Article II — the reasoning is shown as a score, not as language.
**Recommended change:** Replace numeric confidence in Layer 1 with a single provisional sentence. Reserve the dimension breakdown for Layer 2 ("Why?"). Prefer: *"I'm fairly confident about the change you described, but less certain about what is causing it."*
**Acceptance criterion:** No numeric confidence value is visible in any default card state. Layer 2 may show dimensions, but only behind an explicit "Why?" affordance.

### Finding EC-03 — Observation and interpretation are not visibly separated
**Current behavior:** The hypothesis tile shows `h.proposition` (the inference) as the primary text. The raw observation lives only in the separate Evidence Log at the bottom of the page, detached from the inference it produced. There is no card where "what was said" and "what it may mean" sit side by side.
**Risk:** Moderate (epistemic) / the user cannot see the seam between evidence and inference, so they cannot challenge the interpretation at the point it was made.
**Constitutional impact:** Erodes Article II (transparent reasoning) and the "no interpretation without consent" invariant.
**Recommended change:** Layer 1 must render observation and inference as two visually distinct blocks within the same card, with the inference explicitly marked provisional ("I think this may mean…").
**Acceptance criterion:** In every card, the observation is distinguishable from the inference by typography or layout alone, with no shared styling that would let a reader mistake one for the other.

### Finding EC-04 — Multiple decisions compete for the same moment
**Current behavior:** Each hypothesis tile surfaces an "Evaluate" button (which promotes to a persistent concept), while status badges and counts imply further judgments. The user is asked to act on a hypothesis (promote it) before the conversation has confirmed what it means.
**Risk:** Critical (epistemic + interactional) / the action available is stronger than the understanding established.
**Constitutional impact:** **Semantic shortcut** — `handlePromote` (EpistemicLab L126–142) calls `promoteHypothesis` directly, creating a `PersistentConcept` with no conversation session, no mirror, no consent, and no commit boundary. This is the most serious violation found.
**Recommended change:** Remove direct promotion from the tile. The only Layer 1 actions should be the conversation verbs (`confirm` / `clarify` / `reject`). Promotion is an *outcome* of the commit phase, never a button.
**Acceptance criterion:** No UI action creates or strengthens a `PersistentConcept` without passing through `submitObservation → presentMirror → confirm → selectDisposition → commitMemory`. A button labeled "Evaluate" or "Promote" does not exist on an evidence card.

---

## Layer 2: Reasoning

### Finding EC-05 — "Why?" is absent, not progressive
**Current behavior:** There is no expandable reasoning layer. Either the full `ConfidenceBar` is shown (EpistemicLab) or nothing is (Mirror). Supporting excerpts, alternative interpretations, and uncertainty narrative do not exist in any surface.
**Risk:** Moderate (interactional) / the user who *wants* the reasoning has no way to get it; the user who doesn't is forced to see a score instead.
**Constitutional impact:** Article II (transparent reasoning) is offered as a number, not as an explanation grounded in the user's own language.
**Recommended change:** Add a collapsed "Why?" affordance on each card. Expanding it shows: supporting excerpts (verbatim quotes from the observation), the inference rationale in plain language, and named uncertainties — no confidence math in the default expansion.
**Acceptance criterion:** The reasoning layer is collapsed by default and, once opened, cites actual user language rather than generic model reasoning; it can be closed with a single tap returning the user to Layer 1.

### Finding EC-06 — Tool-call machinery is exposed as conversation
**Current behavior:** `MessageBubble.jsx` (L114–130) renders every agent tool call as an expandable "↓ N Tool Calls" block. `FunctionDisplay` (L22–78) dumps raw `arguments_string` and `results` as JSON `<pre>` blocks. In `PersonaLibrarianChat`, these appear inline in the dialogue.
**Risk:** Moderate (interactional) / the user sees JSON parameters and result payloads where they expect a reflection. This is the "mirror you admire" anti-pattern.
**Constitutional impact:** Shifts attention from self-reflection to interpreting the interface — a direct violation of the proposed mirror heuristic.
**Recommended change:** Tool calls should never be visible in the conversational layer. If a developer audit view is needed, it belongs behind an explicit toggle, not in the default thread.
**Acceptance criterion:** In the default conversation view, no tool-call name, parameter JSON, or result JSON is visible. A developer mode may exist but is off by default and clearly labeled "advanced."

---

## Layer 3: History

### Finding EC-07 — History is absent, not progressive
**Current behavior:** No surface shows that an earlier interpretation was revised, superseded, or reconciled. The `proposal.superseded` / `conflict.resolved` events exist in `honestConversation.ts` and its tests, but no UI renders them. A user who revisits a concept has no way to see it evolved.
**Risk:** Moderate (epistemic) / without a visible history layer, the system's central promise — "nothing was overwritten" — is invisible to the user even though it is true in the ledger.
**Constitutional impact:** Article IV (memory with integrity) is *enforced* but not *demonstrated*.
**Recommended change:** Add a deliberate "History" affordance (Layer 3) on each committed card. It should show earlier versions and corrections as a narrative of evolution, translating event types into human language: *"Your understanding changed after this clarification."* — never `proposal.superseded → concept.context_added`.
**Acceptance criterion:** A user opening history sees at least one earlier version described in plain language, can distinguish it from the current understanding, and never sees a raw event-type identifier unless an explicit "developer / advanced audit" mode is enabled.

### Finding EC-08 — Technical vocabulary competes with reflection
**Current behavior:** EpistemicLab surfaces `status` enums (`observed`, `contested`, `persistent`), `source_type` enums (`direct_statement`, `reported_behavior`), `temporality` enums, and `last_evaluated_at` timestamps directly in the tile and evidence log.
**Risk:** Moderate (interactional) / enum strings are developer vocabulary shown to a reflector.
**Constitutional impact:** Same mirror-heuristic violation as EC-06.
**Recommended change:** Enum values may exist in Layer 3 (developer view) only. In Layers 1–2 they are either omitted or translated to a single human sentence.
**Acceptance criterion:** No enum string (status, source_type, temporality, lifecycle) appears in Layer 1 or the default Layer 2 expansion.

---

## Librarian boundary

### Finding EC-09 — Background agent can change meaning, not just maintain integrity
**Current behavior:** `LibrarianAgent.jsonc` grants the Librarian full `create / update / delete` on `ColorNode` and `TrajectoryEdge`, and its instructions authorize: merging near-duplicate nodes, adjusting coordinates to "restore orbital coherence," appending `semantic_labels`, re-parenting orphans, and archiving nodes by setting `memory_status`. The `librarianRunMaintenance` and `librarianOrganizeUnlinked` functions execute these autonomously on a schedule.
**Classification:**
- *Integrity maintenance (permitted):* re-index `inherited_address`, recompute `address_dissonance`, repair parent-chain cycles, detect duplicates, identify orphans, report trait promotion candidates.
- *Meaning change (currently permitted — VIOLATION):* merging nodes (collapses interpretations), appending `semantic_labels` (creates semantic relations), re-parenting by proximity (rewrites semantic lineage), coordinate adjustment toward the star (changes semantic positioning), archiving (removes a concept from active memory).
**Risk:** Critical (epistemic) / the Librarian is an invisible author of the user's history. Merging two nodes or re-parenting one silently changes what a concept *means*, with no conversation and no consent.
**Constitutional impact:** Direct violation of the proposed principle: *"Background processes may maintain the integrity of memory, but they may not change its meaning."*
**Recommended change:** Strip the Librarian's `create / delete` on `ColorNode` and `TrajectoryEdge`; restrict `update` to operational fields (`inherited_address`, `address_dissonance`, `last_accessed_at`, `memory_status` only when the node is not `is_trait`/`favorite`/`base`). Meaning-changing operations (merge, label append, re-parent, coordinate shift, archive) must become *proposals* surfaced to the user through the honest-conversation flow, not autonomous writes.
**Acceptance criterion:** No scheduled or background process creates, deletes, merges, re-parents, re-labels, or re-positions a `ColorNode`. Every such change is recorded as a proposal awaiting user participation, or is rejected at the function boundary.

### Finding EC-10 — Trait promotion is correctly gated; label curation is not
**Current behavior:** The Librarian instructions correctly state "NEVER auto-promote traits — only report candidates" (EC-10 strength), but in the same instructions it is told to "append semantic_labels to orbital nodes" autonomously during LABEL CURATION. Appending a label is a semantic act of the same kind as promoting a trait.
**Risk:** Moderate (epistemic) / inconsistent application of the consent boundary.
**Recommended change:** Treat `semantic_labels` appends the same as trait promotion: report candidates, let the user approve. The Librarian may *suggest* a label; it may not *write* one.
**Acceptance criterion:** No background process appends to `semantic_labels` or `trait_associations` without an approved user proposal.

---

## Existing strengths (to preserve)

- **S-1:** `Mirror.jsx` is almost entirely reflective — pure dialogue, no scores, no enums, typographic restraint. It is the closest existing surface to the Layer-1 ideal and should be the template for the real Evidence Card.
- **S-2:** The event-sourced ledger (`ConceptEvent` + `reduceConceptEvents`) already guarantees "nothing was overwritten" at the data layer — the history Layer 3 needs only to *surface* what already exists.
- **S-3:** `honestConversation.ts` already enforces the session/ledger separation: no ledger event is emitted before the commit boundary, and disposition is required before commit. The UI has not yet caught up to this contract, but the contract is sound.

---

## Priority order

1. **EC-04 — Eliminate the semantic shortcut.** Remove `handlePromote` / direct `promoteHypothesis` from the evidence surface. No button creates a `PersistentConcept` without the full conversation lifecycle. *(Critical, epistemic)*
2. **EC-09 — Bound the Librarian to integrity maintenance.** Revoke create/delete and restrict updates to operational fields; route every meaning-changing operation through a user proposal. *(Critical, epistemic)*
3. **EC-01 — Ship the real Layer-1 Evidence Card.** Create `src/components/EvidenceCard.jsx` rendering only observation, provisional inference, and one action. *(Critical, interactional)*
4. **EC-02 — Remove numeric confidence from the default view.** *(Critical, interactional)*
5. **EC-03 — Visibly separate observation from interpretation within one card.** *(Moderate, epistemic)*
6. **EC-07 — Surface history as evolution, not event vocabulary.** *(Moderate, epistemic)*
7. **EC-06 — Hide tool-call JSON from the conversation.** *(Moderate, interactional)*
8. **EC-05 — Add a collapsed "Why?" reasoning layer citing user language.** *(Moderate, interactional)*
9. **EC-08 — Translate or hide enum vocabulary in Layers 1–2.** *(Moderate, interactional)*
10. **EC-10 — Gate label curation behind user approval, matching trait promotion.** *(Moderate, epistemic)*

---

## Aviation checklist — confirmed threats

| Phase | Epistemic risk (confirmed?) | Interactional risk (confirmed?) | Primary finding |
|---|---|---|---|
| Observe | Yes — raw observation detached from inference (EC-03) | Yes — evidence log reads as surveillance | EC-03 |
| Mirror | Yes — inference shown as fact/proposition with no provisional framing (EC-03) | Yes — scored, not reflected (EC-01/02) | EC-01/02/03 |
| Clarify | N/A — no clarify UI exists yet | N/A | (deferred to Evidence Card build) |
| Consent | Yes — promotion bypasses consent entirely (EC-04) | Yes — "Evaluate" competes with reflection | EC-04 |
| Commit | Yes — commit boundary exists in code but no UI reaches it | Yes — permanence is invisible | EC-04/07 |
| Revisit | Yes — no revisit UI; absence cannot be shown as non-contradiction | Yes — nothing surfaces the invitation | EC-07 |
| Reconcile | Yes — `resolveConflict` exists in tests, no UI | Yes — no false-choice guard yet | EC-07 |
| Librarian | Yes — background meaning-change (EC-09/10) | Yes — invisible authorship | EC-09/10 |

The audit confirms the threats are real, not hypothetical: the two critical epistemic violations (EC-04, EC-09) are live code paths, and the interactional violations (EC-01/02) are the current default state of the only surface that renders semantic state.