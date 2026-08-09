import { describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { MirrorRuntime } from '../MirrorRuntime';
import { MirrorRuntimeService } from '../services/mirror-runtime.service';
import { createMirrorHttpServer } from '../http';

describe('Mirror Platform vertical slice', () => {
  it('asks ChromaBridge for a boundary-safe evaluation', async () => {
    const runtime = new MirrorRuntime({
      userId: 'test-user',
      enablePersistence: false,
      enableCodexGraphRead: false
    });

    await runtime.start();
    const result = await runtime.ask('Ember motion beside silver revision');
    await runtime.stop();

    expect(result.persisted).toBeNull();
    expect(result.evaluation.status).toBe('proposed');
    expect(result.evaluation.boundary.semanticMutationAllowed).toBe(false);
    expect(result.evaluation.climateSignals.map(signal => signal.family)).toEqual(['ember', 'silver']);
    expect(result.translation.climateName).toBe('Ember beside Silver');
  });

  it('connects HTTP ask to ChromaBridge evaluation and Codex save', async () => {
    let receivedEvaluation: Record<string, unknown> | undefined;
    let receivedLocalContext: Record<string, any> | undefined;
    let receivedAlignmentRequest: Record<string, any> | undefined;
    let receivedFeedback: Record<string, any> | undefined;
    let alignmentRequestCount = 0;
    const localModel = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      if (request.url === '/api/tags') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ models: [{ name: 'qwen3:4b-instruct' }] }));
        return;
      }
      if (request.url === '/api/chat') {
        receivedLocalContext = JSON.parse(body.messages[1].content);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          model: 'qwen3:4b-instruct',
          message: { content: body.format ? JSON.stringify({
            sourceIndex: 1, targetIndex: 2, relationshipType: 'moves_toward',
            evidence: 'The unresolved phrase places both grounded labels together.',
            counterexample: 'Reject when reviewed uses consistently separate Amber from Glow.',
            confidence: 'low'
          }) : 'Reflection is moving as an open climate.' },
          done: true,
          total_duration: 1_000_000_000,
          load_duration: 1_000_000,
          prompt_eval_count: 32,
          eval_count: 9
        }));
        return;
      }
      response.writeHead(404).end();
    });
    await listen(localModel);
    const localModelAddress = localModel.address();
    if (!localModelAddress || typeof localModelAddress === 'string') throw new Error('Local model test server did not bind.');
    const alignmentModel = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      if (request.url === '/health') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          status: 'ready', provider: 'transformers_peft', model: 'Qwen/Qwen3-0.6B',
          adapter: 'qwen3-0.6b-alignment-v2', device: 'cpu', learned: true,
          validation: { examples: 38, exactMatches: 38, jsonEquivalentMatches: 38 }
        }));
        return;
      }
      if (request.url === '/v1/evaluate') {
        alignmentRequestCount += 1;
        receivedAlignmentRequest = body;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          engine: 'mirror_learned_alignment',
          model: { provider: 'transformers_peft', base: 'Qwen/Qwen3-0.6B', adapter: 'qwen3-0.6b-alignment-v2', local: true, learned: true },
          mode: 'authority_boundary',
          result: {
            sourceLayer: 'chromabridge_knowledge', importedTierIsCanonicalAnchor: false,
            coordinateDistanceCreatesMeaning: false, semanticMutationAllowed: false, graphMutationAllowed: false
          },
          contractVerified: true,
          boundary: { semanticMutationAllowed: false, graphMutationAllowed: false, coordinateDistanceCreatesMeaning: false, reason: 'verified' }
        }));
        return;
      }
      response.writeHead(404).end();
    });
    await listen(alignmentModel);
    const alignmentModelAddress = alignmentModel.address();
    if (!alignmentModelAddress || typeof alignmentModelAddress === 'string') throw new Error('Alignment model test server did not bind.');
    const codex = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const body = JSON.parse(rawBody || '{}');
      if (request.url === '/api/v1/foundation/braille-runtime/compile') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          engine: 'braille_runtime_language',
          originalEnglish: body.input,
          executableBraille: '⠺⠓⠑⠝⠀⠸⠩⠀⠭⠀⠨⠂⠱⠀⠼⠒⠀⠸⠱',
          instruction: { action: 'propose_route', authority: 'proposal_only' },
          evaluation: { conditionMet: true, observedValue: body.observedValue },
          proposal: { status: 'proposed', action: 'propose_route', sourceMutationAllowed: false },
          boundary: { mode: 'proposal_only', sourceMutationAllowed: false, generatedCodeExecutionAllowed: false }
        }));
        return;
      }
      if (request.url === '/api/v1/foundation/language-loop') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          engine: 'reversible_language_loop',
          originalEnglish: body.text,
          canonicalEnglish: body.text,
          encoding: { ueb: '⠠⠉⠁⠞', cells: [{ index: 1, mask: 32, bits: '100000' }], numericSequence: [32], binarySequence: ['100000'] },
          processing: { foundation: { wordCounts: [{ word: 'cat', count: 1 }] } },
          decoding: { english: body.text, roundTripExact: true },
          meaning: { approvedGraph: { sourceLayer: 'unresolved', nodes: [], routes: [] }, wordNet: { matchedWords: [] } },
          boundary: { mode: 'reversible_signal_with_relational_evidence', encodingCreatesMeaning: false, semanticMutationAllowed: false }
        }));
        return;
      }
      if (request.url === '/api/v1/foundation/training/dataset') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          engine: 'mirror_training_dataset_generator',
          version: '1.0.0',
          format: 'chat_jsonl',
          sourceCount: body.inputs.length,
          recordCount: body.inputs.length * 4,
          tokenVocabulary: Array.from({ length: 64 }, (_, mask) => ({ token: `<B${String(mask).padStart(2, '0')}>`, mask })),
          jsonlBytes: 1024,
          validation: { valid: true, samples: [] },
          records: body.inputs.flatMap((input: string) => ['english_to_structural', 'structural_to_english', 'ordered_foundation', 'relational_grounding'].map(task => ({ task, messages: [], metadata: { verified: true, input } }))),
          boundary: { modelWeightsChanged: false, semanticMutationAllowed: false }
        }));
        return;
      }
      if (request.url === '/api/v1/foundation/training/color-atlas') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          engine: 'mirror_color_atlas_training_converter',
          version: '1.0.0',
          format: 'chat_jsonl',
          source: { document: 'ChromaBridge Export example.pdf', pageCount: 4, sha256: 'source-hash' },
          sourceRecordCount: 95,
          selection: { offset: 0, limit: 95, returned: 95 },
          tierCounts: { base: 15, bridge: 11, shade: 69 },
          recordCount: 380,
          tokenVocabulary: Array.from({ length: 64 }, (_, mask) => ({ token: `<B${String(mask).padStart(2, '0')}>`, mask })),
          jsonlBytes: 1024,
          validation: { valid: true, sourceRowsAccountedFor: 95, samples: [] },
          records: [{ task: 'color_atlas_name_to_record', messages: [], metadata: { task: 'color_atlas_name_to_record', verified: true } }],
          boundary: { modelWeightsChanged: false, semanticMutationAllowed: false, canonicalAnchorMutationAllowed: false }
        }));
        return;
      }
      if (request.url === '/api/v1/foundation/braille-runtime/assemble') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          engine: 'braille_runtime_module_assembler',
          module: { templateId: 'route_proposal_v1', state: 'assembled_for_review' },
          execution: { status: 'assembled', output: { type: 'route', status: 'ready_for_review' } },
          compiledInstruction: { executableBraille: '⠺⠓⠑⠝⠀⠸⠩⠀⠭⠀⠸⠱' },
          boundary: { mode: 'predefined_module_only', sourceMutationAllowed: false, externalMutationAllowed: false }
        }));
        return;
      }
      if (request.url === '/api/v1/foundation/braille-runtime/modules' && request.method === 'POST') {
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ module: { id: 'brm_test', templateId: 'route_proposal_v1', status: 'assembled' } }));
        return;
      }
      if (request.url === '/api/v1/foundation/braille-runtime/modules' && request.method === 'GET') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ modules: [{ id: 'brm_test', templateId: 'route_proposal_v1', status: 'assembled' }], count: 1 }));
        return;
      }
      if (request.url === '/api/v1/foundation/braille-runtime/modules/brm_test/review') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ module: { id: 'brm_test', status: 'reviewed' }, activation: { token: 'one-time-authority', singleUse: true } }));
        return;
      }
      if (request.url === '/api/v1/foundation/braille-runtime/modules/brm_test/activate') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ module: { id: 'brm_test', status: 'activated' }, result: { type: 'graph_relationship_proposal', status: 'proposed' }, idempotent: false }));
        return;
      }
      if (request.url === '/api/v1/foundation/letters/analyze') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          engine: 'foundation_letters',
          totals: { occurrences: 2, distinctSignatures: 1, accountedLetters: 6 },
          signatures: [{ id: 'w1', normalizedWord: 'cat' }],
          wordSequence: [{ occurrence: 1, signatureId: 'w1', surface: 'CAT' }, { occurrence: 2, signatureId: 'w1', surface: 'cat' }],
          boundary: { mode: 'structure_only', semanticMutationAllowed: false, brailleMeaningInherited: false }
        }));
        return;
      }
      if (request.url === '/api/v1/foundation/letters/compare') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ differenceCount: 1, differences: [{ operation: 'substitution', leftPosition: 1, rightPosition: 1, left: 'c', right: 'b' }] }));
        return;
      }
      if (request.url === '/api/v1/braille/math/curriculum') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ version: '1.0.0', lessons: [{ id: 'cells-and-numbers' }] }));
        return;
      }
      if (request.url === '/api/v1/braille/math/translate') {
        if (body.input === 'sqrt(4)') {
          response.writeHead(422, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ error: 'Unsupported advanced structure in version one.' }));
          return;
        }
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          normalizedPrint: body.input,
          unicodeBraille: '⠼⠆⠬⠆',
          boundary: { mode: 'notation_only', semanticMutationAllowed: false, colorAssignmentAllowed: false }
        }));
        return;
      }
      if (request.url === '/api/v1/auth/login') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ token: 'signed-codex-token', user: { id: 'learner', username: 'learner' } }));
        return;
      }
      if (request.url === '/api/v1/local-ai/feedback' && request.method === 'POST') {
        receivedFeedback = body;
        expect(request.headers.authorization).toBe('Bearer signed-codex-token');
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          feedback: { id: 'feedback-1', interactionId: body.receipt.interactionId, decision: body.decision, status: 'proposed' },
          boundary: { trainingStarted: false, modelWeightsChanged: false, activeAdapterChanged: false }
        }));
        return;
      }
      if (request.url === '/api/v1/local-ai/feedback' && request.method === 'GET') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ feedback: [], count: 0 }));
        return;
      }
      if (request.url?.startsWith('/api/v1/local-ai/user-graph?text=') && request.method === 'GET') {
        expect(request.headers.authorization).toBe('Bearer signed-codex-token');
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ sourceLayer: 'user_graph', consulted: true, relationships: [], relationshipCount: 0, truncated: false }));
        return;
      }
      if (request.url === '/api/v1/local-ai/feedback/feedback-1/review' && request.method === 'PATCH') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ feedback: { id: 'feedback-1', status: body.decision } }));
        return;
      }
      if (request.url === '/api/v1/local-ai/training/candidates' && request.method === 'GET') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ version: '1.0.0', recordCount: 1, jsonl: '{}\n', boundary: { trainingStarted: false, activeAdapterChanged: false } }));
        return;
      }
      if (request.url === '/api/v1/local-ai/training/active' && request.method === 'GET') {
        expect(request.headers.authorization).toBe('Bearer test-service-token');
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ activeVersion: null }));
        return;
      }
      if (request.url === '/api/v1/translate/graph-read') {
        if (body.text === 'Amber Glow') {
          response.writeHead(200, { 'content-type': 'application/json' });
          response.end(JSON.stringify({
            input: body.text,
            sourceLayer: 'chromabridge_knowledge',
            matchedNodes: [{
              id: 'amber-glow', label: 'Amber Glow', type: 'bridge', family: 'stimulus', hexColor: '#FFBF00',
              coordinate: { x: 255, y: 149, z: 255 },
              sourceRef: { document: 'ChromaBridge Export example.pdf', page: 1, row: 18, extractionConfidence: 'high' }
            }],
            supportedRoutes: [],
            colorClimateLanding: null,
            connectionStrength: 'low',
            evidence: { nodeCount: 1, routeCount: 0, confidenceBasis: 'Imported exact phrase.' },
            boundary: 'Imported reference knowledge only.'
          }));
          return;
        }
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          input: body.text,
          sourceLayer: 'approved_graph',
          matchedNodes: [{ id: 'rose', label: 'Rose', type: 'family', family: 'rose', hexColor: '#b85c7d' }],
          supportedRoutes: [{ id: 'rose-midnight', source: 'rose', target: 'midnight', weight: 2 }],
          colorClimateLanding: { id: 'midnight', label: 'Midnight', family: 'midnight', color: '#223a5e' },
          connectionStrength: 'medium',
          evidence: { nodeCount: 1, routeCount: 1, confidenceBasis: 'Stored graph route.' },
          boundary: 'This is a relational climate read, not a diagnosis or permanent identity claim.'
        }));
        return;
      }

      receivedEvaluation = body.evaluation;
      expect(body.graphRead.matchedNodeIds).toEqual(['rose']);
      expect(body.graphRead.supportedRouteIds).toEqual(['rose-midnight']);
      expect(body.graphRead.matchedNodes).toBeUndefined();
      expect(body.graphRead.supportedRoutes).toBeUndefined();
      expect(request.url).toBe('/api/v1/runtime/evaluations');
      expect(request.headers.authorization).toBe('Bearer test-service-token');
      expect(body.translation.source).toBe('codex_graph');
      response.writeHead(201, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        id: 'stored-1',
        evaluationId: body.evaluation.id,
        status: 'recorded',
        createdAt: '2026-07-31T00:00:00.000Z'
      }));
    });
    await listen(codex);
    const codexAddress = codex.address();
    if (!codexAddress || typeof codexAddress === 'string') throw new Error('Codex test server did not bind.');

    const service = new MirrorRuntimeService({
      userId: 'test-user',
      codexApiUrl: `http://127.0.0.1:${codexAddress.port}`,
      codexServiceToken: 'test-service-token',
      localModelUrl: `http://127.0.0.1:${localModelAddress.port}`,
      localModelName: 'qwen3:4b-instruct',
      enableAlignmentModel: true,
      alignmentModelUrl: `http://127.0.0.1:${alignmentModelAddress.port}`
    });
    await service.start();
    const mirror = createMirrorHttpServer(service);
    await listen(mirror);
    const mirrorAddress = mirror.address();
    if (!mirrorAddress || typeof mirrorAddress === 'string') throw new Error('Mirror test server did not bind.');

    try {
      const shellResponse = await fetch(`http://127.0.0.1:${mirrorAddress.port}/`);
      const shell = await shellResponse.text();
      expect(shellResponse.status).toBe(200);
      expect(shell).toContain('Mirror Platform');
      expect(shell).toContain('id="atlas"');
      expect(shell).toContain('id="governance"');
      expect(shell).toContain('id="memory"');
      expect(shell).toContain('id="braille"');
      expect(shell).toContain('id="foundation"');
      expect(shell).toContain('S-D-F for dots 3-2-1');
      expect(shell).toContain('StructuralCell');
      expect(shell).toContain('Braille Runtime Language');
      expect(shell).toContain('id="moduleGovernance"');
      expect(shell).toContain('Submit assembled module to Governance');
      expect(shell).toContain('Reversible language loop');
      expect(shell).toContain('Your local AI / Qwen3 reasoning');
      expect(shell).toContain('Verified training dataset');
      expect(shell).toContain('Convert current color atlas');
      expect(shell).toContain('Learned Alignment adapter');
      expect(shell).toContain('Learned handoff');
      expect(shell).toContain('Teach this response');
      expect(shell).toContain('Imagination stage');
      expect(shell).toContain('Supervised learning feedback');
      expect(shell).toContain('Prepare accepted feedback dataset');
      expect(shell).toContain('Prepare Qwen3 4B version');
      expect(shell).toContain('Conversational adapter versions');
      expect(shell).toContain('record.metadata.task');

      const health = await fetch(`http://127.0.0.1:${mirrorAddress.port}/health`);
      const healthBody = await health.json() as {
        localModel: { status: string; model: string };
        alignmentModel: { status: string; validation: { exactMatches: number } };
      };
      expect(healthBody.localModel.status).toBe('ready');
      expect(healthBody.localModel.model).toBe('qwen3:4b-instruct');
      expect(healthBody.alignmentModel.status).toBe('ready');
      expect(healthBody.alignmentModel.validation.exactMatches).toBe(38);

      const localAi = await fetch(`http://127.0.0.1:${mirrorAddress.port}/local-ai/respond`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ input: 'Amber Glow' })
      });
      const localAiBody = await localAi.json() as {
        model: { name: string; local: boolean };
        response: { language: string; text: string };
        relationalEvidence: { matchedNodeCount: number; confirmedRouteCount: number; relationshipClaimsSupported: boolean; notice: string };
        feedback: {
          eligible: boolean;
          receipt: { version: string; interactionId: string; issuedAt: string; signature: string };
          context: Record<string, unknown>;
          boundary: { trainingStarted: boolean; modelWeightsChanged: boolean; activeAdapterChanged: boolean };
        };
        trace: {
          roundTripExact: boolean;
          graphSource: string;
          learnedAlignment: { consulted: boolean; status: string; contractVerified: boolean; adapter: string };
          conversationAdapter: { status: string; versionId: string | null; servedModel: string };
        };
        boundary: { semanticMutationAllowed: boolean };
      };
      expect(localAi.status).toBe(200);
      expect(localAiBody.model).toEqual({ provider: 'ollama', name: 'qwen3:4b-instruct', local: true });
      expect(localAiBody.response).toEqual({ language: 'english', text: 'Reflection is moving as an open climate.' });
      expect(localAiBody.trace.roundTripExact).toBe(true);
      expect(localAiBody.trace.graphSource).toBe('chromabridge_knowledge');
      expect(localAiBody.trace.learnedAlignment).toEqual({
        consulted: true,
        status: 'verified',
        contractVerified: true,
        adapter: 'qwen3-0.6b-alignment-v2'
      });
      expect(localAiBody.trace.conversationAdapter).toEqual(expect.objectContaining({
        status: 'base_model',
        versionId: null,
        servedModel: 'qwen3:4b-instruct'
      }));
      expect(localAiBody.relationalEvidence).toEqual(expect.objectContaining({
        matchedNodeCount: 1,
        confirmedRouteCount: 0,
        relationshipClaimsSupported: false
      }));
      expect(localAiBody.relationalEvidence.notice).toContain('no relationship is established');
      expect(localAiBody.boundary.semanticMutationAllowed).toBe(false);
      expect(localAiBody.feedback.eligible).toBe(true);
      expect(localAiBody.feedback.receipt.signature.length).toBeGreaterThan(20);
      expect(localAiBody.feedback.boundary).toEqual(expect.objectContaining({
        trainingStarted: false,
        modelWeightsChanged: false,
        activeAdapterChanged: false
      }));
      expect(receivedLocalContext?.userEnglish).toBe('Amber Glow');
      expect(receivedLocalContext?.signal.numericSequence.length).toBeGreaterThan(0);
      expect(receivedLocalContext?.relationships.sourceLayer).toBe('chromabridge_knowledge');
      expect(receivedLocalContext?.learnedAlignment.contractVerified).toBe(true);
      expect(receivedAlignmentRequest?.mode).toBe('authority_boundary');
      expect(receivedAlignmentRequest?.record.name).toBe('Amber Glow');
      expect(alignmentRequestCount).toBe(1);

      const governedGraphAi = await fetch(`http://127.0.0.1:${mirrorAddress.port}/local-ai/respond`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ input: 'Rose connection' })
      });
      const governedGraphAiBody = await governedGraphAi.json() as {
        trace: { graphSource: string; learnedAlignment: { status: string; consulted: boolean } };
      };
      expect(governedGraphAi.status).toBe(200);
      expect(governedGraphAiBody.trace.graphSource).toBe('approved_graph');
      expect(governedGraphAiBody.trace.learnedAlignment).toEqual(expect.objectContaining({
        status: 'not_applicable',
        consulted: false
      }));
      expect(alignmentRequestCount).toBe(1);

      const trainingDataset = await fetch(`http://127.0.0.1:${mirrorAddress.port}/foundation/training/dataset`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ inputs: ['CAT', 'BAT'] })
      });
      const trainingBody = await trainingDataset.json() as { recordCount: number; validation: { valid: boolean }; boundary: { modelWeightsChanged: boolean } };
      expect(trainingDataset.status).toBe(200);
      expect(trainingBody.recordCount).toBe(8);
      expect(trainingBody.validation.valid).toBe(true);
      expect(trainingBody.boundary.modelWeightsChanged).toBe(false);

      const atlasDataset = await fetch(`http://127.0.0.1:${mirrorAddress.port}/foundation/training/color-atlas`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: '{}'
      });
      const atlasBody = await atlasDataset.json() as {
        sourceRecordCount: number;
        recordCount: number;
        validation: { valid: boolean; sourceRowsAccountedFor: number };
        boundary: { modelWeightsChanged: boolean; canonicalAnchorMutationAllowed: boolean };
      };
      expect(atlasDataset.status).toBe(200);
      expect(atlasBody.sourceRecordCount).toBe(95);
      expect(atlasBody.recordCount).toBe(380);
      expect(atlasBody.validation).toEqual({ valid: true, sourceRowsAccountedFor: 95, samples: [] });
      expect(atlasBody.boundary.modelWeightsChanged).toBe(false);
      expect(atlasBody.boundary.canonicalAnchorMutationAllowed).toBe(false);

      const languageLoop = await fetch(`http://127.0.0.1:${mirrorAddress.port}/foundation/language-loop`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ text: 'CAT' })
      });
      const languageLoopBody = await languageLoop.json() as {
        decoding: { roundTripExact: boolean };
        boundary: { encodingCreatesMeaning: boolean };
        governance: { chromaBridge: { semanticMutationAllowed: boolean } };
      };
      expect(languageLoop.status).toBe(200);
      expect(languageLoopBody.decoding.roundTripExact).toBe(true);
      expect(languageLoopBody.boundary.encodingCreatesMeaning).toBe(false);
      expect(languageLoopBody.governance.chromaBridge.semanticMutationAllowed).toBe(false);

      const foundation = await fetch(`http://127.0.0.1:${mirrorAddress.port}/foundation/letters/analyze`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ text: 'CAT cat' })
      });
      const foundationBody = await foundation.json() as { totals: { occurrences: number }; boundary: { semanticMutationAllowed: boolean; brailleMeaningInherited: boolean } };
      expect(foundation.status).toBe(200);
      expect(foundationBody.totals.occurrences).toBe(2);
      expect(foundationBody.boundary.semanticMutationAllowed).toBe(false);
      expect(foundationBody.boundary.brailleMeaningInherited).toBe(false);

      const comparison = await fetch(`http://127.0.0.1:${mirrorAddress.port}/foundation/letters/compare`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ left: 'CAT', right: 'BAT' })
      });
      expect(comparison.status).toBe(200);

      const compiled = await fetch(`http://127.0.0.1:${mirrorAddress.port}/foundation/braille-runtime/compile`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ input: 'When pattern count >= 3, then propose a route.', observedValue: 4 })
      });
      const compiledBody = await compiled.json() as { instruction: { authority: string }; boundary: { sourceMutationAllowed: boolean }; governance: { chromaBridge: { semanticMutationAllowed: boolean } } };
      expect(compiled.status).toBe(200);
      expect(compiledBody.instruction.authority).toBe('proposal_only');
      expect(compiledBody.boundary.sourceMutationAllowed).toBe(false);
      expect(compiledBody.governance.chromaBridge.semanticMutationAllowed).toBe(false);

      const assembled = await fetch(`http://127.0.0.1:${mirrorAddress.port}/foundation/braille-runtime/assemble`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({
          input: 'When pattern count >= 3, then propose a route.',
          observedValue: 4,
          proposalDecision: 'approved'
        })
      });
      const assembledBody = await assembled.json() as {
        module: { templateId: string };
        boundary: { externalMutationAllowed: boolean };
        governance: { chromaBridge: { semanticMutationAllowed: boolean } };
      };
      expect(assembled.status).toBe(200);
      expect(assembledBody.module.templateId).toBe('route_proposal_v1');
      expect(assembledBody.boundary.externalMutationAllowed).toBe(false);
      expect(assembledBody.governance.chromaBridge.semanticMutationAllowed).toBe(false);

      const curriculum = await fetch(`http://127.0.0.1:${mirrorAddress.port}/braille/curriculum`);
      expect(curriculum.status).toBe(200);

      const braille = await fetch(`http://127.0.0.1:${mirrorAddress.port}/braille/translate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ direction: 'print_to_nemeth', inputFormat: 'ascii_math', input: '2+2' })
      });
      const brailleBody = await braille.json() as { governance: { chromaBridge: { mode: string; semanticMutationAllowed: boolean } } };
      expect(braille.status).toBe(200);
      expect(brailleBody.governance.chromaBridge.mode).toBe('notation_only');
      expect(brailleBody.governance.chromaBridge.semanticMutationAllowed).toBe(false);

      const unsupported = await fetch(`http://127.0.0.1:${mirrorAddress.port}/braille/translate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ direction: 'print_to_nemeth', inputFormat: 'ascii_math', input: 'sqrt(4)' })
      });
      expect(unsupported.status).toBe(422);

      const login = await fetch(`http://127.0.0.1:${mirrorAddress.port}/account/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ email: 'learner@example.com', password: 'Example2026' })
      });
      const loginBody = await login.json() as Record<string, unknown>;
      expect(login.status).toBe(200);
      expect(login.headers.get('set-cookie')).toContain('HttpOnly');
      expect(loginBody.token).toBeUndefined();
      const session = login.headers.get('set-cookie')?.split(';')[0];

      const invention = await fetch(`http://127.0.0.1:${mirrorAddress.port}/local-ai/inventions/propose`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin', cookie: session! },
        body: JSON.stringify({ input: 'Amber Glow', interactionId: 'interaction-invention-1' })
      });
      const inventionBody = await invention.json() as {
        proposal: { source: string; target: string; origin: string; status: string; confidence: string };
        boundary: { persisted: boolean; graphMutationAllowed: boolean; trainingStarted: boolean };
      };
      expect(invention.status).toBe(200);
      expect(inventionBody.proposal).toEqual(expect.objectContaining({
        source: 'Amber', target: 'Glow', origin: 'ai_generated', status: 'uncommitted_hypothesis', confidence: 'low'
      }));
      expect(inventionBody.boundary).toEqual(expect.objectContaining({
        persisted: false, graphMutationAllowed: false, trainingStarted: false
      }));
      expect(session).toContain('mirror_session=');

      const feedback = await fetch(`http://127.0.0.1:${mirrorAddress.port}/local-ai/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin', cookie: session! },
        body: JSON.stringify({
          ...localAiBody.feedback.context,
          receipt: localAiBody.feedback.receipt,
          decision: 'corrected',
          correction: 'Amber Glow is an imported reference match. No supplied route establishes a relationship.'
        })
      });
      const feedbackBody = await feedback.json() as { feedback: { status: string }; boundary: { modelWeightsChanged: boolean } };
      expect(feedback.status).toBe(201);
      expect(feedbackBody.feedback.status).toBe('proposed');
      expect(feedbackBody.boundary.modelWeightsChanged).toBe(false);
      expect(receivedFeedback?.decision).toBe('corrected');
      expect(receivedFeedback?.receipt.signature).toBe(localAiBody.feedback.receipt.signature);

      const submittedModule = await fetch(`http://127.0.0.1:${mirrorAddress.port}/foundation/braille-runtime/modules`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin', cookie: session! },
        body: JSON.stringify({ input: 'When pattern count >= 3, then propose a route.', observedValue: 4, proposalDecision: 'approved' })
      });
      expect(submittedModule.status).toBe(201);
      const reviewedModule = await fetch(`http://127.0.0.1:${mirrorAddress.port}/foundation/braille-runtime/modules/brm_test/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin', cookie: session! },
        body: JSON.stringify({ decision: 'approved', reviewNote: 'Verified.' })
      });
      const reviewedModuleBody = await reviewedModule.json() as { activation: { singleUse: boolean } };
      expect(reviewedModule.status).toBe(200);
      expect(reviewedModuleBody.activation.singleUse).toBe(true);
      const activatedModule = await fetch(`http://127.0.0.1:${mirrorAddress.port}/foundation/braille-runtime/modules/brm_test/activate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin', cookie: session! },
        body: JSON.stringify({ activationToken: 'one-time-authority', parameters: { sourceNodeId: 'a', targetNodeId: 'b' } })
      });
      const activatedModuleBody = await activatedModule.json() as { result: { status: string } };
      expect(activatedModule.status).toBe(200);
      expect(activatedModuleBody.result.status).toBe('proposed');

      const response = await fetch(`http://127.0.0.1:${mirrorAddress.port}/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'Rose connection under midnight reflection' })
      });
      const result = await response.json() as {
        evaluation: { boundary: { semanticMutationAllowed: boolean } };
        translation: { source: string; climateName: string };
        persisted: { status: string };
      };

      expect(response.status).toBe(200);
      expect(result.persisted.status).toBe('recorded');
      expect(result.evaluation.boundary.semanticMutationAllowed).toBe(false);
      expect(result.translation.source).toBe('codex_graph');
      expect(result.translation.climateName).toBe('Midnight · midnight');
      expect(receivedEvaluation).toBeDefined();
    } finally {
      await close(mirror);
      await service.stop();
      await close(codex);
      await close(alignmentModel);
      await close(localModel);
    }
  });
});

function listen(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
}

function close(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}
