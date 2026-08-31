import { describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { MirrorRuntime } from '../MirrorRuntime';
import { MirrorRuntimeService } from '../services/mirror-runtime.service';
import { createMirrorHttpServer } from '../http';

describe('Community Garden vertical slice', () => {
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
    let receivedResearchItem: Record<string, any> | undefined;
    const conversationEvents: Array<Record<string, any>> = [];
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
        const conversationalContent = receivedLocalContext?.userEnglish === 'yes i would. something gothic'
          ? receivedLocalContext?.repair?.required === true
            ? 'Start with Frankenstein by Mary Shelley, then try Dracula by Bram Stoker.'
            : 'ARI: "Yes, I would. Something gothic."'
          : 'Reflection is moving as an open climate.';
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          model: 'qwen3:4b-instruct',
          message: { content: body.format ? JSON.stringify({
            sourceIndex: 1, targetIndex: 2, relationshipType: 'moves_toward',
            evidence: 'The unresolved phrase places both grounded labels together.',
            counterexample: 'Reject when reviewed uses consistently separate Amber from Glow.',
            confidence: 'low'
          }) : conversationalContent },
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
      if (request.url === '/api/v1/ari/foundation') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          foundation: {
            version: 'ari-foundation.v1', status: 'active',
            identity: { name: 'ARI', expandedName: 'Accountable Relational Intelligence', domain: 'Community Garden' },
            roles: { qwen: 'Qwen supplies candidate words and outside information. Qwen is not ARI.' },
            operationalLoop: ['preserve', 'remember', 'consult', 'encode', 'sort', 'translate'],
            theoryOfAlignment: { meaningRule: 'relation before isolated labels' },
            cultivation: { method: 'objective_based_reviewed_cultivation' },
            authority: { sharedKnowledge: 'governed' },
            responseContract: { speakAs: 'ARI' },
            provenance: { source: 'reviewed_codex_cultivation' },
            boundary: { qwenIsIdentity: false, automaticTranscriptTrainingAllowed: false, sharedGraphMutationAllowed: false }
          }
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
      if (request.url === '/api/v1/foundation/brigde/build') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          version: 'brigde-foundation.v2',
          name: 'BRIGDE',
          acronym: [
            { letter: 'B', word: 'Buildable' }, { letter: 'R', word: 'Reusable' },
            { letter: 'I', word: 'Independent' }, { letter: 'G', word: 'Grouped' },
            { letter: 'D', word: 'Dots' }, { letter: 'E', word: 'Enterconnected' }
          ],
          counts: { groups: 2, occurrences: 3, bridges: 2, reusableGroups: 1, cells: 24, dots: 144 },
          groups: [{ id: 'w1', reusable: true }, { id: 'w2', reusable: false }],
          occurrences: [{ id: 'o1', groupId: 'w1' }, { id: 'o2', groupId: 'w1' }, { id: 'o3', groupId: 'w2' }],
          bridges: [{ id: 'b1', fromOccurrenceId: 'o1', toOccurrenceId: 'o2' }, { id: 'b2', fromOccurrenceId: 'o2', toOccurrenceId: 'o3' }],
          boundary: { mode: 'structure_only', bridgeCreatesMeaning: false, graphMutationAllowed: false }
        }));
        return;
      }
      if (request.url === '/api/v1/foundation/acronyms/expand') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          version: 'acronym-graph.v1',
          growth: { openEnded: true, terminal: false },
          degreeOfVision: { permanentDepthLimit: null, nodesVisible: 1, edgesVisible: 0 },
          nodes: [{ id: 'word:cat', word: 'CAT', isAcronym: true, slots: [] }],
          edges: [],
          frontier: { awaitingDefinitions: ['CAT'], deferredByDegreeOfVision: [], pendingWords: ['CAT'] },
          continuation: { version: 'acronym-frontier.v1', available: true, pendingWords: ['CAT'], expandedWords: [], knownWords: ['cat'] },
          boundary: { expansionCreatesMeaning: false, graphMutationAllowed: false }
        }));
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
      if (request.url?.startsWith('/api/v1/research/search?') && request.method === 'GET') {
        expect(request.headers.authorization).toBe('Bearer signed-codex-token');
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          query: 'color atmosphere', sources: ['wikipedia', 'crossref'], cached: false, warnings: [],
          suggestions: { strength: 'weak', graphMatches: [{ id: 'mist', label: 'Mist', type: 'environment_term', score: 1 }], boundary: 'Suggestions are leads only.' },
          results: [{
            externalId: 'wikipedia:1', title: 'Atmospheric colour', sourceName: 'Wikipedia', sourceType: 'encyclopedic',
            url: 'https://en.wikipedia.org/?curid=1', excerpt: 'A bounded source excerpt.', publishedAt: null,
            boundary: 'Orientation only; verify contested claims.'
          }]
        }));
        return;
      }
      if (request.url === '/api/v1/research/items' && request.method === 'POST') {
        expect(request.headers.authorization).toBe('Bearer signed-codex-token');
        receivedResearchItem = body;
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ item: { id: 'research-1', ...body, source_name: body.sourceName, source_url: body.sourceUrl, status: 'proposed' } }));
        return;
      }
      if (request.url === '/api/v1/research/items' && request.method === 'GET') {
        expect(request.headers.authorization).toBe('Bearer signed-codex-token');
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ items: [{
          id: 'research-1', query: 'color atmosphere', title: 'Atmospheric colour', source_name: 'Wikipedia',
          source_url: 'https://en.wikipedia.org/?curid=1', excerpt: 'A bounded source excerpt.', boundary: 'Orientation only.',
          counterexample: null, confidence: 'low', status: 'proposed'
        }], count: 1 }));
        return;
      }
      if (request.url === '/api/v1/research/items/research-1/review' && request.method === 'PATCH') {
        expect(request.headers.authorization).toBe('Bearer signed-codex-token');
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ item: { id: 'research-1', status: body.decision, review_note: body.reviewNote } }));
        return;
      }
      if (request.url === '/api/v1/research/items/research-1/graph-proposal' && request.method === 'POST') {
        expect(request.headers.authorization).toBe('Bearer signed-codex-token');
        expect(body.claim).toBe('Atmospheric colour is relevant background for the proposed theme.');
        expect(body.counterexample).toContain('unrelated optical context');
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ proposalId: 'proposal-research-1', status: 'proposed' }));
        return;
      }
      if (request.url === '/api/v1/auth/login') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ token: 'signed-codex-token', user: { id: 'learner', username: 'learner', role: 'admin' } }));
        return;
      }
      if (request.url === '/api/v1/auth/signup' && request.method === 'POST') {
        expect(body).toEqual({ username: 'new-gardener', email: 'new@example.com', password: 'Example2026' });
        response.writeHead(202, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ message: 'Check your email to verify the account.' }));
        return;
      }
      if (request.url === '/api/v1/auth/verify-email' && request.method === 'POST') {
        expect(body).toEqual({ token: 'single-use-token' });
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ verified: true }));
        return;
      }
      if (request.url === '/api/v1/auth/me' && request.method === 'GET') {
        expect(request.headers.authorization).toBe('Bearer signed-codex-token');
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ user: { id: 'learner', username: 'learner', role: 'admin' } }));
        return;
      }
      if (request.url === '/api/v1/auth/change-password' && request.method === 'POST') {
        expect(request.headers.authorization).toBe('Bearer signed-codex-token');
        expect(body).toEqual({ currentPassword: 'Example2026', newPassword: 'Replacement2026' });
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ token: 'refreshed-codex-token', user: { id: 'learner', username: 'learner', role: 'admin', must_change_password: false } }));
        return;
      }
      if (request.url?.startsWith('/api/v1/conversation-memory/context') && request.method === 'GET') {
        expect(request.headers.authorization).toBe('Bearer signed-codex-token');
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          version: 'private-conversation-memory.v1', events: conversationEvents.slice(-24),
          eventCount: conversationEvents.length, throughSequence: conversationEvents.at(-1)?.sequence || null,
          truncated: false,
          developmentalArchive: {
            version: 'private-developmental-archive.v1', consulted: true, source: 'codex_history',
            selection: 'exact_lexical_relevance',
            events: [
              { sourceThreadId: 'codex-thread-1', sourceEventId: 'codex-user-1', speaker: 'You', role: 'user', content: 'personal context developed in Codex', createdAt: '2026-08-01T00:00:00Z', relevance: 1 },
              { sourceThreadId: 'codex-thread-1', sourceEventId: 'codex-assistant-1', speaker: 'Codex', role: 'assistant_reference', content: 'Codex response remains attributed.', createdAt: '2026-08-01T00:00:01Z', relevance: 1 }
            ],
            boundary: { codexSpeechBecomesAriSpeech: false, automaticModelTrainingAllowed: false }
          },
          branch: {
            version: 'personal-ari-branch.v1', branchId: 'ari_testbranch0001', scope: 'authenticated_person_only',
            absorption: { personObservationCount: conversationEvents.filter(event => event.role === 'user').length, ariResponseCount: conversationEvents.filter(event => event.role === 'assistant').length, contextWindowObservationCount: 1, latestMove: 'continuation' },
            adaptation: { mode: 'conversation_context_not_model_training', expressionPacing: 'concise', recentMoves: ['continuation'] },
            boundary: { crossPersonAccessAllowed: false, sharedGraphMutationAllowed: false, automaticModelTrainingAllowed: false, contextualAdaptationAllowed: true }
          },
          boundary: { sharedGraphMutationAllowed: false }
        }));
        return;
      }
      if (request.url === '/api/v1/conversation-memory/events' && request.method === 'POST') {
        expect(request.headers.authorization).toBe('Bearer signed-codex-token');
        const event = {
          sequence: conversationEvents.length + 1, interactionId: body.interactionId,
          role: body.role, content: body.content, metadata: body.metadata || {}, createdAt: new Date().toISOString()
        };
        conversationEvents.push(event);
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ event, idempotent: false, boundary: { sharedGraphMutationAllowed: false } }));
        return;
      }
      if (request.url?.startsWith('/api/v1/conversation-memory/transcript') && request.method === 'GET') {
        expect(request.headers.authorization).toBe('Bearer signed-codex-token');
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ events: conversationEvents, count: conversationEvents.length, hasMore: false, nextBefore: null }));
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
      if (request.url === '/api/v1/local-ai/user-graph/relationships' && request.method === 'POST') {
        expect(request.headers.authorization).toBe('Bearer signed-codex-token');
        expect(body.confirmed).toBe(true);
        expect(body.associations[0]).toEqual(expect.objectContaining({ source: 'Flow', target: 'Grey' }));
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          sourceLayer: 'user_graph',
          relationships: [{
            id: 'personal-flow-grey', source: 'Flow', target: 'Grey', relationshipType: 'color_association',
            confidence: 'high', evidence: 'Profile owner placement.', counterexample: 'The owner may revise it.',
            mutationSource: 'user_directed', approvedByUser: 'learner-1', reviewNote: 'Explicitly approved.',
            sourceLayer: 'user_graph'
          }],
          relationshipCount: 1,
          boundary: { personalGraphMutated: true, profileOwnerConfirmed: true, sharedGraphMutationAllowed: false }
        }));
        return;
      }
      if (request.url === '/api/v1/local-ai/user-graph' && request.method === 'POST') {
        expect(request.headers.authorization).toBe('Bearer signed-codex-token');
        expect(typeof body.text).toBe('string');
        expect(body.text.length).toBeGreaterThan(0);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ sourceLayer: 'user_graph', consulted: true, relationships: [], relationshipCount: 0, truncated: false }));
        return;
      }
      if (request.url === '/api/v1/local-ai/user-graph' && request.method === 'GET') {
        expect(request.headers.authorization).toBe('Bearer signed-codex-token');
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          sourceLayer: 'user_graph',
          consulted: true,
          relationships: [{
            id: 'personal-route-1', source: 'mist', target: 'revision', relationshipType: 'personal_association',
            confidence: 'medium', evidence: 'Reviewed personal observation.', counterexample: 'Not every revision begins in mist.',
            sourceFeedbackId: 'private-feedback-id'
          }],
          relationshipCount: 1,
          truncated: false
        }));
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

      if (request.url === '/api/v1/analytics/events') {
        expect(request.headers.authorization).toBe('Bearer test-service-token');
        expect(Array.isArray(body.events)).toBe(true);
        expect(body).not.toHaveProperty('input');
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ recorded: body.events.length, contentStored: false }));
        return;
      }

      if (request.url === '/api/v1/analytics/summary') {
        expect(request.headers.authorization).toBe('Bearer signed-codex-token');
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          version: 'garden-analytics.v1', window: { label: 'Last 24 hours' },
          humanActivity: {}, cultivations: {}, rooms: [], servicePerformance: [], errors: [],
          feedback: {}, returning: {}, personalGrowth: {}, privacy: { messageContentStored: false }
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
      expect(shellResponse.headers.get('permissions-policy')).toBe('camera=(), microphone=(self), geolocation=()');
      expect(shellResponse.headers.get('set-cookie')).toContain('garden_visitor=');
      expect(shell).toContain('Community Garden');
      expect(shell).toContain('id="garden"');
      expect(shell).toContain('Garden Entrance');
      expect(shell).toContain('Plant a seed of information.');
      expect(shell).toContain('id="gardenEntranceForm"');
      expect(shell).toContain('id="gardenSeed" maxlength="10000"');
      expect(shell).toContain("mirrorFetch('/garden/fruit', { input })");
      expect(shell).toContain('The knowledge cultivation loop');
      expect(shell).toContain('Personal plot');
      expect(shell).toContain('Community soil');
      expect(shell).toContain('data-garden-room="research"');
      expect(shell).toContain('data-garden-room="account"');
      expect(shell).toContain('data-garden-room="analytics"');
      expect(shell).toContain('Refresh Garden analytics');
      expect(shell).toContain('Outside weather');
      expect(shell).toContain('Inside growth');
      expect(shell).toContain('Message content stored');
      expect(shell).toContain('Open Account sign-in');
      expect(shell).toContain('id="accountIdentity"');
      expect(shell).toContain("window.location.hostname === '127.0.0.1'");
      expect(shell).toContain('Research / external reference library');
      expect(shell).toContain('Save reference');
      expect(shell).not.toContain('What observation would weaken or disprove using this source here?');
      expect(shell).toContain('External-reference boundary');
      expect(shell).toContain('data-garden-room="localAi"');
      expect(shell).toContain('function activateGardenRoom()');
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
      expect(shell).toContain('ARI / relational translator');
      expect(shell).toContain('ARI mathematical order');
      expect(shell).toContain('id="localAiInput" rows="4" maxlength="10000"');
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
      expect(shell).toContain('id="translateMicButton"');

      const roomVisit = await fetch(`http://127.0.0.1:${mirrorAddress.port}/analytics/visit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ room: 'analytics' })
      });
      expect(roomVisit.status).toBe(202);
      expect(shell).toContain('id="localAiMicButton"');
      expect(shell).toContain('navigator.mediaDevices.getUserMedia');
      expect(shell).toContain('window.SpeechRecognition || window.webkitSpeechRecognition');
      expect(shell).toContain('Community Garden does not store raw audio; speech recognition is handled by your browser.');
      expect(shell).toContain('mirror-platform.microphone-always-on');
      expect(shell).toContain('Turn microphone off');
      expect(shell).toContain('handleAlwaysOnRecognitionEnd');
      expect(shell).toContain('startAlwaysOnMicrophone(config, { skipPermissionCheck: true })');

      const health = await fetch(`http://127.0.0.1:${mirrorAddress.port}/health`);
      const healthBody = await health.json() as {
        localModel: { status: string; model: string };
        alignmentModel: { status: string; validation: { exactMatches: number } };
      };
      expect(healthBody.localModel.status).toBe('ready');
      expect(healthBody.localModel.model).toBe('qwen3:4b-instruct');
      expect(healthBody.alignmentModel.status).toBe('ready');
      expect(healthBody.alignmentModel.validation.exactMatches).toBe(38);

      const gardenIdentity = await fetch(`http://127.0.0.1:${mirrorAddress.port}/garden/identity`);
      const gardenIdentityBody = await gardenIdentity.json() as {
        version: string;
        name: string;
        purpose: string;
        technicalPerson: { name: string; role: string; languageEngine: string; foundation: string; toolRegistry: string };
        protectedRoots: string[];
        boundary: { graphMutationAllowed: boolean };
      };
      expect(gardenIdentity.status).toBe(200);
      expect(gardenIdentityBody.version).toBe('garden-entrance.v1');
      expect(gardenIdentityBody.name).toBe('Community Garden');
      expect(gardenIdentityBody.purpose).toContain('grow useful fruit for people');
      expect(gardenIdentityBody.technicalPerson).toEqual({
        name: 'ARI', role: 'relational translator', languageEngine: 'Qwen',
        foundation: '/api/v1/ari/foundation', toolRegistry: '/api/v1/ari/tools'
      });
      expect(gardenIdentityBody.protectedRoots).toContain('service credentials');
      expect(gardenIdentityBody.boundary.graphMutationAllowed).toBe(false);

      const ariFoundation = await fetch(`http://127.0.0.1:${mirrorAddress.port}/api/v1/ari/foundation`);
      const ariFoundationBody = await ariFoundation.json() as {
        foundation: { version: string; identity: { name: string }; boundary: { qwenIsIdentity: boolean } };
        boundary: { automaticLearningAllowed: boolean };
      };
      expect(ariFoundation.status).toBe(200);
      expect(ariFoundationBody.foundation.version).toBe('ari-foundation.v1');
      expect(ariFoundationBody.foundation.identity.name).toBe('ARI');
      expect(ariFoundationBody.foundation.boundary.qwenIsIdentity).toBe(false);
      expect(ariFoundationBody.boundary.automaticLearningAllowed).toBe(false);

      const ariTools = await fetch(`http://127.0.0.1:${mirrorAddress.port}/api/v1/ari/tools`);
      const ariToolsBody = await ariTools.json() as {
        version: string;
        coordinator: string;
        team: Array<{ id: string; coordinator: boolean }>;
        tools: Array<{ id: string; owner: string; status: string; permissions: { writes: string[] } }>;
        boundary: { sharedGraphMutationAllowed: boolean };
      };
      expect(ariTools.status).toBe(200);
      expect(ariToolsBody.version).toBe('ari-tool-registry.v1');
      expect(ariToolsBody.coordinator).toBe('ARI');
      expect(ariToolsBody.team.filter(member => member.coordinator).map(member => member.id)).toEqual(['ARI']);
      expect(ariToolsBody.tools.find(tool => tool.id === 'fen.trace-language')?.status).toBe('ready');
      expect(ariToolsBody.tools.find(tool => tool.id === 'aura.capture-speech')?.status).toBe('client_managed');
      expect(ariToolsBody.tools.find(tool => tool.id === 'cara.place-personal-relationship')?.permissions.writes).toEqual(['personal_graph']);
      expect(ariToolsBody.boundary.sharedGraphMutationAllowed).toBe(false);

      const untrustedGardenMutation = await fetch(`http://127.0.0.1:${mirrorAddress.port}/garden/fruit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'A visitor seed' })
      });
      expect(untrustedGardenMutation.status).toBe(403);

      const gardenFruit = await fetch(`http://127.0.0.1:${mirrorAddress.port}/garden/fruit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ input: 'A visitor seed' })
      });
      const gardenFruitBody = await gardenFruit.json() as {
        version: string;
        seed: { received: boolean; codePointCount: number };
        fruit: { type: string; language: string; text: string };
        cultivation: { translator: { name: string; languageEngine: string; foundationVersion: string }; personalContextConsulted: boolean; persisted: boolean; sharedGraphMutated: boolean };
        boundary: { mode: string; graphMutationAllowed: boolean };
        model?: unknown;
        trace?: unknown;
        feedback?: unknown;
        evidence?: unknown;
        timings?: unknown;
      };
      expect(gardenFruit.status).toBe(200);
      expect(gardenFruit.headers.get('ratelimit-limit')).toBe('20');
      expect(gardenFruitBody.seed).toEqual({ received: true, codePointCount: 14 });
      expect(gardenFruitBody.fruit).toEqual({
        type: 'cultivated_response',
        language: 'english',
        text: 'Reflection is moving as an open climate.'
      });
      expect(gardenFruitBody.cultivation.translator).toEqual(expect.objectContaining({
        name: 'ARI', languageEngine: 'Qwen', foundationVersion: 'ari-foundation.v1'
      }));
      expect(gardenFruitBody.cultivation).toEqual(expect.objectContaining({
        personalContextConsulted: false,
        persisted: false,
        sharedGraphMutated: false
      }));
      expect(gardenFruitBody.boundary).toEqual(expect.objectContaining({ mode: 'public_fruit_read_only', graphMutationAllowed: false }));
      expect(gardenFruitBody).not.toHaveProperty('model');
      expect(gardenFruitBody).not.toHaveProperty('trace');
      expect(gardenFruitBody).not.toHaveProperty('feedback');
      expect(gardenFruitBody).not.toHaveProperty('evidence');
      expect(gardenFruitBody).not.toHaveProperty('timings');
      expect(gardenFruitBody).not.toHaveProperty('team');

      const oversizedGardenFruit = await fetch(`http://127.0.0.1:${mirrorAddress.port}/garden/fruit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ input: 'a'.repeat(10_001) })
      });
      const oversizedGardenFruitBody = await oversizedGardenFruit.json() as { error: string };
      expect(oversizedGardenFruit.status).toBe(413);
      expect(oversizedGardenFruitBody.error).toContain('10000 Unicode code points');

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
          ariFoundation: { consulted: boolean; version: string; source: string };
          qwenCandidateTranslation: { roundTripExact: boolean; mathematicalOrder: Array<{ originalPosition: number; value: number }> };
        };
        translator: { name: string; domain: string; foundationVersion: string };
        team: {
          registryVersion: string;
          coordinator: string;
          participatingMembers: string[];
          receipts: Array<{
            version: string; teamMember: string; status: string; objective: string;
            access: { readScopes: string[]; writeScopes: string[] };
            boundary: { sharedGraphMutationAllowed: boolean };
          }>;
        };
        boundary: { semanticMutationAllowed: boolean };
      };
      expect(localAi.status).toBe(200);
      expect(localAiBody.model).toEqual({ provider: 'ollama', name: 'qwen3:4b-instruct', local: true });
      expect(localAiBody.translator).toEqual(expect.objectContaining({
        name: 'ARI', domain: 'Community Garden', foundationVersion: 'ari-foundation.v1'
      }));
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
      expect(localAiBody.trace.ariFoundation).toEqual({
        consulted: true,
        version: 'ari-foundation.v1',
        status: 'active',
        source: 'reviewed_codex_cultivation'
      });
      expect(localAiBody.trace.qwenCandidateTranslation).toEqual(expect.objectContaining({
        roundTripExact: true,
        mathematicalOrder: [{ originalPosition: 1, value: 32 }]
      }));
      expect(localAiBody.relationalEvidence).toEqual(expect.objectContaining({
        matchedNodeCount: 1,
        confirmedRouteCount: 0,
        relationshipClaimsSupported: false
      }));
      expect(localAiBody.relationalEvidence.notice).toContain('no relationship is established');
      expect(localAiBody.team.registryVersion).toBe('ari-tool-registry.v1');
      expect(localAiBody.team.coordinator).toBe('ARI');
      expect(localAiBody.team.participatingMembers).toEqual(['LEA', 'FEN', 'CARA', 'CORA', 'VERA']);
      expect(localAiBody.team.receipts.map(receipt => receipt.toolId)).toEqual([
        'lea.compose-candidate-language',
        'fen.trace-language',
        'cara.read-relational-graph',
        'cora.compare-ordered-language',
        'vera.verify-relational-boundary',
        'vera.validate-candidate-language',
        'fen.trace-language'
      ]);
      expect(localAiBody.team.receipts).toHaveLength(7);
      expect(localAiBody.team.receipts.every(receipt => receipt.status === 'completed')).toBe(true);
      expect(localAiBody.team.receipts.every(receipt => receipt.boundary.sharedGraphMutationAllowed === false)).toBe(true);
      expect(JSON.stringify(localAiBody.team.receipts)).not.toContain('Amber Glow');
      expect(JSON.stringify(localAiBody.team.receipts)).not.toContain('Reflection is moving as an open climate.');
      expect(localAiBody.boundary.semanticMutationAllowed).toBe(false);
      expect(localAiBody.feedback.eligible).toBe(true);
      expect(localAiBody.feedback.receipt.signature.length).toBeGreaterThan(20);
      expect(localAiBody.feedback.boundary).toEqual(expect.objectContaining({
        trainingStarted: false,
        modelWeightsChanged: false,
        activeAdapterChanged: false
      }));
      expect(localAiBody.trace.responsePipeline).toEqual(expect.objectContaining({
        version: 'open-expression-closed-validation.v1',
        expressionStage: 'qwen_open_candidate',
        validationStage: 'ari_closed_garden_gate',
        validationStatus: 'accepted',
        repaired: false
      }));
      expect(localAiBody.boundary.mode).toBe('open_expression_then_closed_garden_validation');
      expect(receivedLocalContext?.userEnglish).toBe('Amber Glow');
      expect(receivedLocalContext?.outputContract).toEqual(expect.objectContaining({
        composeBeforeValidation: true,
        repeatPersonStatementByDefault: false,
        askAlreadyAnsweredQuestion: false,
        advanceAnsweredTurn: true
      }));
      expect(receivedLocalContext).not.toHaveProperty('signal');
      expect(receivedLocalContext).not.toHaveProperty('relationships');
      expect(receivedLocalContext).not.toHaveProperty('learnedAlignment');
      expect(receivedLocalContext).not.toHaveProperty('ariFoundation');
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

      const bridge = await fetch(`http://127.0.0.1:${mirrorAddress.port}/foundation/brigde/build`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ text: 'CAT cat BAT' })
      });
      const bridgeBody = await bridge.json() as {
        name: string;
        counts: { groups: number; bridges: number };
        boundary: { bridgeCreatesMeaning: boolean; graphMutationAllowed: boolean };
      };
      expect(bridge.status).toBe(200);
      expect(bridgeBody.name).toBe('BRIGDE');
      expect(bridgeBody.counts).toEqual(expect.objectContaining({ groups: 2, bridges: 2 }));
      expect(bridgeBody.boundary.bridgeCreatesMeaning).toBe(false);
      expect(bridgeBody.boundary.graphMutationAllowed).toBe(false);

      const acronym = await fetch(`http://127.0.0.1:${mirrorAddress.port}/foundation/acronyms/expand`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ roots: ['CAT'] })
      });
      const acronymBody = await acronym.json() as {
        growth: { openEnded: boolean; terminal: boolean };
        degreeOfVision: { permanentDepthLimit: null };
        continuation: { available: boolean };
        boundary: { expansionCreatesMeaning: boolean; graphMutationAllowed: boolean };
      };
      expect(acronym.status).toBe(200);
      expect(acronymBody.growth).toEqual({ openEnded: true, terminal: false });
      expect(acronymBody.degreeOfVision.permanentDepthLimit).toBeNull();
      expect(acronymBody.continuation.available).toBe(true);
      expect(acronymBody.boundary.expansionCreatesMeaning).toBe(false);
      expect(acronymBody.boundary.graphMutationAllowed).toBe(false);

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

      const gardenApiCatalog = await fetch(`http://127.0.0.1:${mirrorAddress.port}/api/v1`);
      const gardenApiCatalogBody = await gardenApiCatalog.json() as Record<string, any>;
      expect(gardenApiCatalog.status).toBe(200);
      expect(gardenApiCatalogBody.entrances.person.cultivate).toBe('/api/v1/me/cultivate');
      expect(gardenApiCatalogBody.entrances.person.garden).toBe('/api/v1/me/garden');
      expect(gardenApiCatalogBody.entrances.person.placeRelationships).toBe('/api/v1/me/garden/relationships');
      expect(gardenApiCatalogBody.entrances.person.transcript).toBe('/api/v1/me/transcript');
      expect(gardenApiCatalogBody.entrances.person.createAccount).toBe('/api/v1/me/account');
      expect(gardenApiCatalogBody.entrances.people.cultivate).toBe('/api/v1/community/cultivate');

      const createdAccount = await fetch(`http://127.0.0.1:${mirrorAddress.port}/api/v1/me/account`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ username: 'new-gardener', email: 'new@example.com', password: 'Example2026' })
      });
      expect(createdAccount.status).toBe(202);
      expect(await createdAccount.json()).toEqual({ message: 'Check your email to verify the account.' });

      const verifiedAccount = await fetch(`http://127.0.0.1:${mirrorAddress.port}/api/v1/me/account/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ token: 'single-use-token' })
      });
      expect(verifiedAccount.status).toBe(200);
      expect(await verifiedAccount.json()).toEqual({ verified: true });

      const anonymousPersonalApi = await fetch(`http://127.0.0.1:${mirrorAddress.port}/api/v1/me/cultivate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
        body: JSON.stringify({ input: 'private seed' })
      });
      expect(anonymousPersonalApi.status).toBe(401);

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

      const personalSession = await fetch(`http://127.0.0.1:${mirrorAddress.port}/api/v1/me/session`, {
        headers: { cookie: session! }
      });
      const personalSessionBody = await personalSession.json() as Record<string, any>;
      expect(personalSession.status).toBe(200);
      expect(personalSessionBody.user.username).toBe('learner');

      const analyticsSummary = await fetch(`http://127.0.0.1:${mirrorAddress.port}/analytics/summary`, {
        headers: { cookie: session! }
      });
      const analyticsSummaryBody = await analyticsSummary.json() as Record<string, any>;
      expect(analyticsSummary.status).toBe(200);
      expect(analyticsSummaryBody.outsideWeather.status).toBe('not_configured');
      expect(analyticsSummaryBody.outsideWeather.privacy.rawIpQueried).toBe(false);

      const communityCultivation = await fetch(`http://127.0.0.1:${mirrorAddress.port}/api/v1/community/cultivate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin', cookie: session! },
        body: JSON.stringify({ input: 'community seed' })
      });
      const communityCultivationBody = await communityCultivation.json() as Record<string, any>;
      expect(communityCultivation.status).toBe(200);
      expect(communityCultivationBody.cultivation.personalContextConsulted).toBe(false);
      expect(communityCultivationBody.cultivation.persisted).toBe(false);
      expect(communityCultivationBody.cultivation.sharedGraphMutated).toBe(false);
      expect(communityCultivationBody.boundary.mode).toBe('community_api_read_only');

      conversationEvents.push({
        sequence: 1, interactionId: 'prior-personal-observation', role: 'user',
        content: 'personal comparison seed', metadata: {}, createdAt: new Date().toISOString()
      });
      const personalCultivation = await fetch(`http://127.0.0.1:${mirrorAddress.port}/api/v1/me/cultivate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin', cookie: session! },
        body: JSON.stringify({ input: 'personal seed' })
      });
      const personalCultivationBody = await personalCultivation.json() as Record<string, any>;
      expect(personalCultivation.status).toBe(200);
      expect(personalCultivationBody.cultivation.personalContextConsulted).toBe(true);
      expect(personalCultivationBody.cultivation.persisted).toBe(true);
      expect(personalCultivationBody.cultivation.persistenceLayer).toBe('private_conversation_transcript');
      expect(personalCultivationBody.cultivation.sharedGraphMutated).toBe(false);
      expect(personalCultivationBody.ariBranch).toEqual(expect.objectContaining({
        version: 'personal-ari-branch.v1', scope: 'authenticated_person_only'
      }));
      expect(personalCultivationBody.ariBranch.absorption.currentMove).toBe('brief_statement');
      expect(personalCultivationBody.ariBranch.boundary).toEqual(expect.objectContaining({
        crossPersonAccessAllowed: false, automaticModelTrainingAllowed: false, contextualAdaptationAllowed: true
      }));
      expect(personalCultivationBody.comparisonReceipt).toEqual(expect.objectContaining({
        version: 'ari-comparison.v1', operation: 'bounded_structural_comparison'
      }));
      expect(personalCultivationBody.comparisonReceipt.comparisons[0]).toEqual(expect.objectContaining({
        observationSequence: 1, sharedTokens: expect.arrayContaining(['personal', 'seed'])
      }));
      expect(personalCultivationBody.comparisonReceipt.boundary).toEqual(expect.objectContaining({
        comparisonCreatesMeaning: false, graphMutationAllowed: false, automaticLearningAllowed: false
      }));
      expect(personalCultivationBody.boundary.crossPersonAccessAllowed).toBe(false);
      expect(receivedLocalContext?.conversationMove).toBe('brief_statement');
      expect(receivedLocalContext?.outputContract).toEqual(expect.objectContaining({
        output: 'ari_spoken_reply_only', composeBeforeValidation: true, includeReceipt: false
      }));
      expect(receivedLocalContext).not.toHaveProperty('comparisonLedger');
      expect(receivedLocalContext?.personalAriBranch).toEqual(expect.objectContaining({
        version: 'personal-ari-branch.v1', scope: 'authenticated_person_only'
      }));
      expect(receivedLocalContext?.developmentalHistory).toEqual(expect.objectContaining({
        version: 'private-developmental-archive.v1', consulted: true, source: 'codex_history'
      }));
      expect(receivedLocalContext?.developmentalHistory.events.map((event: Record<string, any>) => event.speaker)).toEqual(['You', 'Codex']);
      expect(receivedLocalContext?.developmentalHistory.boundary.codexSpeechBecomesAriSpeech).toBe(false);

      const personalTranscript = await fetch(`http://127.0.0.1:${mirrorAddress.port}/api/v1/me/transcript`, {
        headers: { cookie: session! }
      });
      const personalTranscriptBody = await personalTranscript.json() as Record<string, any>;
      expect(personalTranscript.status).toBe(200);
      expect(personalTranscriptBody.transcript.events.slice(-2).map((event: Record<string, any>) => event.role)).toEqual(['user', 'assistant']);
      expect(personalTranscriptBody.transcript.events.at(-1).comparison).toEqual(expect.objectContaining({
        version: 'ari-comparison.v1', comparedObservationSequences: [1], graphMutationAllowed: false
      }));
      expect(personalTranscriptBody.boundary.crossPersonAccessAllowed).toBe(false);

      const repairedCultivation = await fetch(`http://127.0.0.1:${mirrorAddress.port}/api/v1/me/cultivate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin', cookie: session! },
        body: JSON.stringify({ input: 'yes i would. something gothic' })
      });
      const repairedCultivationBody = await repairedCultivation.json() as Record<string, any>;
      expect(repairedCultivation.status).toBe(200);
      expect(repairedCultivationBody.fruit.text).toContain('Frankenstein');
      expect(repairedCultivationBody.fruit.text).not.toContain('ARI:');
      expect(repairedCultivationBody.cultivation.responsePipeline).toEqual(expect.objectContaining({
        expressionStage: 'qwen_open_candidate',
        validationStage: 'ari_closed_garden_gate',
        validationStatus: 'accepted',
        repaired: true
      }));

      const personalGarden = await fetch(`http://127.0.0.1:${mirrorAddress.port}/api/v1/me/garden`, {
        headers: { cookie: session! }
      });
      const personalGardenBody = await personalGarden.json() as Record<string, any>;
      expect(personalGarden.status).toBe(200);
      expect(personalGardenBody.garden.relationships[0]).toEqual(expect.objectContaining({
        id: 'personal-route-1', source: 'mist', target: 'revision'
      }));
      expect(personalGardenBody.garden.relationships[0]).not.toHaveProperty('sourceFeedbackId');
      expect(personalGardenBody.boundary.crossPersonAccessAllowed).toBe(false);

      const personalPlacement = await fetch(`http://127.0.0.1:${mirrorAddress.port}/api/v1/me/garden/relationships`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin', cookie: session! },
        body: JSON.stringify({
          confirmed: true,
          reviewNote: 'Explicitly approved.',
          associations: [{
            source: 'Flow', target: 'Grey', relationshipType: 'color_association', confidence: 'high',
            evidence: 'Profile owner placement.', counterexample: 'The owner may revise it.'
          }]
        })
      });
      const personalPlacementBody = await personalPlacement.json() as Record<string, any>;
      expect(personalPlacement.status).toBe(201);
      expect(personalPlacementBody.garden.relationships[0]).toEqual(expect.objectContaining({
        source: 'Flow', target: 'Grey', mutationSource: 'user_directed', profileOwnerConfirmed: true
      }));
      expect(personalPlacementBody.mutation).toEqual({ applied: true, profileOwnerConfirmed: true, relationshipCount: 1 });
      expect(personalPlacementBody.boundary).toEqual(expect.objectContaining({
        personalGraphMutated: true, sharedGraphMutationAllowed: false, colorAtlasMutationAllowed: false
      }));

      const changedPassword = await fetch(`http://127.0.0.1:${mirrorAddress.port}/account/change-password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin', cookie: session! },
        body: JSON.stringify({ currentPassword: 'Example2026', newPassword: 'Replacement2026' })
      });
      const changedPasswordBody = await changedPassword.json() as Record<string, unknown>;
      expect(changedPassword.status).toBe(200);
      expect(changedPassword.headers.get('set-cookie')).toContain('HttpOnly');
      expect(changedPassword.headers.get('set-cookie')).toContain('refreshed-codex-token');
      expect(changedPasswordBody.token).toBeUndefined();

      const researchSearch = await fetch(`http://127.0.0.1:${mirrorAddress.port}/research/search?q=color%20atmosphere&sources=wikipedia%2Ccrossref`, {
        headers: { cookie: session! }
      });
      const researchSearchBody = await researchSearch.json() as { results: Array<{ sourceName: string }>; suggestions: { strength: string } };
      expect(researchSearch.status).toBe(200);
      expect(researchSearchBody.results[0].sourceName).toBe('Wikipedia');
      expect(researchSearchBody.suggestions.strength).toBe('weak');

      const researchCandidate = await fetch(`http://127.0.0.1:${mirrorAddress.port}/research/items`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin', cookie: session! },
        body: JSON.stringify({
          query: 'color atmosphere', title: 'Atmospheric colour', sourceName: 'Wikipedia', sourceType: 'encyclopedic',
          sourceUrl: 'https://en.wikipedia.org/?curid=1', excerpt: 'A bounded source excerpt.',
          boundary: 'Orientation only; verify contested claims.'
        })
      });
      const researchCandidateBody = await researchCandidate.json() as { item: { status: string } };
      expect(researchCandidate.status).toBe(201);
      expect(researchCandidateBody.item.status).toBe('proposed');
      expect(receivedResearchItem?.counterexample).toBeUndefined();
      expect(receivedResearchItem?.status).toBeUndefined();
      expect(receivedResearchItem?.graphProposalId).toBeUndefined();

      const researchInbox = await fetch(`http://127.0.0.1:${mirrorAddress.port}/research/items`, { headers: { cookie: session! } });
      const researchInboxBody = await researchInbox.json() as { items: Array<{ status: string }> };
      expect(researchInbox.status).toBe(200);
      expect(researchInboxBody.items[0].status).toBe('proposed');

      const researchReview = await fetch(`http://127.0.0.1:${mirrorAddress.port}/research/items/research-1/review`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin', cookie: session! },
        body: JSON.stringify({ decision: 'approved', reviewNote: 'Reference provenance and scope reviewed.' })
      });
      const researchReviewBody = await researchReview.json() as { item: { status: string } };
      expect(researchReview.status).toBe(200);
      expect(researchReviewBody.item.status).toBe('approved');

      const researchProposal = await fetch(`http://127.0.0.1:${mirrorAddress.port}/research/items/research-1/graph-proposal`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin', cookie: session! },
        body: JSON.stringify({
          label: 'color atmosphere',
          claim: 'Atmospheric colour is relevant background for the proposed theme.',
          counterexample: 'Reject the claim when the reference addresses only an unrelated optical context.',
          nodeType: 'theme',
          family: null
        })
      });
      const researchProposalBody = await researchProposal.json() as { proposalId: string; status: string };
      expect(researchProposal.status).toBe(201);
      expect(researchProposalBody).toEqual({ proposalId: 'proposal-research-1', status: 'proposed' });

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
