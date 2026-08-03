# Quick Start Guide

## Installation

```bash
cd mirror-runtime-service
npm install
```

## Run the Runtime

```bash
# Development mode
npm run dev

# Production build & run
npm run build
npm start
```

## Run Examples

```bash
# Full quickstart demo
npm run dev:quickstart

# Run tests
npm test
```

## Basic Usage

```typescript
import { MirrorRuntime } from './src';

const runtime = new MirrorRuntime({
  userId: 'user-123',
  enablePersistence: true,
});

// Start all subsystems
await runtime.start();

// Access subsystems
const conversation = runtime.getConversationEngine();
const personality = runtime.getPersonalityEngine();
const bridge = runtime.getChromaBridge();

// Create a conversation session
const session = conversation.createSession('session-001');

// Create semantic nodes
bridge.createNode('growth', { x: 200, y: 180, z: 150 }, 'Personal Growth');

// Adapt personality
personality.adapt({ warmth: 0.1, openness: 0.05 });

// Commit a semantic change
await conversation.commitSemanticChange({
  type: 'authorized-commit',
  authority: {
    id: 'auth-001',
    conversationId: session.sessionId,
    userDecisionId: 'decision-001',
    actor: 'user-123',
    evidence: 'User requested this change',
  },
  targetId: 'growth',
  delta: 'Updated growth trajectory',
});

// Stop the runtime
await runtime.stop();
```

## Architecture at a Glance

```
MirrorRuntime (Orchestrator)
├── Constitution (Laws)
├── ConversationEngine (Sessions & Commits)
├── CapabilityRouter (Plugins)
├── Planner (Goals → Tasks)
├── PersonalityEngine (Traits)
├── ReflectionEngine (Insights)
└── ChromaBridgeCapability (3-Axis Semantics)
```

## Key Concepts

- **Constitutional Boundary**: Meaning is protected at the architectural level
- **3-Axis Coordinates**: Every semantic concept lives at (x, y, z)
- **Single-Use Authority**: Consent is granular and non-replayable
- **Two Agents**: PersonaAgent (private) ↔ LibrarianAgent (shared)

## Test Coverage

All 25 tests passing:
- 5 Lifecycle tests
- 7 Subsystem tests
- 3 Semantic mutation tests
- 4 ChromaBridge tests
- 2 Personality adaptation tests
- 2 Planning tests
- 2 Reflection tests

Run: `npm test`