# Mirror Runtime Service

A TypeScript implementation of a **Constitutional AI Host** that enforces semantic boundaries, personality adaptation, and epistemic discipline through architectural separation.

## Architecture Overview

### Layer 1: Two-Agent Separation

The runtime enforces strict isolation between two agents:

- **PersonaAgent** (`src/subsystems/PersonalityEngine.ts`)
  - Owns the personal library (your Active Memory)
  - Reads `UserProfile` and `PersonalNode`
  - Lives inside the Constitutional Box
  - Adapts its personality to you over time

- **LibrarianAgent** (`src/subsystems/ChromaBridgeCapability.ts`)
  - Owns the global library (`ColorNode` + `TrajectoryEdge`)
  - Has NO access to personal data
  - Returns shared canonical substrate
  - Directs personal queries back to Mirror

**Communication Channel**: `personaConsultLibrarian()` — single narrow function

### Layer 2: 3-Axis Coordinate Space

Every node sits at `(x, y, z)`:

```
X: -255 (abstract/cool) → 255 (concrete/warm)
Y:    0 (general/dim)  → 255 (specific/bright)
Z: -255 (passive/muted) → 255 (active/vivid)
```

**8 Global Base Anchors** (fixed reference points):
- Protect, Danger, Hope, Shadow, Light, Growth, Fear, Trust

Personal nodes are positioned relative to anchors and tethered via `source_global_node_id`.

### Layer 3: Constitutional Boundary

Protected resource: **meaning**, not data.

Three incompatible operation classes:

- **`runIntegrity()`** — autonomous cleanup; cannot append semantic events
- **`propose()`** — advisory only; never mutates the ledger
- **`commit()`** — only path to durable meaning; requires:
  - `conversationId` (which session)
  - `userDecisionId` (which decision event)
  - `actor` (who authorized)
  - `evidence` (what supported it)

**Single-use authority rule**: One conversation decision = exactly one mutation. Reusing throws `AuthorityAlreadyConsumedError`.

## Subsystems

### Constitution
Enforces the four Constitutional Laws:
- Honesty
- Consent
- Provenance
- Epistemic Discipline

```typescript
const constitution = runtime.getConstitution();
const laws = constitution.getLaws();
console.log(laws.consent); // true
```

### ConversationEngine
Manages sessions and semantic commits:

```typescript
const conversation = runtime.getConversationEngine();
const session = conversation.createSession('session-001');

await conversation.commitSemanticChange({
  type: 'authorized-commit',
  authority: {
    id: 'auth-001',
    conversationId: session.sessionId,
    userDecisionId: 'decision-001',
    actor: 'user-123',
    evidence: 'User explicitly requested change',
  },
  targetId: 'node-001',
  delta: 'Added new understanding',
});
```

### CapabilityRouter
Registers and manages subsystem capabilities:

```typescript
const router = runtime.getCapabilityRouter();
const capabilities = router.listCapabilities();
const bridge = router.getCapability('ChromaBridge');
```

### Planner
Decomposes goals into tasks:

```typescript
const planner = runtime.getPlanner();
const task = planner.decompose('Learn TypeScript');
planner.updateTaskStatus(task.id, 'in-progress');
```

### PersonalityEngine
Tracks and adapts personality traits:

```typescript
const personality = runtime.getPersonalityEngine();
const traits = personality.getTraits();
// { warmth: 0.5, openness: 0.5, conscientiousness: 0.5, ... }

personality.adapt({ warmth: 0.1, openness: 0.05 });
```

### ReflectionEngine
Records insights and reflections:

```typescript
const reflection = runtime.getReflectionEngine();
const ref = reflection.reflect('Today's learning', [
  'Understood three-axis coordinate system',
  'Learned about semantic mutations',
]);
```

### ChromaBridgeCapability
3-axis semantic coordinate system:

```typescript
const bridge = runtime.getChromaBridge();

// Create nodes at (x, y, z) coordinates
bridge.createNode('node-001', { x: 100, y: 150, z: 200 }, 'Growth');

// Calculate distances
const dist = bridge.distance('node-001', 'node-002');

// List all nodes
const nodes = bridge.listNodes();
```

## Usage

### Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Run dev server
npm run dev

# Run quickstart example
npm run dev:quickstart

# Run tests
npm test
```

### Example

```typescript
import { MirrorRuntime } from 'mirror-runtime-service';

const runtime = new MirrorRuntime({ userId: 'user-123' });

await runtime.start();
console.log(runtime.getStatus()); // 'ready'

// Access subsystems
const conversation = runtime.getConversationEngine();
const personality = runtime.getPersonalityEngine();
const bridge = runtime.getChromaBridge();

// ... do work ...

await runtime.stop();
```

## Test Suite

**25 comprehensive tests** covering:

✅ Lifecycle (start/stop)  
✅ All 7 subsystems  
✅ Semantic mutation (commit/reject/authority)  
✅ ChromaBridge semantics (nodes, distances)  
✅ Personality adaptation (traits, clamping)  
✅ Planning (decomposition, status)  
✅ Reflection (recording, retrieval)

Run tests:
```bash
npm test
npm test:watch
npm test:coverage
```

## Architecture Principles

1. **Separation of Concerns**
   - Each subsystem owns its domain
   - Communication through accessor methods
   - No cross-cutting side effects

2. **Constitutional Enforcement**
   - Honesty: accurate representation
   - Consent: single-use authorities
   - Provenance: every commit tracked
   - Epistemic Discipline: evidence-based decisions

3. **Semantic Integrity**
   - Meaning protected at architectural level
   - Not just in prompts
   - Mutation boundary enforced by types
   - Single-use authority prevents replay attacks

4. **Type Safety**
   - Full TypeScript strict mode
   - All public APIs typed
   - Runtime status as discriminated union
   - Capability interface for extensibility

## File Structure

```
src/
├── MirrorRuntime.ts                  # Main orchestrator
├── index.ts                          # Export barrel
├── main.ts                           # Service entry point
├── types/
│   └── index.ts                      # All type definitions
├── subsystems/
│   ├── Constitution.ts
│   ├── ConversationEngine.ts
│   ├── CapabilityRouter.ts
│   ├── Planner.ts
│   ├── PersonalityEngine.ts
│   ├── ReflectionEngine.ts
│   └── ChromaBridgeCapability.ts
├── services/
│   └── mirror-runtime.service.ts     # Service wrapper
├── examples/
│   └── quickstart.ts                 # Demo usage
└── __tests__/
    └── MirrorRuntime.spec.ts         # Test suite
```

## Key Design Decisions

1. **Runtime as Orchestrator, Not Service**
   - Runtime owns all subsystems
   - Starts them in dependency order
   - Graceful shutdown cascade

2. **Capability Pattern**
   - Subsystems implement `Capability` interface
   - Registered with CapabilityRouter
   - Dynamically composable

3. **Single-Use Authority**
   - Prevents semantic mutation replay attacks
   - Enforces user consent granularity
   - Timestamp + session + decision scoped

4. **3-Axis Coordinate System**
   - Semantic positioning language
   - Fixed anchors + personal positioning
   - Distance metrics for similarity

## Next Steps

- [ ] Implement PersonaAgent/LibrarianAgent separation
- [ ] Add database persistence layer
- [ ] Build REST API wrapper
- [ ] Integrate LLM for trait positioning
- [ ] Add audit logging
- [ ] Implement evidence card system
- [ ] Create React UI components

## License

MIT