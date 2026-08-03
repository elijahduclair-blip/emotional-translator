# Epistemic OS (EOS) — The North Star

> **The problem ChromaBridge solves is not "how to store memory."  
> The problem is "what deserves to become part of an AI's enduring understanding of a person."**

---

## I. The Thesis

Existing personal AI systems treat memory as a **storage problem**:
they hear an utterance, extract a concept, and write it to a knowledge graph.

This produces a **gullible system**:
one that reorganizes its entire conceptual model of a person
every time the person speaks something — even a joke, a passing thought,
or a momentary frustration.

**Epistemic OS** reframes memory as an **epistemic problem**:
the system must decide *what is worth remembering* as part of an evolving state,
rather than recording every utterance as established truth.

The core principle is:

> **Persistent state must represent the user's best-supported conceptual model — not their latest utterance.**

This is not a sentiment. It is an architectural constraint
that governs every design decision in ChromaBridge.

---

## II. The Core Vocabulary

| Term | Definition |
|---|---|
| **Conceptual Continuity** | The ability of a system to maintain a coherent understanding of a user across time, context, and conversation boundaries. |
| **Conceptual Amnesia** | The failure of a system to preserve, evolve, or re-access prior conceptual understanding, resulting in groundless re-reasoning. |
| **Persistent Semantic State** | A structured, inspectable, evolving map of the user's conceptual identity — independent of conversational context. |
| **Semantic Substrate** | The architectural layer that holds the Persistent Semantic State; the environment the AI "lives in" between conversations. |
| **Epistemic Discipline** | The governing principle: decide what is worth remembering as part of an evolving state, rather than recording every utterance. |
| **Epistemic Policy** | The formal rule set that governs when observations earn the right to influence persistent state. |

---

## III. The Three-Graph Architecture

The system separates epistemic concerns into **three interacting graphs**.
Each answers a different question.

### 1. Evidence Graph — *"What was actually observed?"*

An immutable, append-oriented log of raw observations.

```
2026-07-28 14:03
Source: direct_statement
Content: "I don't think I'm as analytical as I used to be."
Context: Planning discussion
Reliability: 0.98 (speech recognition)
Temporality: unknown
```

- Never overwritten; only appended.
- Stores provenance, context, and reliability metadata.
- This is **event sourcing** — an engineering problem, well understood.

### 2. Hypothesis Graph — *"What might these observations mean?"*

The interpretive workspace where competing explanations coexist.

```
Hypothesis A: "User is analytical"
  Confidence: 0.82
  Status: Supported
  Supporting evidence: [e1, e3, e7]
  Counter evidence: [e12]

Hypothesis B: "User is transitioning away from analytical thinking"
  Confidence: 0.46
  Status: Emerging
  Supporting evidence: [e12]
  Counter evidence: [e1, e3, e7]
```

- Uncertainty **lives here** — as a first-class structure, not a scalar.
- Competing hypotheses can coexist until evidence resolves them.
- This is where the **research novelty** resides.

### 3. Persistent Semantic Graph — *"What should currently guide the system's behavior?"*

Stable concepts that have earned structural influence.

```
Concept: "Analytical Architect"
  Confidence: 0.79
  Stability: 0.85
  Status: Evolving
  Valid from: 2026-01-15
  Supporting hypotheses: [H1, H4]
  Active conflicts: [H2]
```

- Only concepts that pass the Epistemic Policy earn entry.
- This is the graph ChromaBridge renders and navigates.
- Physics operates **only** on this layer.

---

## IV. The Hypothesis Lifecycle

A hypothesis is not a simple flag. It moves through a **state machine**
that mirrors how humans actually form and revise beliefs.

```
Observed
    ↓
Interpreted
    ↓
Candidate
    ↓
Contested ←──────┐
    ↓             │
Supported         │ (counter-evidence)
    ↓             │
Persistent        │
    ↓             │
Historical ───────┘
    ↓
Archived
```

### Key Insight

**Only one stage — `Persistent` — becomes part of the Semantic Graph.**

Everything before it is **epistemic work**:
interpretation, uncertainty, conflict resolution, and evidence accumulation.

The Librarian does not ask *"Is this true?"*
It asks *"What kind of claim is this?"*

```
"I like coffee."              → Preference (low evidence burden)
"I'm becoming more patient."   → Identity transition (high evidence burden)
"I hate Mondays."              → Recurring pattern? Temporary frustration? Humor?
                                  (ambiguous — requires behavioral evidence)
```

The classification **determines the burden of proof**.

---

## V. The Epistemic Assessment

A single `confidence: 0.72` is too compressed. It hides *why* the system is uncertain.

Instead, confidence is decomposed into **epistemic dimensions**:

```
EpistemicAssessment {
  interpretationConfidence:    // Did we understand the claim correctly?
  sourceReliability:            // How trustworthy is the source?
  crossContextConsistency:      // Does this hold across different conversations?
  repetitionStrength:           // Has this been observed repeatedly?
  temporalStability:            // Has it persisted over time?
  contradictionPressure:        // Are there opposing observations?
  userConfirmationStrength:      // Did the user explicitly confirm it?
}
```

Two concepts may both have aggregate confidence `0.72` but for **completely different reasons**.
One has strong direct confirmation but little history.
Another has extensive behavioral support but no explicit confirmation.

**Those should not evolve identically.**

---

## VI. The Epistemic Policy

The formal rules that govern state mutation.

### Policy 001: No Identity by Default
> The system does not assume a stable identity. Identity must be **earned**
> through accumulated, cross-context evidence.

### Policy 002: Evidence Before Structure
> A concept cannot enter the Persistent Semantic Graph until its supporting
> hypotheses have passed the promotion threshold.

### Policy 003: Tension Before Replacement
> When a new observation conflicts with an existing anchor, the system creates
> a **Candidate Transition** — not an overwrite. The existing state remains
> active until the transition is confirmed.

### Policy 004: Uncertainty Is Structure, Not Annotation
> Uncertainty must be represented as a **first-class object** (a hypothesis with
> a status) — not a `confidence: float` field attached to a conclusion.

### Policy 005: History Preserved, Present Protected
> Transitions are recorded explicitly (trajectory edges). Historical context
> remains queryable but does not exert force on current-state behavior.

---

## VII. The Physics Layer: Policy-Aware

The physics engine **does not operate on raw observations**.
It operates on **epistemically qualified state candidates**.

Force calculations are gated by epistemic status:

| Epistemic Status | Structural Force |
|---|---|
| Raw observation | None |
| Emerging hypothesis | Local candidate neighborhood influence only |
| Supported hypothesis | Limited structural force |
| Persistent concept | Full topology participation |
| Contested concept | Reduced or bidirectional force |
| Deprecated concept | Historical links retained; current-state influence removed |

**This prevents the "pirate identity" problem:**
a user joking about becoming a pirate twenty times creates evidence,
generates an emerging hypothesis, but the hypothesis never reaches
the promotion threshold. The graph remains stable. The joke is heard
but not believed.

---

## VIII. The Librarian: Epistemic Governor

The Librarian is not a graph custodian. It is an **epistemic governor**
with three responsibilities:

1. **Preserve evidence faithfully** — never overwrite; always append.
2. **Resist premature promotion** — maintain the burden of proof.
3. **Permit revision without erasing history** — transitions are explicit.

The physics engine organizes accepted state.
The Librarian decides what is **eligible** to influence it.

---

## IX. The Implementation Order

> **Organization should never outrun justification.**

```
1. Hypothesis Layer
     Define how interpretations, uncertainty, promotion,
     and competing explanations are represented.

2. Evidence Layer
     Build the immutable substrate that feeds those hypotheses.

3. Controller (Epistemic Policy Engine)
     Implement the policies that decide when hypotheses
     earn structural influence.

4. Persistent Semantic Graph
     Represent only concepts that have passed those policies.

5. Physics Engine
     Optimize the organization and evolution of an
     already-epistemically-sound state.
```

Physics is **postponed** because physics organizes whatever it's given.
If the system admits poorly justified concepts into persistent state,
the graph can be beautifully organized and still faithfully preserve
the wrong structure.

---

## X. The Research Contribution

The distinctive contribution of Epistemic OS is **not**:

- Persistent semantic state (many systems have memory).
- Knowledge graphs (many systems have graphs).
- Event sourcing (many systems have logs).

The distinctive contribution **is**:

> **Explicitly modeling the intermediate interpretive process — the space
> between observation and state — as a first-class, inspectable object.**

This opens doors that no existing system can answer:

- *Why was this concept promoted?*
- *What evidence is missing?*
- *Which hypotheses are competing?*
- *What would change the system's mind?*

These are **epistemic questions**, not storage questions.

---

## XI. What Survives from ChromaBridge

The original graph-based implementation remains viable, but its **center of gravity** shifts:

| Before | After |
|---|---|
| Concept organization | Evidence-mediated state formation |
| Utterance → Node creation → Graph maintenance | Utterance → Observation → Hypothesis → Evidence accumulation → Candidate transition → Policy evaluation → State mutation → Graph evolution |
| Physics on raw proximity | Physics on epistemically qualified state |
| Librarian as graph custodian | Librarian as epistemic governor |
| Single semantic graph | Three interacting graphs (Evidence / Hypothesis / State) |

The graph is no longer the place where interpretation immediately becomes reality.
It is the place where **earned semantic commitments are organized** —
while observations, hypotheses, conflicts, and suspended transitions
remain visibly distinct.

---

*This document is the North Star. Every design decision in ChromaBridge
is evaluated against the principles articulated here.*