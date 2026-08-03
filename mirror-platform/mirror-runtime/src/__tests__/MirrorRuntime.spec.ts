import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MirrorRuntime } from '../MirrorRuntime';

describe('MirrorRuntime', () => {
  let runtime: MirrorRuntime;

  beforeEach(() => {
    runtime = new MirrorRuntime({ userId: 'test-user-001' });
  });

  afterEach(async () => {
    if (runtime.getStatus() !== 'stopped' && runtime.getStatus() !== 'idle') {
      await runtime.stop();
    }
  });

  describe('Lifecycle', () => {
    it('should initialize in idle state', () => {
      expect(runtime.getStatus()).toBe('idle');
    });

    it('should start successfully', async () => {
      await runtime.start();
      expect(runtime.getStatus()).toBe('ready');
    });

    it('should not start if already running', async () => {
      await runtime.start();
      await expect(runtime.start()).rejects.toThrow(/already/);
    });

    it('should stop successfully', async () => {
      await runtime.start();
      await runtime.stop();
      expect(runtime.getStatus()).toBe('stopped');
    });

    it('should handle double-stop gracefully', async () => {
      await runtime.start();
      await runtime.stop();
      await runtime.stop(); // Should not throw
      expect(runtime.getStatus()).toBe('stopped');
    });
  });

  describe('Subsystems', () => {
    beforeEach(async () => {
      await runtime.start();
    });

    it('should provide Constitution', () => {
      const constitution = runtime.getConstitution();
      expect(constitution).toBeDefined();
      const laws = constitution.getLaws();
      expect(laws.honesty).toBe(true);
      expect(laws.consent).toBe(true);
      expect(laws.provenance).toBe(true);
    });

    it('should provide ConversationEngine', () => {
      const engine = runtime.getConversationEngine();
      expect(engine).toBeDefined();
      const session = engine.createSession('test-session-001');
      expect(session.userId).toBe('test-user-001');
      expect(session.sessionId).toBe('test-session-001');
    });

    it('should provide CapabilityRouter', () => {
      const router = runtime.getCapabilityRouter();
      expect(router).toBeDefined();
      const capabilities = router.listCapabilities();
      expect(capabilities.length).toBeGreaterThan(0);
      expect(capabilities[0].name).toBe('ChromaBridge');
    });

    it('should provide Planner', () => {
      const planner = runtime.getPlanner();
      expect(planner).toBeDefined();
      const task = planner.decompose('Test goal');
      expect(task.goal).toBe('Test goal');
      expect(task.status).toBe('pending');
    });

    it('should provide PersonalityEngine', () => {
      const engine = runtime.getPersonalityEngine();
      expect(engine).toBeDefined();
      const traits = engine.getTraits();
      expect(traits.warmth).toBe(0.5);
    });

    it('should provide ReflectionEngine', () => {
      const engine = runtime.getReflectionEngine();
      expect(engine).toBeDefined();
      const reflection = engine.reflect('Test', ['insight1']);
      expect(reflection.subject).toBe('Test');
    });

    it('should provide ChromaBridgeCapability', () => {
      const bridge = runtime.getChromaBridge();
      expect(bridge).toBeDefined();
      const node = bridge.createNode('test-node', { x: 0, y: 0, z: 0 }, 'Test');
      expect(node.label).toBe('Test');
    });
  });

  describe('SemanticMutation', () => {
    beforeEach(async () => {
      await runtime.start();
    });

    it('should commit authorized semantic changes', async () => {
      const conversation = runtime.getConversationEngine();
      const session = conversation.createSession('session-001');

      await expect(
        conversation.commitSemanticChange({
          type: 'authorized-commit',
          authority: {
            id: 'auth-001',
            conversationId: session.sessionId,
            userDecisionId: 'decision-001',
            actor: 'test-user-001',
            evidence: 'test evidence',
          },
          targetId: 'node-001',
          delta: 'test delta',
        })
      ).resolves.not.toThrow();
    });

    it('should reject commits without provenance', async () => {
      const conversation = runtime.getConversationEngine();

      await expect(
        conversation.commitSemanticChange({
          type: 'authorized-commit',
          authority: {
            id: 'auth-002',
            conversationId: '',
            userDecisionId: '',
            actor: 'test-user-001',
            evidence: 'test evidence',
          },
          targetId: 'node-001',
          delta: 'test delta',
        })
      ).rejects.toThrow(/Missing provenance/);
    });

    it('should reject reused authority', async () => {
      const conversation = runtime.getConversationEngine();
      const session = conversation.createSession('session-002');

      const commit = {
        type: 'authorized-commit' as const,
        authority: {
          id: 'auth-003',
          conversationId: session.sessionId,
          userDecisionId: 'decision-002',
          actor: 'test-user-001',
          evidence: 'test evidence',
        },
        targetId: 'node-001',
        delta: 'test delta',
      };

      await conversation.commitSemanticChange(commit);

      await expect(conversation.commitSemanticChange(commit)).rejects.toThrow(
        /already used/
      );
    });
  });

  describe('ChromaBridge Semantics', () => {
    beforeEach(async () => {
      await runtime.start();
    });

    it('should create and retrieve nodes', () => {
      const bridge = runtime.getChromaBridge();
      bridge.createNode('node-001', { x: 100, y: 150, z: 200 }, 'Test Node');

      const node = bridge.getNode('node-001');
      expect(node).toBeDefined();
      expect(node?.label).toBe('Test Node');
      expect(node?.coordinate.x).toBe(100);
    });

    it('should calculate distance between nodes', () => {
      const bridge = runtime.getChromaBridge();
      bridge.createNode('node-001', { x: 0, y: 0, z: 0 }, 'Origin');
      bridge.createNode('node-002', { x: 3, y: 4, z: 0 }, 'Endpoint');

      const distance = bridge.distance('node-001', 'node-002');
      expect(distance).toBe(5); // 3-4-5 triangle
    });

    it('should return null for missing nodes', () => {
      const bridge = runtime.getChromaBridge();
      const distance = bridge.distance('missing-1', 'missing-2');
      expect(distance).toBeNull();
    });

    it('should list all nodes', () => {
      const bridge = runtime.getChromaBridge();
      bridge.createNode('node-001', { x: 0, y: 0, z: 0 }, 'Node 1');
      bridge.createNode('node-002', { x: 100, y: 100, z: 100 }, 'Node 2');

      const nodes = bridge.listNodes();
      expect(nodes.length).toBe(2);
    });
  });

  describe('PersonalityAdaptation', () => {
    beforeEach(async () => {
      await runtime.start();
    });

    it('should adapt personality traits', () => {
      const engine = runtime.getPersonalityEngine();
      const before = engine.getTraits();

      engine.adapt({
        warmth: 0.2,
        openness: 0.1,
      });

      const after = engine.getTraits();
      expect(after.warmth).toBeCloseTo(before.warmth + 0.2, 2);
      expect(after.openness).toBeCloseTo(before.openness + 0.1, 2);
    });

    it('should clamp traits to [0, 1]', () => {
      const engine = runtime.getPersonalityEngine();
      engine.updateTrait('warmth', 1.5);
      expect(engine.getTraits().warmth).toBe(1);

      engine.updateTrait('warmth', -0.5);
      expect(engine.getTraits().warmth).toBe(0);
    });
  });

  describe('Planning', () => {
    beforeEach(async () => {
      await runtime.start();
    });

    it('should decompose goals into tasks', () => {
      const planner = runtime.getPlanner();
      const task = planner.decompose('Learn TypeScript');

      expect(task.goal).toBe('Learn TypeScript');
      expect(task.status).toBe('pending');
      expect(task.subtasks).toEqual([]);
    });

    it('should update task status', () => {
      const planner = runtime.getPlanner();
      const task = planner.decompose('Complete project');

      planner.updateTaskStatus(task.id, 'in-progress');
      const updated = planner.getTask(task.id);
      expect(updated?.status).toBe('in-progress');
    });
  });

  describe('Reflection', () => {
    beforeEach(async () => {
      await runtime.start();
    });

    it('should record reflections', () => {
      const engine = runtime.getReflectionEngine();
      const reflection = engine.reflect('Daily review', ['insight 1', 'insight 2']);

      expect(reflection.subject).toBe('Daily review');
      expect(reflection.insights.length).toBe(2);
      expect(reflection.confidence).toBe(0.75);
    });

    it('should retrieve recent reflections', () => {
      const engine = runtime.getReflectionEngine();

      for (let i = 0; i < 15; i++) {
        engine.reflect(`Reflection ${i}`, [`Insight ${i}`]);
      }

      const recent = engine.getReflections(10);
      expect(recent.length).toBe(10);
    });
  });
});