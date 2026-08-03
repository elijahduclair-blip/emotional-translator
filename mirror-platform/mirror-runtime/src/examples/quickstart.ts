import { MirrorRuntime } from '../MirrorRuntime';

async function main() {
  const runtime = new MirrorRuntime({
    userId: 'user-123',
    enablePersistence: true,
  });

  try {
    console.log('\n=== Starting MirrorRuntime ===\n');
    await runtime.start();
    console.log(`Status: ${runtime.getStatus()}\n`);

    const conversation = runtime.getConversationEngine();
    const personality = runtime.getPersonalityEngine();
    const reflection = runtime.getReflectionEngine();
    const chromaBridge = runtime.getChromaBridge();
    const planner = runtime.getPlanner();
    const constitution = runtime.getConstitution();

    console.log('=== Creating Conversation Session ===\n');
    const session = conversation.createSession('session-001');
    console.log(`Session ID: ${session.sessionId}`);
    console.log(`User ID: ${session.userId}`);
    console.log(`Timestamp: ${session.timestamp}\n`);

    console.log('=== Constitutional Laws ===\n');
    const laws = constitution.getLaws();
    console.log(`Honesty: ${laws.honesty}`);
    console.log(`Consent: ${laws.consent}`);
    console.log(`Provenance: ${laws.provenance}`);
    console.log(`Epistemic Discipline: ${laws.epistemicDiscipline}\n`);

    console.log('=== Creating Semantic Nodes ===\n');
    chromaBridge.createNode('anchor-protect', { x: -255, y: 0, z: 0 }, 'Protect', 'protect');
    chromaBridge.createNode('anchor-trust', { x: 255, y: 255, z: -255 }, 'Trust', 'trust');
    chromaBridge.createNode('personal-growth-001', { x: 200, y: 180, z: 150 }, 'Personal Growth');
    console.log();

    console.log('=== Node Distances ===\n');
    const dist1 = chromaBridge.distance('anchor-protect', 'anchor-trust');
    const dist2 = chromaBridge.distance('anchor-trust', 'personal-growth-001');
    console.log(`Distance Protect → Trust: ${dist1?.toFixed(2)}`);
    console.log(`Distance Trust → Growth: ${dist2?.toFixed(2)}\n`);

    console.log('=== Adapting Personality ===\n');
    console.log('Before:', personality.getTraits());
    personality.adapt({ warmth: 0.1, openness: 0.05, conscientiousness: 0.15 });
    console.log('After:', personality.getTraits());
    console.log();

    console.log('=== Planning ===\n');
    const task = planner.decompose('Develop deeper self-understanding');
    console.log(`Task ID: ${task.id}`);
    console.log(`Goal: ${task.goal}`);
    console.log(`Status: ${task.status}\n`);

    planner.updateTaskStatus(task.id, 'in-progress');
    planner.updateTaskStatus(task.id, 'completed');
    console.log();

    console.log('=== Reflection ===\n');
    const ref = reflection.reflect('Today\'s learning', [
      'Understood the three-axis coordinate system',
      'Learned about semantic mutations and commitments',
      'Appreciated the constitutional boundary design',
    ]);
    console.log(`Reflection ID: ${ref.id}`);
    console.log(`Confidence: ${ref.confidence}`);
    console.log(`Insights: ${ref.insights.join(', ')}\n`);

    console.log('=== Semantic Commit ===\n');
    await conversation.commitSemanticChange({
      type: 'authorized-commit',
      authority: {
        id: 'auth-001',
        conversationId: session.sessionId,
        userDecisionId: 'decision-001',
        actor: 'user-123',
        evidence: 'User explicitly requested this change via Mirror interface',
      },
      targetId: 'personal-growth-001',
      delta: 'Added new understanding about personal growth trajectory',
    });
    console.log();

    console.log('=== Registered Capabilities ===\n');
    const capabilities = runtime.getCapabilityRouter().listCapabilities();
    capabilities.forEach((cap) => {
      console.log(`${cap.name} v${cap.version} (enabled: ${cap.enabled})`);
    });
    console.log();

    console.log('=== Semantic Nodes ===\n');
    const nodes = chromaBridge.listNodes();
    nodes.forEach((node) => {
      console.log(`${node.label} [${node.id}]`);
      console.log(`  Coord: (${node.coordinate.x}, ${node.coordinate.y}, ${node.coordinate.z})`);
      if (node.anchor) console.log(`  Anchor: ${node.anchor}`);
    });
    console.log();

    console.log('=== Stopping MirrorRuntime ===\n');
    await runtime.stop();
    console.log(`Status: ${runtime.getStatus()}\n`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();