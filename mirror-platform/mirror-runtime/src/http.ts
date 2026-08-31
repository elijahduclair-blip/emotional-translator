import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import crypto from 'node:crypto';
import { MirrorRuntimeService } from './services/mirror-runtime.service';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_FOUNDATION_BODY_BYTES = 64 * 1024;
const MAX_DOCUMENT_BODY_BYTES = 12 * 1024 * 1024;
const MAX_GARDEN_SEED_CODE_POINTS = 10_000;
const GARDEN_FRUIT_RATE_LIMIT = 20;
const GARDEN_FRUIT_RATE_WINDOW_MS = 60 * 1000;
const translatorPage = readFileSync(join(__dirname, '..', 'public', 'index.html'), 'utf8');

export function createMirrorHttpServer(service: MirrorRuntimeService) {
  const limitGardenFruit = createFixedWindowRateLimiter({
    name: 'garden fruit',
    maxRequests: GARDEN_FRUIT_RATE_LIMIT,
    windowMs: GARDEN_FRUIT_RATE_WINDOW_MS
  });

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://mirror.local');
      const path = url.pathname;
      if (request.method === 'GET' && path === '/') {
        const visitorCookies = analyticsCookies(request, false);
        if (visitorCookies.length) response.setHeader('set-cookie', visitorCookies);
        response.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          ...securityHeaders()
        });
        response.end(translatorPage);
        return;
      }

      if (request.method === 'GET' && path === '/health') {
        return sendJson(response, 200, await service.getHealth());
      }

      if (request.method === 'GET' && path === '/garden/identity') {
        return sendJson(response, 200, gardenIdentity());
      }

      if (request.method === 'GET' && path === '/api/v1/ari/foundation') {
        return sendJson(response, 200, ariFoundationView(await service.getRuntime().getAriFoundation()));
      }

      if (request.method === 'GET' && path === '/api/v1/ari/tools') {
        return sendJson(response, 200, service.getRuntime().getAriToolRegistry());
      }

      if (request.method === 'GET' && path === '/api/v1/me/ari/runtime') {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().ariRuntimeRequest('/v1/runtime', { ownerToken: token }));
      }

      const independentRuntimeControl = path.match(/^\/api\/v1\/me\/ari\/runtime\/(pause|resume|wake)$/);
      if (request.method === 'POST' && independentRuntimeControl) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().ariRuntimeRequest(`/v1/runtime/${independentRuntimeControl[1]}`, {
          method: 'POST', ownerToken: token
        }));
      }

      if (path === '/api/v1/me/ari/runtime/objectives' && request.method === 'GET') {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().ariRuntimeRequest('/v1/objectives', { ownerToken: token }));
      }

      if (path === '/api/v1/me/ari/runtime/objectives' && request.method === 'POST') {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().ariRuntimeRequest('/v1/objectives', {
          method: 'POST', body: await readJson(request, MAX_FOUNDATION_BODY_BYTES), ownerToken: token
        }));
      }

      const independentObjective = path.match(/^\/api\/v1\/me\/ari\/runtime\/objectives\/([^/]+)$/);
      if (independentObjective && request.method === 'GET') {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().ariRuntimeRequest(
          `/v1/objectives/${encodeURIComponent(decodeURIComponent(independentObjective[1]))}`, { ownerToken: token }
        ));
      }

      if (independentObjective && request.method === 'PATCH') {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().ariRuntimeRequest(
          `/v1/objectives/${encodeURIComponent(decodeURIComponent(independentObjective[1]))}`,
          { method: 'PATCH', body: await readJson(request), ownerToken: token }
        ));
      }

      if (request.method === 'GET' && path === '/api/v1/me/ari/autonomy/objectives') {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/ari/autonomy/objectives', { userToken: token }));
      }

      if (request.method === 'POST' && path === '/api/v1/me/ari/autonomy/objectives') {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        const body = await readJson(request, MAX_FOUNDATION_BODY_BYTES);
        if (body.run === false) {
          return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/ari/autonomy/objectives', {
            method: 'POST', body, userToken: token
          }));
        }
        const result = await service.getRuntime().runAriAutonomousObjective(body, token);
        return sendJson(response, 201, result);
      }

      const autonomyRunMatch = path.match(/^\/api\/v1\/me\/ari\/autonomy\/objectives\/([^/]+)\/run$/);
      if (request.method === 'POST' && autonomyRunMatch) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        const body = await readJson(request);
        return sendJson(response, 200, await service.getRuntime().runAriAutonomousObjective({
          ...body, objectiveId: decodeURIComponent(autonomyRunMatch[1])
        }, token));
      }

      const autonomyOutcomeMatch = path.match(/^\/api\/v1\/me\/ari\/autonomy\/objectives\/([^/]+)\/outcomes$/);
      if (request.method === 'POST' && autonomyOutcomeMatch) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(
          `/api/v1/ari/autonomy/objectives/${encodeURIComponent(decodeURIComponent(autonomyOutcomeMatch[1]))}/outcomes`,
          { method: 'POST', body: await readJson(request), userToken: token }
        ));
      }

      const autonomyRetryMatch = path.match(/^\/api\/v1\/me\/ari\/autonomy\/objectives\/([^/]+)\/retry$/);
      if (request.method === 'POST' && autonomyRetryMatch) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(
          `/api/v1/ari/autonomy/objectives/${encodeURIComponent(decodeURIComponent(autonomyRetryMatch[1]))}/retry`,
          { method: 'POST', body: await readJson(request), userToken: token }
        ));
      }

      const autonomyControlMatch = path.match(/^\/api\/v1\/me\/ari\/autonomy\/objectives\/([^/]+)$/);
      if (request.method === 'PATCH' && autonomyControlMatch) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(
          `/api/v1/ari/autonomy/objectives/${encodeURIComponent(decodeURIComponent(autonomyControlMatch[1]))}`,
          { method: 'PATCH', body: await readJson(request), userToken: token }
        ));
      }

      if (request.method === 'POST' && path === '/analytics/visit') {
        requireSameOriginMutation(request);
        const body = await readJson(request);
        const room = String(body.room || '');
        await service.getRuntime().recordRoomVisit(
          room,
          analyticsContext(request, analyticsEntrance(request, 'combined_shell')),
          optionalSession(request)
        );
        return sendJson(response, 202, { recorded: true, contentStored: false });
      }

      if (request.method === 'GET' && path === '/analytics/summary') {
        const token = requireSession(request);
        const insideGrowth = await service.getRuntime().codexRequest('/api/v1/analytics/summary', { userToken: token });
        if (insideGrowth.status >= 400) return proxyResult(response, insideGrowth);
        const outsideWeather = await service.getRuntime().getOutsideWeather(24);
        return sendJson(response, 200, { ...insideGrowth.body, outsideWeather });
      }

      if (request.method === 'POST' && path === '/garden/fruit') {
        requireSameOriginMutation(request);
        limitGardenFruit(request, response);
        const input = await readGardenInput(request);

        const session = optionalSession(request);
        const result = await service.getRuntime().respondWithLocalModel(
          { input },
          session,
          analyticsContext(request, analyticsEntrance(request, 'combined_shell'))
        );
        if (result.status >= 400) return proxyResult(response, result);
        return sendJson(response, 200, publicGardenFruit(input, result.body, Boolean(session)));
      }

      if (request.method === 'GET' && path === '/api/v1') {
        return sendJson(response, 200, gardenApiIdentity());
      }

      if (request.method === 'POST' && path === '/api/v1/community/cultivate') {
        requireSameOriginMutation(request);
        limitGardenFruit(request, response);
        const input = await readGardenInput(request);
        const result = await service.getRuntime().respondWithLocalModel(
          { input },
          undefined,
          analyticsContext(request, 'community_api')
        );
        if (result.status >= 400) return proxyResult(response, result);
        return sendJson(response, 200, communityApiFruit(input, result.body));
      }

      if (request.method === 'POST' && path === '/api/v1/me/cultivate') {
        requireSameOriginMutation(request);
        limitGardenFruit(request, response);
        const token = requireSession(request);
        const input = await readGardenInput(request);
        const result = await service.getRuntime().respondWithLocalModel(
          { input },
          token,
          analyticsContext(request, 'personal_entrance')
        );
        if (result.status >= 400) return proxyResult(response, result);
        return sendJson(response, 200, personalApiFruit(input, result.body));
      }

      if (request.method === 'GET' && path === '/api/v1/me/garden') {
        const token = requireSession(request);
        const result = await service.getRuntime().codexRequest('/api/v1/local-ai/user-graph', { userToken: token });
        if (result.status >= 400) return proxyResult(response, result);
        return sendJson(response, 200, personalGardenSummary(result.body));
      }

      if (request.method === 'POST' && path === '/api/v1/me/garden/relationships') {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        const result = await service.getRuntime().codexRequest('/api/v1/local-ai/user-graph/relationships', {
          method: 'POST',
          body: await readJson(request, MAX_FOUNDATION_BODY_BYTES),
          userToken: token
        });
        if (result.status >= 400) return proxyResult(response, result);
        return sendJson(response, 201, personalGardenMutationSummary(result.body));
      }

      if (request.method === 'GET' && path === '/api/v1/me/transcript') {
        const token = requireSession(request);
        const query = new URLSearchParams();
        if (url.searchParams.has('limit')) query.set('limit', String(url.searchParams.get('limit')));
        if (url.searchParams.has('before')) query.set('before', String(url.searchParams.get('before')));
        const suffix = query.size ? `?${query}` : '';
        const result = await service.getRuntime().codexRequest(`/api/v1/conversation-memory/transcript${suffix}`, { userToken: token });
        if (result.status >= 400) return proxyResult(response, result);
        return sendJson(response, 200, personalTranscript(result.body));
      }

      if (request.method === 'POST' && path === '/api/v1/me/journal/files') {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/conversation-memory/documents', {
          method: 'POST', body: await readJson(request, MAX_DOCUMENT_BODY_BYTES), userToken: token,
          retryNetworkFailures: true, timeoutMs: 180_000
        }));
      }

      if (request.method === 'GET' && path === '/api/v1/me/journal/files') {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/conversation-memory/documents', { userToken: token }));
      }

      const journalOcrFile = path.match(/^\/api\/v1\/me\/journal\/files\/([^/]+)\/ocr$/);
      if (request.method === 'POST' && journalOcrFile) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(
          `/api/v1/conversation-memory/documents/${encodeURIComponent(decodeURIComponent(journalOcrFile[1]))}/ocr`,
          { method: 'POST', userToken: token, retryNetworkFailures: true, timeoutMs: 180_000 }
        ));
      }

      const journalFile = path.match(/^\/api\/v1\/me\/journal\/files\/([^/]+)$/);
      if (request.method === 'DELETE' && journalFile) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(
          `/api/v1/conversation-memory/documents/${encodeURIComponent(decodeURIComponent(journalFile[1]))}`,
          { method: 'DELETE', userToken: token }
        ));
      }

      if (request.method === 'POST' && path === '/api/v1/me/conversation-imports/codex') {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        const result = await service.getRuntime().codexRequest('/api/v1/conversation-memory/imports/codex', {
          method: 'POST', body: await readJson(request, MAX_FOUNDATION_BODY_BYTES), userToken: token
        });
        if (result.status >= 400) return proxyResult(response, result);
        return sendJson(response, result.status, personalCodexImport(result.body));
      }

      if (request.method === 'POST' && path === '/api/v1/me/session') {
        requireSameOriginMutation(request);
        const result = await service.getRuntime().codexRequest('/api/v1/auth/login', { method: 'POST', body: await readJson(request) });
        if (result.status < 400 && typeof result.body.token === 'string') {
          response.setHeader('set-cookie', sessionCookie(result.body.token));
          delete result.body.token;
        }
        return proxyResult(response, result);
      }

      if (request.method === 'POST' && path === '/api/v1/me/account') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/auth/signup', {
          method: 'POST',
          body: await readJson(request)
        }));
      }

      if (request.method === 'POST' && path === '/api/v1/me/account/verify') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/auth/verify-email', {
          method: 'POST',
          body: await readJson(request)
        }));
      }

      if (request.method === 'POST' && path === '/api/v1/me/account/resend-verification') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/auth/resend-verification', {
          method: 'POST',
          body: await readJson(request)
        }));
      }

      if (request.method === 'POST' && path === '/api/v1/agent/auth') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/auth/agent-claim/start', {
          method: 'POST',
          body: await readJson(request)
        }));
      }

      if (request.method === 'POST' && path === '/api/v1/agent/auth/claim') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/auth/agent-claim/complete', {
          method: 'POST',
          body: await readJson(request)
        }));
      }

      if (request.method === 'GET' && path === '/api/v1/me/session') {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/auth/me', { userToken: token }));
      }

      if (request.method === 'DELETE' && path === '/api/v1/me/session') {
        requireSameOriginMutation(request);
        requireSession(request);
        response.setHeader('set-cookie', sessionCookie('', true));
        return sendJson(response, 200, { signedOut: true });
      }

      if (request.method === 'POST' && path === '/ask') {
        const body = await readJson(request);
        const input = typeof body.input === 'string' ? body.input.trim() : '';
        if (!input) return sendJson(response, 400, { error: 'input is required.' });

        const result = await service.getRuntime().ask(input);
        return sendJson(response, 200, result);
      }

      if (request.method === 'POST' && path === '/local-ai/respond') {
        requireSameOriginMutation(request);
        const session = optionalSession(request);
        return proxyResult(response, await service.getRuntime().respondWithLocalModel(
          await readJson(request, MAX_FOUNDATION_BODY_BYTES),
          session,
          analyticsContext(request, 'local_ai')
        ));
      }

      if (request.method === 'POST' && path === '/local-ai/inventions/propose') {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().proposeLocalInvention(
          await readJson(request, MAX_FOUNDATION_BODY_BYTES),
          token
        ));
      }

      if (request.method === 'POST' && path === '/local-ai/alignment/evaluate') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().evaluateWithAlignmentModel(await readJson(request, MAX_FOUNDATION_BODY_BYTES)));
      }

      if (request.method === 'POST' && path === '/local-ai/feedback') {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/local-ai/feedback', {
          method: 'POST', body: await readJson(request, MAX_FOUNDATION_BODY_BYTES), userToken: token
        }));
      }

      if (request.method === 'GET' && path === '/local-ai/feedback') {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/local-ai/feedback', { userToken: token }));
      }

      const feedbackReview = path.match(/^\/local-ai\/feedback\/([^/]+)\/review$/);
      if (request.method === 'PATCH' && feedbackReview) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(`/api/v1/local-ai/feedback/${encodeURIComponent(feedbackReview[1])}/review`, {
          method: 'PATCH', body: await readJson(request), userToken: token
        }));
      }

      const feedbackLearningCandidate = path.match(/^\/local-ai\/feedback\/([^/]+)\/learning-candidates$/);
      if (request.method === 'POST' && feedbackLearningCandidate) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(`/api/v1/local-ai/feedback/${encodeURIComponent(feedbackLearningCandidate[1])}/learning-candidates`, {
          method: 'POST', body: await readJson(request), userToken: token
        }));
      }

      if (request.method === 'GET' && path === '/local-ai/learning-candidates') {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/local-ai/learning-candidates', { userToken: token }));
      }

      const learningCandidateReview = path.match(/^\/local-ai\/learning-candidates\/([^/]+)\/review$/);
      if (request.method === 'PATCH' && learningCandidateReview) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(`/api/v1/local-ai/learning-candidates/${encodeURIComponent(learningCandidateReview[1])}/review`, {
          method: 'PATCH', body: await readJson(request), userToken: token
        }));
      }

      if (request.method === 'GET' && path === '/local-ai/user-graph') {
        const token = requireSession(request);
        const text = url.searchParams.get('text');
        const suffix = text ? `?text=${encodeURIComponent(text)}` : '';
        return proxyResult(response, await service.getRuntime().codexRequest(`/api/v1/local-ai/user-graph${suffix}`, { userToken: token }));
      }

      if (request.method === 'GET' && path === '/local-ai/training/candidates') {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/local-ai/training/candidates', { userToken: token }));
      }

      if (request.method === 'GET' && path === '/local-ai/training/status') {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/local-ai/training/status', { userToken: token }));
      }

      if (request.method === 'GET' && path === '/local-ai/training/versions') {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/local-ai/training/versions', { userToken: token }));
      }

      if (request.method === 'POST' && path === '/local-ai/training/versions') {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/local-ai/training/versions', {
          method: 'POST', body: await readJson(request), userToken: token
        }));
      }

      const adapterAction = path.match(/^\/local-ai\/training\/versions\/([^/]+)\/(activate|rollback)$/);
      if (request.method === 'POST' && adapterAction) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(`/api/v1/local-ai/training/versions/${encodeURIComponent(adapterAction[1])}/${adapterAction[2]}`, {
          method: 'POST', body: await readJson(request), userToken: token
        }));
      }

      if (request.method === 'GET' && path === '/research/search') {
        const token = requireSession(request);
        const params = new URLSearchParams();
        const researchQuery = url.searchParams.get('q');
        const sources = url.searchParams.get('sources');
        if (researchQuery) params.set('q', researchQuery);
        if (sources) params.set('sources', sources);
        return proxyResult(response, await service.getRuntime().codexRequest(`/api/v1/research/search?${params.toString()}`, { userToken: token }));
      }

      if (request.method === 'GET' && path === '/research/items') {
        const token = requireSession(request);
        const params = new URLSearchParams();
        const status = url.searchParams.get('status');
        const kind = url.searchParams.get('kind');
        if (status) params.set('status', status);
        if (kind) params.set('kind', kind);
        const suffix = params.size ? `?${params.toString()}` : '';
        return proxyResult(response, await service.getRuntime().codexRequest(`/api/v1/research/items${suffix}`, { userToken: token }));
      }

      if (request.method === 'POST' && path === '/research/items') {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/research/items', {
          method: 'POST', body: await readJson(request, MAX_FOUNDATION_BODY_BYTES), userToken: token
        }));
      }

      const researchReview = path.match(/^\/research\/items\/([^/]+)\/review$/);
      if (request.method === 'PATCH' && researchReview) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(`/api/v1/research/items/${encodeURIComponent(researchReview[1])}/review`, {
          method: 'PATCH', body: await readJson(request), userToken: token
        }));
      }

      const researchGraphProposal = path.match(/^\/research\/items\/([^/]+)\/graph-proposal$/);
      if (request.method === 'POST' && researchGraphProposal) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(`/api/v1/research/items/${encodeURIComponent(researchGraphProposal[1])}/graph-proposal`, {
          method: 'POST', body: await readJson(request), userToken: token
        }));
      }

      if (request.method === 'POST' && path === '/foundation/letters/analyze') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/foundation/letters/analyze', {
          method: 'POST', body: await readJson(request, MAX_FOUNDATION_BODY_BYTES)
        }));
      }

      if (request.method === 'POST' && path === '/foundation/language-loop') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().runLanguageLoop(await readJson(request, MAX_FOUNDATION_BODY_BYTES)));
      }

      if (request.method === 'POST' && path === '/foundation/training/dataset') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/foundation/training/dataset', {
          method: 'POST', body: await readJson(request, MAX_FOUNDATION_BODY_BYTES)
        }));
      }

      if (request.method === 'POST' && path === '/foundation/training/color-atlas') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/foundation/training/color-atlas', {
          method: 'POST', body: await readJson(request, MAX_FOUNDATION_BODY_BYTES)
        }));
      }

      if (request.method === 'POST' && path === '/foundation/letters/compare') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/foundation/letters/compare', {
          method: 'POST', body: await readJson(request)
        }));
      }

      if (request.method === 'POST' && path === '/foundation/bridge/build') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/foundation/bridge/build', {
          method: 'POST', body: await readJson(request, MAX_FOUNDATION_BODY_BYTES)
        }));
      }

      if (request.method === 'POST' && path === '/foundation/brigde/build') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/foundation/brigde/build', {
          method: 'POST', body: await readJson(request, MAX_FOUNDATION_BODY_BYTES)
        }));
      }

      if (request.method === 'POST' && path === '/foundation/acronyms/expand') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/foundation/acronyms/expand', {
          method: 'POST', body: await readJson(request, MAX_FOUNDATION_BODY_BYTES)
        }));
      }

      if (request.method === 'POST' && path === '/foundation/braille-runtime/compile') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().compileBrailleRuntime(await readJson(request)));
      }

      if (request.method === 'POST' && path === '/foundation/braille-runtime/assemble') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().assembleBrailleRuntime(await readJson(request)));
      }

      if (request.method === 'POST' && path === '/foundation/braille-runtime/modules') {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/foundation/braille-runtime/modules', {
          method: 'POST', body: await readJson(request), userToken: token
        }));
      }

      if (request.method === 'GET' && path === '/foundation/braille-runtime/modules') {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/foundation/braille-runtime/modules', { userToken: token }));
      }

      const moduleReview = path.match(/^\/foundation\/braille-runtime\/modules\/([^/]+)\/review$/);
      if (request.method === 'POST' && moduleReview) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(`/api/v1/foundation/braille-runtime/modules/${encodeURIComponent(moduleReview[1])}/review`, {
          method: 'POST', body: await readJson(request), userToken: token
        }));
      }

      const moduleActivation = path.match(/^\/foundation\/braille-runtime\/modules\/([^/]+)\/activate$/);
      if (request.method === 'POST' && moduleActivation) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(`/api/v1/foundation/braille-runtime/modules/${encodeURIComponent(moduleActivation[1])}/activate`, {
          method: 'POST', body: await readJson(request), userToken: token
        }));
      }

      const moduleAuthority = path.match(/^\/foundation\/braille-runtime\/modules\/([^/]+)\/authority$/);
      if (request.method === 'POST' && moduleAuthority) {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(`/api/v1/foundation/braille-runtime/modules/${encodeURIComponent(moduleAuthority[1])}/authority`, {
          method: 'POST', body: await readJson(request), userToken: token
        }));
      }

      const moduleEvents = path.match(/^\/foundation\/braille-runtime\/modules\/([^/]+)\/events$/);
      if (request.method === 'GET' && moduleEvents) {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest(`/api/v1/foundation/braille-runtime/modules/${encodeURIComponent(moduleEvents[1])}/events`, { userToken: token }));
      }

      if (request.method === 'GET' && path === '/braille/curriculum') {
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/braille/math/curriculum'));
      }

      if (request.method === 'POST' && path === '/braille/translate') {
        requireSameOriginMutation(request);
        return sendJson(response, 200, await service.getRuntime().translateBrailleMath(await readJson(request)));
      }

      if (request.method === 'POST' && path === '/braille/check') {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/braille/math/check', { method: 'POST', body: await readJson(request) }));
      }

      if (request.method === 'GET' && path === '/braille/progress') {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/braille/math/progress', { userToken: token }));
      }

      if (request.method === 'PUT' && path === '/braille/progress') {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/braille/math/progress', { method: 'PUT', body: await readJson(request), userToken: token }));
      }

      const publicAccountRoutes: Record<string, string> = {
        '/account/signup': '/api/v1/auth/signup',
        '/account/verify-email': '/api/v1/auth/verify-email',
        '/account/resend-verification': '/api/v1/auth/resend-verification',
        '/account/forgot-password': '/api/v1/auth/forgot-password',
        '/account/reset-password': '/api/v1/auth/reset-password'
      };
      if (request.method === 'POST' && publicAccountRoutes[path]) {
        requireSameOriginMutation(request);
        return proxyResult(response, await service.getRuntime().codexRequest(publicAccountRoutes[path], { method: 'POST', body: await readJson(request) }));
      }

      if (request.method === 'POST' && path === '/account/login') {
        requireSameOriginMutation(request);
        const result = await service.getRuntime().codexRequest('/api/v1/auth/login', { method: 'POST', body: await readJson(request) });
        if (result.status < 400 && typeof result.body.token === 'string') {
          response.setHeader('set-cookie', sessionCookie(result.body.token));
          delete result.body.token;
        }
        return proxyResult(response, result);
      }

      if (request.method === 'POST' && path === '/account/change-password') {
        requireSameOriginMutation(request);
        const token = requireSession(request);
        const result = await service.getRuntime().codexRequest('/api/v1/auth/change-password', {
          method: 'POST',
          body: await readJson(request),
          userToken: token
        });
        if (result.status < 400 && typeof result.body.token === 'string') {
          response.setHeader('set-cookie', sessionCookie(result.body.token));
          delete result.body.token;
        }
        return proxyResult(response, result);
      }

      if (request.method === 'GET' && path === '/account/me') {
        const token = requireSession(request);
        return proxyResult(response, await service.getRuntime().codexRequest('/api/v1/auth/me', { userToken: token }));
      }

      if (request.method === 'POST' && path === '/account/logout') {
        requireSameOriginMutation(request);
        response.setHeader('set-cookie', sessionCookie('', true));
        return sendJson(response, 200, { signedOut: true });
      }

      return sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 500;
      return sendJson(response, status, { error: message });
    }
  });
}

async function readJson(request: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw httpError(413, `Request body exceeds ${Math.floor(maxBytes / 1024)} KB.`);
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw httpError(400, 'Request body must be valid JSON.');
  }
}

async function readGardenInput(request: IncomingMessage) {
  const body = await readJson(request, MAX_FOUNDATION_BODY_BYTES);
  const input = typeof body.input === 'string' ? body.input.trim() : '';
  if (!input) throw httpError(400, 'A seed of information is required.');
  if ([...input].length > MAX_GARDEN_SEED_CODE_POINTS) {
    throw httpError(413, `Garden seeds must be ${MAX_GARDEN_SEED_CODE_POINTS} Unicode code points or fewer.`);
  }
  return input;
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...securityHeaders()
  });
  response.end(JSON.stringify(body));
}

function proxyResult(response: ServerResponse, result: { status: number; body: Record<string, unknown> }) {
  return sendJson(response, result.status, result.body);
}

function requireSameOriginMutation(request: IncomingMessage) {
  if (request.headers['x-mirror-request'] !== 'same-origin') throw httpError(403, 'Same-origin request header required.');
}

function requireSession(request: IncomingMessage) {
  const token = optionalSession(request);
  if (!token) throw httpError(401, 'Authentication required.');
  return token;
}

function optionalSession(request: IncomingMessage) {
  const cookies = Object.fromEntries(String(request.headers.cookie || '').split(';').map(value => value.trim()).filter(Boolean).map(value => {
    const index = value.indexOf('=');
    return index < 0 ? [value, ''] : [value.slice(0, index), decodeURIComponent(value.slice(index + 1))];
  }));
  return cookies.mirror_session || undefined;
}

function analyticsContext(request: IncomingMessage, entrance: 'combined_shell' | 'public_entrance' | 'personal_entrance' | 'community_api' | 'local_ai') {
  const cookies = parseCookies(request);
  return {
    entrance,
    visitorToken: String(request.headers['x-garden-visitor'] || cookies.garden_visitor || ''),
    sessionToken: String(request.headers['x-garden-session'] || cookies.garden_visit || '')
  };
}

function analyticsEntrance(request: IncomingMessage, fallback: 'combined_shell' | 'public_entrance') {
  return request.headers['x-garden-entrance'] === 'public_entrance' ? 'public_entrance' : fallback;
}

function analyticsCookies(request: IncomingMessage, secure: boolean) {
  const cookies = parseCookies(request);
  const values: string[] = [];
  const suffix = `HttpOnly; SameSite=Lax; Path=/; ${secure ? 'Secure; ' : ''}`;
  if (!cookies.garden_visitor) values.push(`garden_visitor=${crypto.randomUUID()}; ${suffix}Max-Age=31536000`);
  if (!cookies.garden_visit) values.push(`garden_visit=${crypto.randomUUID()}; ${suffix}Max-Age=1800`);
  return values;
}

function parseCookies(request: IncomingMessage) {
  return Object.fromEntries(String(request.headers.cookie || '').split(';').map(value => value.trim()).filter(Boolean).map(value => {
    const index = value.indexOf('=');
    return index < 0 ? [value, ''] : [value.slice(0, index), decodeURIComponent(value.slice(index + 1))];
  }));
}

function sessionCookie(token: string, clear = false) {
  const parts = [`mirror_session=${encodeURIComponent(token)}`, 'HttpOnly', 'SameSite=Strict', 'Path=/', `Max-Age=${clear ? 0 : 43_200}`];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

function securityHeaders() {
  return {
    'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(self), geolocation=()',
    'cache-control': 'no-store',
    ...(process.env.NODE_ENV === 'production' ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' } : {})
  };
}

function gardenIdentity() {
  return {
    version: 'garden-entrance.v1',
    name: 'Community Garden',
    kind: 'public_cultivation_interface',
    purpose: 'Receive seeds of information, cultivate them through protected relational systems, and grow useful fruit for people.',
      technicalPerson: {
        name: 'ARI',
        role: 'relational translator',
        languageEngine: 'Qwen',
        foundation: '/api/v1/ari/foundation',
        toolRegistry: '/api/v1/ari/tools'
    },
    publicSurface: {
      identity: '/garden/identity',
      fruit: '/garden/fruit',
      accountRequired: false
    },
    cultivationCycle: ['receive', 'translate', 'relate', 'compose', 'return'],
    protectedRoots: ['service credentials', 'database records', 'model traces', 'administrative controls', 'direct graph mutation'],
    adaptation: {
      immediate: 'The response may adapt to the current seed and an authenticated personal context.',
      personal: 'Personal learning remains attached to the authenticated person.',
      shared: 'Shared semantic growth requires an explicit governed proposal.'
    },
    boundary: {
      semanticMutationAllowed: false,
      graphMutationAllowed: false,
      sourceMutationAllowed: false,
      reason: 'Visitors receive fruit through the public surface; they do not receive direct access to the Garden roots.'
    }
  };
}

function gardenApiIdentity() {
  return {
    version: 'garden-api.v1',
    name: 'Community Garden API',
    ariFoundation: '/api/v1/ari/foundation',
    ariTools: '/api/v1/ari/tools',
    entrances: {
      person: {
        session: '/api/v1/me/session',
        createAccount: '/api/v1/me/account',
        verifyAccount: '/api/v1/me/account/verify',
        cultivate: '/api/v1/me/cultivate',
        garden: '/api/v1/me/garden',
        placeRelationships: '/api/v1/me/garden/relationships',
        transcript: '/api/v1/me/transcript',
        authentication: 'HttpOnly same-origin session cookie'
      },
      people: {
        cultivate: '/api/v1/community/cultivate',
        authentication: 'anonymous bounded access'
      }
    },
    boundary: {
      personScope: 'Only the authenticated person private overlay may be consulted.',
      communityScope: 'Only shared approved or imported reference knowledge may be consulted.',
      automaticLearningAllowed: false,
      sharedGraphMutationAllowed: false,
      crossPersonAccessAllowed: false
    }
  };
}

function ariFoundationView(foundation: Record<string, any>) {
  return {
    foundation,
    boundary: {
      mode: 'public_reviewed_foundation',
      rawCodexTranscriptImported: false,
      automaticLearningAllowed: false,
      semanticMutationAllowed: false,
      sharedGraphMutationAllowed: false
    }
  };
}

function publicGardenFruit(input: string, result: Record<string, any>, personalContextConsulted: boolean) {
  const transcriptSaved = result.conversationMemory?.saved === true;
  return {
    version: 'garden-entrance.v1',
    seed: {
      received: true,
      codePointCount: [...input].length
    },
    fruit: {
      type: 'cultivated_response',
      language: String(result.response?.language || 'english'),
      text: String(result.response?.text || '')
    },
    cultivation: {
      stages: ['received', 'composed_openly', 'translated', 'related', 'validated_closed'],
      translator: {
        name: String(result.translator?.name || 'ARI'),
        domain: String(result.translator?.domain || 'Community Garden'),
        languageEngine: 'Qwen',
        foundationVersion: String(result.translator?.foundationVersion || 'unresolved')
      },
      graphSource: String(result.trace?.graphSource || 'unresolved'),
      responsePipeline: {
        version: String(result.trace?.responsePipeline?.version || 'open-expression-closed-validation.v1'),
        expressionStage: 'qwen_open_candidate',
        validationStage: 'ari_closed_garden_gate',
        validationStatus: String(result.trace?.responsePipeline?.validationStatus || 'unresolved'),
        repaired: result.trace?.responsePipeline?.repaired === true
      },
      relationshipNotice: String(result.relationalEvidence?.notice || 'No relational evidence summary was returned.'),
      personalContextConsulted,
      persisted: transcriptSaved,
      persistenceLayer: transcriptSaved ? 'private_conversation_transcript' : 'none',
      sharedGraphMutated: false
    },
    boundary: {
      mode: 'public_fruit_read_only',
      semanticMutationAllowed: false,
      graphMutationAllowed: false,
      sourceMutationAllowed: false,
      reason: 'This visitor interaction returns a cultivated response without exposing internal traces or granting mutation authority.'
    }
  };
}

function communityApiFruit(input: string, result: Record<string, any>) {
  const fruit = publicGardenFruit(input, result, false);
  return {
    ...fruit,
    version: 'garden-api.v1',
    boundary: {
      ...fruit.boundary,
      mode: 'community_api_read_only',
      reason: 'The community API cultivates against shared knowledge without reading personal memory or granting mutation authority.'
    }
  };
}

function personalApiFruit(input: string, result: Record<string, any>) {
  const fruit = publicGardenFruit(input, result, true);
  return {
    ...fruit,
    version: 'garden-api.v1',
    cultivation: {
      ...fruit.cultivation,
      personalContextConsulted: true,
      persisted: result.conversationMemory?.saved === true,
      persistenceLayer: result.conversationMemory?.saved === true ? 'private_conversation_transcript' : 'none',
      contextEventCount: Number(result.conversationMemory?.contextEventCount || 0),
      transcriptSequence: Number(result.conversationMemory?.assistantEventSequence || 0) || null,
      sharedGraphMutated: false
    },
    ariBranch: personalAriBranch(result.conversationMemory?.branch),
    comparisonReceipt: personalComparisonReceipt(result.comparisonReceipt),
    boundary: {
      ...fruit.boundary,
      mode: 'personal_api_private_context',
      crossPersonAccessAllowed: false,
      automaticLearningAllowed: false,
      automaticModelTrainingAllowed: false,
      contextualAdaptationAllowed: true,
      reason: 'The personal cultivation API absorbs the ordered exchange into this authenticated person private ARI branch. It does not train model weights or change shared knowledge automatically.'
    }
  };
}

function personalAriBranch(value: Record<string, any> | null | undefined) {
  if (!value || value.version !== 'personal-ari-branch.v1') return null;
  const allowedMoves = new Set(['greeting', 'correction', 'question', 'teaching', 'reflection', 'brief_statement', 'continuation']);
  const recentMoves = (Array.isArray(value.adaptation?.recentMoves) ? value.adaptation.recentMoves : [])
    .map((move: unknown) => String(move || ''))
    .filter((move: string) => allowedMoves.has(move))
    .slice(-8);
  return {
    version: 'personal-ari-branch.v1',
    branchId: String(value.branchId || '').slice(0, 32),
    scope: 'authenticated_person_only',
    absorption: {
      personObservationCount: boundedNonnegative(value.absorption?.personObservationCount, Number.MAX_SAFE_INTEGER),
      ariResponseCount: boundedNonnegative(value.absorption?.ariResponseCount, Number.MAX_SAFE_INTEGER),
      currentMove: allowedMoves.has(String(value.absorption?.latestMove || '')) ? String(value.absorption.latestMove) : null
    },
    adaptation: {
      mode: 'conversation_context_not_model_training',
      expressionPacing: ['unestablished', 'concise', 'balanced', 'expansive'].includes(value.adaptation?.expressionPacing)
        ? value.adaptation.expressionPacing : 'unestablished',
      recentMoves
    },
    boundary: {
      crossPersonAccessAllowed: false,
      sharedGraphMutationAllowed: false,
      automaticModelTrainingAllowed: false,
      contextualAdaptationAllowed: true
    }
  };
}

function personalTranscript(body: Record<string, any>) {
  const events = Array.isArray(body.events) ? body.events.slice(0, 200) : [];
  return {
    version: 'garden-api.v1',
    transcript: {
      events: events.map((event: Record<string, any>) => ({
        sequence: Number(event.sequence),
        interactionId: String(event.interactionId || ''),
        role: event.role === 'assistant' ? 'assistant' : 'user',
        content: String(event.content || ''),
        comparison: personalComparisonMemory(event.metadata?.comparison),
        createdAt: event.createdAt || null
      })),
      count: events.length,
      hasMore: body.hasMore === true,
      nextBefore: Number(body.nextBefore) || null,
      order: 'oldest_to_newest_within_page'
    },
    ariBranch: personalAriBranch(body.branch),
    boundary: {
      mode: 'account_scoped_append_only_transcript',
      crossPersonAccessAllowed: false,
      sharedGraphMutationAllowed: false,
      automaticLearningAllowed: false,
      automaticModelTrainingAllowed: false,
      contextualAdaptationAllowed: true
    }
  };
}

function personalCodexImport(body: Record<string, any>) {
  return {
    version: 'garden-api.v1',
    import: {
      source: 'codex_history',
      received: boundedNonnegative(body.batch?.received, 25),
      imported: boundedNonnegative(body.batch?.imported, 25),
      existing: boundedNonnegative(body.batch?.existing, 25),
      archiveEventCount: boundedNonnegative(body.archive?.eventCount, Number.MAX_SAFE_INTEGER),
      personEventCount: boundedNonnegative(body.archive?.personEventCount, Number.MAX_SAFE_INTEGER),
      codexEventCount: boundedNonnegative(body.archive?.codexEventCount, Number.MAX_SAFE_INTEGER)
    },
    boundary: {
      mode: 'private_developmental_context',
      crossPersonAccessAllowed: false,
      codexSpeechBecomesAriSpeech: false,
      sharedGraphMutationAllowed: false,
      automaticLearningAllowed: false,
      automaticModelTrainingAllowed: false,
      contextualAdaptationAllowed: true
    }
  };
}

function personalComparisonReceipt(value: Record<string, any> | null | undefined) {
  if (!value || value.version !== 'ari-comparison.v1') return null;
  const comparisons = Array.isArray(value.comparisons) ? value.comparisons.slice(0, 5) : [];
  return {
    version: 'ari-comparison.v1',
    operation: 'bounded_structural_comparison',
    selection: {
      availablePersonObservations: boundedNonnegative(value.selection?.availablePersonObservations, 40),
      comparedObservationCount: comparisons.length,
      maximumComparisons: 5,
      contextTruncated: value.selection?.contextTruncated === true
    },
    comparisons: comparisons.map((comparison: Record<string, any>) => ({
      observationSequence: boundedPositive(comparison.observationSequence),
      relevanceScore: boundedRatio(comparison.relevanceScore),
      sharedTokens: safeStringList(comparison.dimensions?.sharedTokens, 12),
      sharedPhrases: safeStringList(comparison.dimensions?.sharedPhrases, 12),
      differenceCount: boundedNonnegative(comparison.differenceCount, 256)
    })).filter((comparison: Record<string, any>) => comparison.observationSequence !== null),
    recurringLanguage: {
      tokens: safeRecurringLanguage(value.recurringLanguage?.tokens),
      phrases: safeRecurringLanguage(value.recurringLanguage?.phrases)
    },
    summary: {
      strongestObservationSequence: boundedPositive(value.summary?.strongestObservationSequence),
      notice: String(value.summary?.notice || '').slice(0, 500)
    },
    boundary: {
      mode: 'observation_only',
      comparisonCreatesMeaning: false,
      semanticMutationAllowed: false,
      graphMutationAllowed: false,
      automaticLearningAllowed: false
    }
  };
}

function personalComparisonMemory(value: Record<string, any> | null | undefined) {
  if (!value || value.version !== 'ari-comparison.v1') return null;
  return {
    version: 'ari-comparison.v1',
    mode: 'observation_only',
    comparedObservationSequences: (Array.isArray(value.comparedObservationSequences) ? value.comparedObservationSequences : [])
      .map(boundedPositive).filter((sequence: number | null): sequence is number => sequence !== null).slice(0, 5),
    strongestObservationSequence: boundedPositive(value.strongestObservationSequence),
    repeatedTokenCount: boundedNonnegative(value.repeatedTokenCount, 12),
    repeatedPhraseCount: boundedNonnegative(value.repeatedPhraseCount, 12),
    comparisonCreatesMeaning: false,
    graphMutationAllowed: false
  };
}

function safeRecurringLanguage(value: unknown) {
  return (Array.isArray(value) ? value : []).slice(0, 12).map((item: Record<string, any>) => ({
    value: String(item?.value || '').slice(0, 120),
    supportCount: boundedNonnegative(item?.supportCount, 6),
    observationSequences: (Array.isArray(item?.observationSequences) ? item.observationSequences : [])
      .map(boundedPositive).filter((sequence: number | null): sequence is number => sequence !== null).slice(0, 6),
    status: 'observation_only'
  })).filter((item: Record<string, any>) => item.value);
}

function safeStringList(value: unknown, maximum: number) {
  return (Array.isArray(value) ? value : [])
    .map(item => String(item || '').slice(0, 120))
    .filter(Boolean)
    .slice(0, maximum);
}

function boundedPositive(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function boundedNonnegative(value: unknown, maximum: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? Math.min(parsed, maximum) : 0;
}

function boundedRatio(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, Math.round(parsed * 1000) / 1000)) : 0;
}

function personalGardenSummary(body: Record<string, any>) {
  const relationships = Array.isArray(body.relationships) ? body.relationships.slice(0, 100) : [];
  return {
    version: 'garden-api.v1',
    garden: {
      sourceLayer: 'user_graph',
      consulted: body.consulted === true,
      relationships: relationships.map((relationship: Record<string, any>) => ({
        id: String(relationship.id || ''),
        source: String(relationship.source || '').slice(0, 120),
        target: String(relationship.target || '').slice(0, 120),
        relationshipType: String(relationship.relationshipType || '').slice(0, 80),
        confidence: String(relationship.confidence || ''),
        evidence: String(relationship.evidence || '').slice(0, 1_000),
        counterexample: String(relationship.counterexample || '').slice(0, 1_000),
        mutationSource: relationship.mutationSource === 'user_directed' ? 'user_directed' : 'reviewed_feedback',
        profileOwnerConfirmed: Boolean(relationship.approvedByUser),
        reviewNote: String(relationship.reviewNote || '').slice(0, 1_000),
        sourceLayer: 'user_graph',
        createdAt: relationship.createdAt || null
      })),
      relationshipCount: Number(body.relationshipCount || relationships.length),
      truncated: body.truncated === true
    },
    boundary: {
      mode: 'personal_garden_owner_only',
      crossPersonAccessAllowed: false,
      sharedGraphMutationAllowed: false,
      colorAtlasMutationAllowed: false,
      automaticLearningAllowed: false,
      reason: 'This read is scoped by the authenticated account. Personal relationships enter through reviewed feedback or an explicit, confirmed instruction from the profile owner.'
    }
  };
}

function personalGardenMutationSummary(body: Record<string, any>) {
  const garden = personalGardenSummary({
    relationships: body.relationships,
    relationshipCount: body.relationshipCount,
    consulted: true,
    truncated: false
  });
  return {
    ...garden,
    mutation: {
      applied: body.boundary?.personalGraphMutated === true,
      profileOwnerConfirmed: body.boundary?.profileOwnerConfirmed === true,
      relationshipCount: garden.garden.relationshipCount
    },
    boundary: {
      ...garden.boundary,
      mode: 'user_directed_personal_graph_mutation',
      personalGraphMutated: body.boundary?.personalGraphMutated === true,
      sharedGraphMutationAllowed: false,
      colorAtlasMutationAllowed: false,
      automaticLearningAllowed: false,
      reason: 'The authenticated profile owner explicitly placed these relationships in their private overlay. Shared graph knowledge and fixed Color Atlas coordinates remain unchanged.'
    }
  };
}

function createFixedWindowRateLimiter({ name, windowMs, maxRequests }: { name: string; windowMs: number; maxRequests: number }) {
  const windows = new Map<string, { startedAt: number; count: number }>();

  return (request: IncomingMessage, response: ServerResponse) => {
    const now = Date.now();
    const key = clientAddress(request);
    const current = windows.get(key);
    const record = !current || now - current.startedAt >= windowMs
      ? { startedAt: now, count: 0 }
      : current;
    record.count += 1;
    windows.set(key, record);

    const remaining = Math.max(maxRequests - record.count, 0);
    const resetSeconds = Math.max(Math.ceil((record.startedAt + windowMs - now) / 1000), 1);
    response.setHeader('RateLimit-Limit', String(maxRequests));
    response.setHeader('RateLimit-Remaining', String(remaining));
    response.setHeader('RateLimit-Reset', String(resetSeconds));
    if (record.count > maxRequests) {
      response.setHeader('Retry-After', String(resetSeconds));
      throw httpError(429, `Too many ${name} requests. Try again later.`);
    }
  };
}

function clientAddress(request: IncomingMessage) {
  if (process.env.MIRROR_TRUST_PROXY === 'true') {
    const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return request.socket.remoteAddress || 'unknown';
}

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}
