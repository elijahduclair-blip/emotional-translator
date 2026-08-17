import { createServer } from 'node:http';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createGardenPublicGateway } from '../public-gateway';

describe('Garden Entrance public gateway', () => {
  it('exposes only the public entrance and strips protected runtime fields', async () => {
    let receivedHeaders: Record<string, string | string[] | undefined> | undefined;
    let analyticsHeaders: Record<string, string | string[] | undefined> | undefined;
    const runtime = createServer(async (request, response) => {
      if (request.url === '/garden/identity') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          version: 'garden-entrance.v1', name: 'Community Garden', kind: 'public_cultivation_interface',
          purpose: 'Grow useful fruit for people.', cultivationCycle: ['receive', 'return'],
          protectedRoots: ['service credentials'], adaptation: { immediate: 'current seed', personal: 'private', shared: 'governed' },
          boundary: { reason: 'Protected roots.' }, secretRuntimeToken: 'must-not-cross'
        }));
        return;
      }
      if (request.url === '/api/v1/ari/tools') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          version: 'ari-tool-registry.v1', coordinator: 'ARI',
          team: [{ id: 'ARI', coordinator: true }, { id: 'FEN', coordinator: false }],
          tools: [{ id: 'fen.trace-language', owner: 'FEN', status: 'ready', permissions: { reads: ['current_statement'], writes: [] } }],
          boundary: { sharedGraphMutationAllowed: false }
        }));
        return;
      }
      if (request.url === '/api/v1/ari/foundation') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          version: 'ari-foundation.v1',
          rules: ['ordered_structure', 'comparison_before_claim'],
          boundary: { graphMutationAllowed: false, diagnosticClaimsAllowed: false }
        }));
        return;
      }
      if (request.url === '/garden/fruit') {
        receivedHeaders = request.headers;
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          version: 'garden-entrance.v1', seed: { received: true, codePointCount: [...body.input].length },
          fruit: { language: 'english', text: 'A bounded public harvest.' },
          cultivation: { stages: ['received', 'translated', 'composed'], graphSource: 'approved_graph', relationshipNotice: 'One route.', personalContextConsulted: true },
          model: { name: 'internal-model' }, trace: { private: true }, feedback: { receipt: 'private' }, timings: { total: 1 }
        }));
        return;
      }
      if (request.url === '/analytics/visit') {
        analyticsHeaders = request.headers;
        response.writeHead(202, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ recorded: true, contentStored: false }));
        return;
      }
      response.writeHead(404).end();
    });
    await listen(runtime);
    const runtimeAddress = runtime.address();
    if (!runtimeAddress || typeof runtimeAddress === 'string') throw new Error('Runtime stub did not bind.');

    const gateway = createGardenPublicGateway({
      runtimeOrigin: `http://127.0.0.1:${runtimeAddress.port}`,
      rateLimitMax: 2,
      webBotAuthSecret: 'test-only-community-garden-web-bot-auth-secret'
    });
    await listen(gateway);
    const gatewayAddress = gateway.address();
    if (!gatewayAddress || typeof gatewayAddress === 'string') throw new Error('Gateway did not bind.');
    const origin = `http://127.0.0.1:${gatewayAddress.port}`;

    try {
      const page = await fetch(`${origin}/`);
      expect(page.status).toBe(200);
      expect(page.headers.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()');
      expect(page.headers.get('link')).toContain('<https://acommunitygarden.garden/.well-known/api-catalog>; rel="api-catalog"');
      expect(page.headers.get('link')).toContain('<https://acommunitygarden.garden/openapi.json>; rel="service-desc"');
      expect(page.headers.get('link')).toContain('<https://acommunitygarden.garden/.well-known/oauth-authorization-server>; rel="authorization-server"');
      expect(page.headers.get('link')).toContain('<https://acommunitygarden.garden/.well-known/oauth-protected-resource>; rel="protected-resource"');
      expect(page.headers.get('set-cookie')).toContain('garden_visitor=');
      const html = await page.text();
      expect(html).toContain('Public Garden Entrance');
      expect(html).toContain('Plant information.');
      expect(html).toContain('<title>Community Garden | ARI Relational Translator</title>');
      expect(html).toContain('<link rel="canonical" href="https://acommunitygarden.garden/">');
      expect(html).toContain('type="application/ld+json"');
      expect(html).toContain('Accountable Relational Intelligence');
      expect(html).toContain('href="/about"');
      expect(html).toContain('href="/ari"');
      expect(html).toContain('href="/theory-of-alignment"');
      expect(html).toContain('href="/privacy"');
      expect(html).toContain('Personal Profile Portal');
      expect(html).toContain('My profile');
      expect(html).toContain('id="profileLoginForm"');
      expect(html).toContain('id="profileSignupForm"');
      expect(html).toContain('id="seed" maxlength="10000"');
      expect(html).toContain('id="personalSeed" maxlength="10000"');
      expect(html).toContain('id="personalComparisonReceipt"');
      expect(html).toContain('Observation-only boundary');
      expect(html).toContain('Create my account');
      expect(html).toContain("fetch('/api/v1/me/account'");
      expect(html).toContain("fetch('/api/v1/me/account/verify'");
      expect(html).toContain("fetch('/api/v1/me/session'");
      expect(html).toContain("fetch('/api/v1/me/cultivate'");
      expect(html).toContain("fetch('/api/v1/me/garden'");
      expect(html).toContain('document.modelContext');
      expect(html).toContain('navigator.modelContext');
      expect(html).toContain('modelContext.registerTool(tool)');
      expect(html).toContain("'garden_identity'");
      expect(html).toContain("'ari_foundation'");
      expect(html).toContain("'ari_tool_registry'");
      expect(html).toContain("credentials: 'omit'");
      expect(html).toContain('readOnlyHint: true');
      expect(html).not.toContain('Governance');
      expect(html).not.toContain('Administrator');

      const publicPages = [
        ['/about', 'About Community Garden', 'https://acommunitygarden.garden/about'],
        ['/ari', 'Accountable Relational Intelligence', 'https://acommunitygarden.garden/ari'],
        ['/theory-of-alignment', 'Theory of Alignment', 'https://acommunitygarden.garden/theory-of-alignment'],
        ['/privacy', 'Privacy and Boundaries', 'https://acommunitygarden.garden/privacy']
      ] as const;
      for (const [path, heading, canonical] of publicPages) {
        const publicPage = await fetch(`${origin}${path}`);
        const publicHtml = await publicPage.text();
        expect(publicPage.status).toBe(200);
        expect(publicPage.headers.get('content-type')).toContain('text/html');
        expect(publicPage.headers.get('content-signal')).toBe('search=yes, ai-input=yes, ai-train=no');
        expect(publicPage.headers.get('vary')).toContain('Accept');
        expect(publicPage.headers.get('cache-control')).toContain('public');
        expect(publicHtml).toContain(heading);
        expect(publicHtml).toContain(`<link rel="canonical" href="${canonical}">`);
        expect(publicHtml).toContain('href="/"');
      }

      const markdown = await fetch(`${origin}/ari`, { headers: { accept: 'text/markdown' } });
      const markdownBody = await markdown.text();
      expect(markdown.status).toBe(200);
      expect(markdown.headers.get('content-type')).toContain('text/markdown');
      expect(markdown.headers.get('content-signal')).toBe('search=yes, ai-input=yes, ai-train=no');
      expect(markdown.headers.get('vary')).toContain('Accept');
      expect(markdownBody).toContain('# ARI - Accountable Relational Intelligence');
      expect(markdownBody).not.toContain('<html');
      expect(markdownBody).not.toContain('fetch(');

      const markdownHead = await fetch(`${origin}/ari`, { method: 'HEAD', headers: { accept: 'text/markdown' } });
      expect(markdownHead.status).toBe(200);
      expect(markdownHead.headers.get('content-type')).toContain('text/markdown');
      expect(markdownHead.headers.get('content-length')).toBeTruthy();
      expect(await markdownHead.text()).toBe('');

      const refusedMarkdown = await fetch(`${origin}/ari`, { headers: { accept: 'text/markdown;q=0, text/html' } });
      expect(refusedMarkdown.headers.get('content-type')).toContain('text/html');

      const catalog = await fetch(`${origin}/.well-known/api-catalog`);
      const catalogBody = await catalog.json() as Record<string, any>;
      expect(catalog.status).toBe(200);
      expect(catalog.headers.get('content-type')).toContain('application/linkset+json');
      expect(catalog.headers.get('content-type')).toContain('https://www.rfc-editor.org/info/rfc9727');
      expect(catalog.headers.get('link')).toContain('rel="api-catalog"');
      expect(catalogBody.linkset[0].anchor).toBe('https://acommunitygarden.garden/api/v1');
      expect(catalogBody.linkset[0]['service-desc'][0].href).toBe('https://acommunitygarden.garden/openapi.json');
      expect(catalogBody.linkset[0]['service-doc'][0].href).toBe('https://acommunitygarden.garden/api-docs.md');

      const catalogHead = await fetch(`${origin}/.well-known/api-catalog`, { method: 'HEAD' });
      expect(catalogHead.status).toBe(200);
      expect(catalogHead.headers.get('link')).toContain('rel="api-catalog"');
      expect(await catalogHead.text()).toBe('');

      const openApi = await fetch(`${origin}/openapi.json`);
      const openApiBody = await openApi.json() as Record<string, any>;
      expect(openApi.status).toBe(200);
      expect(openApi.headers.get('content-type')).toContain('application/vnd.oai.openapi+json');
      expect(openApiBody.openapi).toBe('3.1.0');
      expect(openApiBody.paths).toHaveProperty('/api/v1/me/session');
      expect(openApiBody.paths).toHaveProperty('/api/v1/ari/tools');
      expect(openApiBody.paths).toHaveProperty('/oauth/authorize');
      expect(openApiBody.paths).toHaveProperty('/oauth/token');
      expect(openApiBody.paths).toHaveProperty('/agent/auth');
      expect(openApiBody.paths).toHaveProperty('/agent/auth/claim');
      expect(openApiBody.components.securitySchemes.gardenOAuth.type).toBe('oauth2');
      expect(openApiBody.paths).not.toHaveProperty('/api/health');
      expect(JSON.stringify(openApiBody)).not.toContain('RUNTIME_SERVICE_TOKEN');

      const apiDocs = await fetch(`${origin}/api-docs.md`);
      expect(apiDocs.status).toBe(200);
      expect(apiDocs.headers.get('content-type')).toContain('text/markdown');
      expect(await apiDocs.text()).toContain('# Community Garden Public API');

      const auth = await fetch(`${origin}/auth.md`);
      const authBody = await auth.text();
      expect(auth.status).toBe(200);
      expect(auth.headers.get('content-type')).toContain('text/markdown');
      expect(authBody).toContain('## Discover the OAuth pair');
      expect(authBody).toContain('agent_auth:');
      expect(authBody).toContain('register_uri: https://acommunitygarden.garden/agent/auth');
      expect(authBody).toContain('claim_uri: https://acommunitygarden.garden/agent/auth/claim');
      expect(authBody).toContain('assertion_types_supported:');
      expect(authBody).toContain('- verified_email');
      expect(authBody).toContain('registration_type: user_authorized_account');
      expect(authBody).toContain('registration_endpoint: https://acommunitygarden.garden/api/v1/me/account');
      expect(authBody).toContain('authorization_server_metadata: https://acommunitygarden.garden/.well-known/oauth-authorization-server');
      expect(authBody).toContain('protected_resource_metadata: https://acommunitygarden.garden/.well-known/oauth-protected-resource');
      expect(authBody).toContain('PKCE');
      expect(authBody).toContain('POST /api/v1/me/account');
      expect(authBody).toContain('POST /api/v1/me/session');
      expect(authBody).toContain('HttpOnly');
      expect(authBody).toContain('must never read or control the person\'s mailbox');
      expect(authBody).not.toContain('mirror-platform-local');

      const oauthDiscovery = await fetch(`${origin}/.well-known/oauth-authorization-server`);
      const oauthDiscoveryBody = await oauthDiscovery.json() as Record<string, any>;
      expect(oauthDiscovery.status).toBe(200);
      expect(oauthDiscoveryBody.issuer).toBe('https://acommunitygarden.garden');
      expect(oauthDiscoveryBody.authorization_endpoint).toBe('https://acommunitygarden.garden/oauth/authorize');
      expect(oauthDiscoveryBody.token_endpoint).toBe('https://acommunitygarden.garden/oauth/token');
      expect(oauthDiscoveryBody.registration_endpoint).toBe('https://acommunitygarden.garden/oauth/register');
      expect(oauthDiscoveryBody.grant_types_supported).toEqual(['authorization_code']);
      expect(oauthDiscoveryBody.code_challenge_methods_supported).toEqual(['S256']);
      expect(oauthDiscoveryBody.agent_auth).toEqual({
        skill: 'https://acommunitygarden.garden/auth.md',
        register_uri: 'https://acommunitygarden.garden/agent/auth',
        claim_uri: 'https://acommunitygarden.garden/agent/auth/claim',
        identity_types_supported: ['identity_assertion'],
        identity_assertion: {
          assertion_types_supported: ['verified_email'],
          credential_types_supported: ['access_token']
        }
      });

      const protectedResource = await fetch(`${origin}/.well-known/oauth-protected-resource`);
      const protectedResourceBody = await protectedResource.json() as Record<string, any>;
      expect(protectedResource.status).toBe(200);
      expect(protectedResourceBody.resource).toBe('https://acommunitygarden.garden');
      expect(protectedResourceBody.authorization_servers).toEqual(['https://acommunitygarden.garden']);
      expect(protectedResourceBody.bearer_methods_supported).toEqual(['header']);
      expect(protectedResourceBody.scopes_supported).toContain('garden:cultivate');

      const signatureDirectory = await fetch(`${origin}/.well-known/http-message-signatures-directory`);
      const signatureDirectoryBody = await signatureDirectory.json() as Record<string, any>;
      expect(signatureDirectory.status).toBe(200);
      expect(signatureDirectory.headers.get('content-type')).toContain('application/http-message-signatures-directory+json');
      expect(signatureDirectory.headers.get('cache-control')).toContain('max-age=86400');
      expect(signatureDirectory.headers.get('signature-input')).toContain('tag="http-message-signatures-directory"');
      expect(signatureDirectoryBody.keys).toHaveLength(1);
      expect(signatureDirectoryBody.keys[0]).toEqual(expect.objectContaining({
        kty: 'OKP', crv: 'Ed25519', use: 'sig', alg: 'EdDSA'
      }));
      expect(signatureDirectoryBody.keys[0]).not.toHaveProperty('d');
      const directoryParameters = String(signatureDirectory.headers.get('signature-input')).replace(/^sig1=/, '');
      const directorySignatureBase = `"@authority";req: ${new URL(origin).host}\n"@signature-params": ${directoryParameters}`;
      const directorySignature = Buffer.from(
        String(signatureDirectory.headers.get('signature')).replace(/^sig1=:/, '').replace(/:$/, ''),
        'base64'
      );
      const directoryPublicKey = crypto.createPublicKey({ key: signatureDirectoryBody.keys[0], format: 'jwk' });
      expect(crypto.verify(null, Buffer.from(directorySignatureBase), directoryPublicKey, directorySignature)).toBe(true);

      const signatureDirectoryHead = await fetch(`${origin}/.well-known/http-message-signatures-directory`, { method: 'HEAD' });
      expect(signatureDirectoryHead.status).toBe(200);
      expect(signatureDirectoryHead.headers.get('signature')).toBeTruthy();
      expect(await signatureDirectoryHead.text()).toBe('');

      const agentCard = await fetch(`${origin}/.well-known/agent-card.json`);
      const agentCardBody = await agentCard.json() as Record<string, any>;
      expect(agentCard.status).toBe(200);
      expect(agentCard.headers.get('access-control-allow-origin')).toBe('*');
      expect(agentCardBody.protocolVersion).toBe('1.0');
      expect(agentCardBody.name).toContain('Accountable Relational Intelligence');
      expect(agentCardBody.supportedInterfaces).toEqual([{ url: 'https://acommunitygarden.garden/a2a/v1', protocolBinding: 'HTTP+JSON' }]);
      expect(agentCardBody.skills[0].id).toBe('cultivate-public-seed');
      expect(JSON.stringify(agentCardBody)).not.toContain('mirror-platform-local');

      const skillsIndex = await fetch(`${origin}/.well-known/agent-skills/index.json`);
      const skillsIndexBody = await skillsIndex.json() as Record<string, any>;
      expect(skillsIndex.status).toBe(200);
      expect(skillsIndexBody.$schema).toBe('https://schemas.agentskills.io/discovery/0.2.0/schema.json');
      expect(skillsIndexBody.skills).toHaveLength(3);
      for (const skill of skillsIndexBody.skills) {
        const skillDocument = await fetch(`${origin}${new URL(skill.url).pathname}`);
        const skillText = await skillDocument.text();
        expect(skillDocument.status).toBe(200);
        expect(skillDocument.headers.get('access-control-allow-origin')).toBe('*');
        expect(skillText).toContain(`name: ${skill.name}`);
        expect(skill.digest).toBe(`sha256:${crypto.createHash('sha256').update(skillText).digest('hex')}`);
      }

      const mcpCard = await fetch(`${origin}/.well-known/mcp/server-card.json`);
      const mcpCardBody = await mcpCard.json() as Record<string, any>;
      expect(mcpCard.status).toBe(200);
      expect(mcpCard.headers.get('access-control-allow-origin')).toBe('*');
      expect(mcpCardBody.protocolVersion).toBe('2025-06-18');
      expect(mcpCardBody.transport).toEqual({ type: 'streamable-http', endpoint: '/mcp' });
      expect(mcpCardBody.tools.map((tool: Record<string, any>) => tool.name)).toEqual([
        'garden_identity', 'ari_foundation', 'ari_tool_registry'
      ]);
      expect(mcpCardBody._meta.personalContextAvailable).toBe(false);
      expect(mcpCardBody._meta.sharedGraphMutationAllowed).toBe(false);

      const mcpInitialize = await fetch(`${origin}/mcp`, {
        method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } })
      });
      const mcpInitializeBody = await mcpInitialize.json() as Record<string, any>;
      expect(mcpInitialize.status).toBe(200);
      expect(mcpInitialize.headers.get('mcp-protocol-version')).toBe('2025-06-18');
      expect(mcpInitializeBody.result.capabilities.tools.listChanged).toBe(false);

      const mcpTools = await fetch(`${origin}/mcp`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
      });
      const mcpToolsBody = await mcpTools.json() as Record<string, any>;
      expect(mcpToolsBody.result.tools).toHaveLength(3);
      expect(mcpToolsBody.result.tools.every((tool: Record<string, any>) => tool.annotations.readOnlyHint === true)).toBe(true);

      const mcpFoundation = await fetch(`${origin}/mcp`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ari_foundation', arguments: {} } })
      });
      const mcpFoundationBody = await mcpFoundation.json() as Record<string, any>;
      expect(mcpFoundationBody.result.isError).toBe(false);
      expect(mcpFoundationBody.result.structuredContent.version).toBe('ari-foundation.v1');

      const a2aMessage = await fetch(`${origin}/a2a/v1/message:send`, {
        method: 'POST',
        headers: { 'content-type': 'application/a2a+json', cookie: 'mirror_session=must-not-forward', authorization: 'Bearer must-not-forward' },
        body: JSON.stringify({ message: { messageId: 'message-1', role: 'ROLE_USER', parts: [{ text: 'What is moving here?' }] } })
      });
      const a2aMessageBody = await a2aMessage.json() as Record<string, any>;
      expect(a2aMessage.status).toBe(200);
      expect(a2aMessage.headers.get('content-type')).toContain('application/a2a+json');
      expect(a2aMessageBody.message.role).toBe('ROLE_AGENT');
      expect(a2aMessageBody.message.parts[0].text).toBe('A bounded public harvest.');
      expect(a2aMessageBody.message.metadata.boundary.graphMutationAllowed).toBe(false);
      expect(receivedHeaders?.cookie).toBeUndefined();
      expect(receivedHeaders?.authorization).toBeUndefined();

      const head = await fetch(`${origin}/ari`, { method: 'HEAD' });
      expect(head.status).toBe(200);
      expect(head.headers.get('content-length')).toBeTruthy();
      expect(await head.text()).toBe('');

      const robots = await fetch(`${origin}/robots.txt`);
      const robotsBody = await robots.text();
      expect(robots.status).toBe(200);
      expect(robotsBody).toContain('User-agent: *');
      expect(robotsBody).toContain('Content-Signal: search=yes, ai-input=yes, ai-train=no');
      expect(robotsBody).toContain('Allow: /');
      expect(robotsBody).toContain('Disallow: /api/');
      expect(robotsBody).toContain('Sitemap: https://acommunitygarden.garden/sitemap.xml');

      const sitemap = await fetch(`${origin}/sitemap.xml`);
      const sitemapBody = await sitemap.text();
      expect(sitemap.status).toBe(200);
      expect(sitemap.headers.get('content-type')).toContain('application/xml');
      expect(sitemapBody.match(/<loc>/g)).toHaveLength(5);
      expect(sitemapBody).toContain('<loc>https://acommunitygarden.garden/ari</loc>');
      expect(sitemapBody).not.toContain('/api/');

      const analyticsCookie = String(page.headers.get('set-cookie') || '').split(',').map(value => value.split(';')[0].trim()).join('; ');
      const visit = await fetch(`${origin}/analytics/visit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-garden-request': 'public-entrance', cookie: analyticsCookie },
        body: JSON.stringify({ room: 'public' })
      });
      expect(visit.status).toBe(202);
      expect(analyticsHeaders?.['x-garden-entrance']).toBe('public_entrance');
      expect(analyticsHeaders?.['x-garden-visitor']).toBeTruthy();

      const identity = await fetch(`${origin}/garden/identity`);
      const identityBody = await identity.json() as Record<string, any>;
      expect(identity.status).toBe(200);
      expect(identity.headers.get('content-signal')).toBeNull();
      expect(identity.headers.get('link')).toBeNull();
      expect(identity.headers.get('x-robots-tag')).toBe('noindex, nofollow');
      expect(identityBody.name).toBe('Community Garden');
      expect(identityBody.boundary.graphMutationAllowed).toBe(false);
      expect(identityBody).not.toHaveProperty('secretRuntimeToken');

      const toolRegistry = await fetch(`${origin}/api/v1/ari/tools`);
      const toolRegistryBody = await toolRegistry.json() as Record<string, any>;
      expect(toolRegistry.status).toBe(200);
      expect(toolRegistryBody.version).toBe('ari-tool-registry.v1');
      expect(toolRegistryBody.coordinator).toBe('ARI');
      expect(toolRegistryBody.tools[0]).toEqual(expect.objectContaining({ id: 'fen.trace-language', owner: 'FEN', status: 'ready' }));
      expect(toolRegistryBody.boundary.sharedGraphMutationAllowed).toBe(false);

      const internalAccount = await fetch(`${origin}/account/me`);
      const internalLocalAi = await fetch(`${origin}/local-ai/respond`, { method: 'POST' });
      const internalApi = await fetch(`${origin}/api/health`);
      expect(internalAccount.status).toBe(404);
      expect(internalLocalAi.status).toBe(404);
      expect(internalApi.status).toBe(404);

      const missingHeader = await fetch(`${origin}/garden/fruit`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: 'visitor seed' })
      });
      expect(missingHeader.status).toBe(403);

      const fruit = await fetch(`${origin}/garden/fruit`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json', 'x-garden-request': 'public-entrance',
          cookie: 'mirror_session=must-not-forward', authorization: 'Bearer must-not-forward'
        },
        body: JSON.stringify({ input: 'visitor seed' })
      });
      const fruitBody = await fruit.json() as Record<string, any>;
      expect(fruit.status).toBe(200);
      expect(fruit.headers.get('ratelimit-limit')).toBe('2');
      expect(fruitBody.fruit.text).toBe('A bounded public harvest.');
      expect(fruitBody.cultivation).toEqual(expect.objectContaining({ personalContextConsulted: false, persisted: false, sharedGraphMutated: false }));
      expect(fruitBody.boundary.graphMutationAllowed).toBe(false);
      expect(fruitBody).not.toHaveProperty('model');
      expect(fruitBody).not.toHaveProperty('trace');
      expect(fruitBody).not.toHaveProperty('feedback');
      expect(fruitBody).not.toHaveProperty('timings');
      expect(receivedHeaders?.cookie).toBeUndefined();
      expect(receivedHeaders?.authorization).toBeUndefined();
      expect(receivedHeaders?.['x-mirror-request']).toBe('same-origin');

      const limited = await fetch(`${origin}/garden/fruit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-garden-request': 'public-entrance' },
        body: JSON.stringify({ input: 'another seed' })
      });
      expect(limited.status).toBe(429);
      expect(limited.headers.get('retry-after')).toBeTruthy();

      const health = await fetch(`${origin}/health`);
      const healthBody = await health.json() as Record<string, unknown>;
      expect(healthBody).toEqual({ status: 'ready', entrance: 'open', version: 'garden-entrance.v1' });
      expect(healthBody).not.toHaveProperty('localModel');
    } finally {
      await Promise.all([close(gateway), close(runtime)]);
    }
  });

  it('separates two owner-scoped person APIs from the anonymous community API', async () => {
    let communityHeaders: Record<string, string | string[] | undefined> | undefined;
    let personalHeaders: Record<string, string | string[] | undefined> | undefined;
    let gardenHeaders: Record<string, string | string[] | undefined> | undefined;
    let transcriptHeaders: Record<string, string | string[] | undefined> | undefined;
    let sessionHeaders: Record<string, string | string[] | undefined> | undefined;
    let signupHeaders: Record<string, string | string[] | undefined> | undefined;
    let signupBody: Record<string, unknown> | undefined;

    const runtime = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));

      if (request.url === '/api/v1/me/session' && request.method === 'POST') {
        response.writeHead(200, {
          'content-type': 'application/json',
          'set-cookie': 'mirror_session=signed-person-token; HttpOnly; SameSite=Strict; Path=/'
        });
        response.end(JSON.stringify({ user: { id: 'person-1', username: 'gardener', email: 'person@example.com', role: 'user' }, token: 'must-not-cross' }));
        return;
      }
      if (request.url === '/api/v1/me/account' && request.method === 'POST') {
        signupHeaders = request.headers;
        signupBody = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        response.writeHead(202, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ message: 'Check your email to verify the account.', internalToken: 'must-not-cross' }));
        return;
      }
      if (request.url === '/api/v1/me/account/verify' && request.method === 'POST') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ verified: true, internal: 'must-not-cross' }));
        return;
      }
      if (request.url === '/api/v1/me/account/resend-verification' && request.method === 'POST') {
        response.writeHead(202, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ message: 'If the account can receive this request, an email has been sent.' }));
        return;
      }
      if (request.url === '/api/v1/agent/auth' && request.method === 'POST') {
        response.writeHead(202, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ claimId: '11111111-1111-4111-8111-111111111111', status: 'pending_user_verification', expiresIn: 600 }));
        return;
      }
      if (request.url === '/api/v1/agent/auth/claim' && request.method === 'POST') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ token: 'agent-person-session', user: { id: 'person-1', username: 'gardener', role: 'user' } }));
        return;
      }
      if (request.url === '/api/v1/me/session' && request.method === 'GET') {
        sessionHeaders = request.headers;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ user: { id: 'person-1', username: 'gardener', role: 'user' }, internal: 'must-not-cross' }));
        return;
      }
      if (request.url === '/api/v1/me/session' && request.method === 'DELETE') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ signedOut: true }));
        return;
      }
      if (request.url === '/api/v1/community/cultivate' && request.method === 'POST') {
        communityHeaders = request.headers;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          version: 'garden-api.v1', seed: { received: true, codePointCount: 14 },
          fruit: { language: 'english', text: 'Shared fruit.' },
          cultivation: { stages: ['received', 'composed'], graphSource: 'approved_graph', relationshipNotice: 'Shared route.' },
          model: { name: 'private-model' }, trace: { private: true }
        }));
        return;
      }
      if (request.url === '/api/v1/me/cultivate' && request.method === 'POST') {
        personalHeaders = request.headers;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          version: 'garden-api.v1', seed: { received: true, codePointCount: 13 },
          fruit: { language: 'english', text: 'Personal fruit.' },
          cultivation: { stages: ['received', 'composed'], graphSource: 'user_graph', relationshipNotice: 'Private route.', persisted: true, contextEventCount: 2, transcriptSequence: 4 },
          comparisonReceipt: {
            version: 'ari-comparison.v1', operation: 'bounded_structural_comparison',
            selection: { availablePersonObservations: 3, comparedObservationCount: 1, contextTruncated: false },
            comparisons: [{ observationSequence: 1, relevanceScore: 0.75, sharedTokens: ['personal', 'seed'], sharedPhrases: ['personal seed'], differenceCount: 1, internalContent: 'must-not-cross' }],
            recurringLanguage: { tokens: [{ value: 'seed', supportCount: 2, observationSequences: [1, 3] }], phrases: [] },
            summary: { strongestObservationSequence: 1, notice: 'Compared with one earlier observation.', internal: 'must-not-cross' },
            boundary: { comparisonCreatesMeaning: true, graphMutationAllowed: true }
          },
          model: { name: 'private-model' }, feedback: { receipt: 'private' }
        }));
        return;
      }
      if (request.url?.startsWith('/api/v1/me/transcript') && request.method === 'GET') {
        transcriptHeaders = request.headers;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          transcript: {
            events: [
              { sequence: 3, interactionId: 'interaction-1', role: 'user', content: 'personal seed', createdAt: '2026-08-13T00:00:00Z', internal: 'must-not-cross' },
              {
                sequence: 4, interactionId: 'interaction-1', role: 'assistant', content: 'Personal fruit.', createdAt: '2026-08-13T00:00:01Z',
                comparison: { version: 'ari-comparison.v1', comparedObservationSequences: [1], strongestObservationSequence: 1, repeatedTokenCount: 1, repeatedPhraseCount: 0, graphMutationAllowed: true, internal: 'must-not-cross' },
                internal: 'must-not-cross'
              }
            ],
            count: 2, hasMore: false, nextBefore: null
          },
          internalUserId: 'must-not-cross'
        }));
        return;
      }
      if (request.url === '/api/v1/me/garden' && request.method === 'GET') {
        gardenHeaders = request.headers;
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          garden: {
            consulted: true,
            relationships: [{ id: 'r1', source: 'mist', target: 'revision', relationshipType: 'personal_association', confidence: 'medium', evidence: 'Reviewed.', counterexample: 'Not always.', sourceFeedbackId: 'must-not-cross' }],
            relationshipCount: 1,
            truncated: false
          },
          internalUserId: 'must-not-cross'
        }));
        return;
      }
      if (request.url === '/api/v1/me/garden/relationships' && request.method === 'POST') {
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          garden: {
            consulted: true,
            relationships: [{
              id: 'r-flow', source: 'Flow', target: 'Grey', relationshipType: 'color_association',
              confidence: 'high', evidence: 'Profile owner placement.', counterexample: 'Owner may revise it.',
              mutationSource: 'user_directed', profileOwnerConfirmed: true, reviewNote: 'Explicitly approved.',
              internalUserId: 'must-not-cross'
            }],
            relationshipCount: 1,
            truncated: false
          },
          mutation: { applied: true, profileOwnerConfirmed: true, relationshipCount: 1 },
          boundary: { personalGraphMutated: true, sharedGraphMutationAllowed: true },
          internalUserId: 'must-not-cross'
        }));
        return;
      }
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
    });
    await listen(runtime);
    const runtimeAddress = runtime.address();
    if (!runtimeAddress || typeof runtimeAddress === 'string') throw new Error('Runtime stub did not bind.');

    const gateway = createGardenPublicGateway({
      runtimeOrigin: `http://127.0.0.1:${runtimeAddress.port}`,
      rateLimitMax: 20,
      authRateLimitMax: 20,
      oauthSecret: 'test-only-oauth-secret-with-more-than-32-bytes'
    });
    await listen(gateway);
    const gatewayAddress = gateway.address();
    if (!gatewayAddress || typeof gatewayAddress === 'string') throw new Error('Gateway did not bind.');
    const origin = `http://127.0.0.1:${gatewayAddress.port}`;

    try {
      const catalog = await fetch(`${origin}/api/v1`);
      const catalogBody = await catalog.json() as Record<string, any>;
      expect(catalog.status).toBe(200);
      expect(catalogBody.entrances.person.cultivate).toBe('/api/v1/me/cultivate');
      expect(catalogBody.entrances.person.placeRelationships).toBe('/api/v1/me/garden/relationships');
      expect(catalogBody.entrances.person.transcript).toBe('/api/v1/me/transcript');
      expect(catalogBody.entrances.person.createAccount).toBe('/api/v1/me/account');
      expect(catalogBody.entrances.people.cultivate).toBe('/api/v1/community/cultivate');
      expect(catalogBody.boundary.crossPersonAccessAllowed).toBe(false);

      const anonymousPersonal = await fetch(`${origin}/api/v1/me/cultivate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-garden-request': 'personal-entrance' },
        body: JSON.stringify({ input: 'private seed' })
      });
      expect(anonymousPersonal.status).toBe(401);

      const signup = await fetch(`${origin}/api/v1/me/account`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json', 'x-garden-request': 'personal-entrance',
          cookie: 'mirror_session=discard', authorization: 'Bearer discard'
        },
        body: JSON.stringify({ username: 'gardener', email: 'person@example.com', password: 'Example2026' })
      });
      const signupResult = await signup.json() as Record<string, unknown>;
      expect(signup.status).toBe(202);
      expect(signupResult).toEqual({ message: 'Check your email to verify the account.' });
      expect(signupBody).toEqual({ username: 'gardener', email: 'person@example.com', password: 'Example2026' });
      expect(signupHeaders?.cookie).toBeUndefined();
      expect(signupHeaders?.authorization).toBeUndefined();

      const verification = await fetch(`${origin}/api/v1/me/account/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-garden-request': 'personal-entrance' },
        body: JSON.stringify({ token: 'single-use-token' })
      });
      expect(verification.status).toBe(200);
      expect(await verification.json()).toEqual({ verified: true, message: 'Email verified. You may sign in.' });

      const resend = await fetch(`${origin}/api/v1/me/account/resend-verification`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-garden-request': 'personal-entrance' },
        body: JSON.stringify({ email: 'person@example.com' })
      });
      expect(resend.status).toBe(202);

      const agentRegistration = await fetch(`${origin}/agent/auth`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'person@example.com', scope: 'garden:session:read garden:cultivate' })
      });
      const agentRegistrationBody = await agentRegistration.json() as Record<string, any>;
      expect(agentRegistration.status).toBe(202);
      expect(agentRegistrationBody.claim_token).toMatch(/^garden_claim_/);
      expect(agentRegistrationBody.verification_method).toBe('verified_email');
      expect(agentRegistrationBody.scope).toBe('garden:session:read garden:cultivate');

      const agentClaim = await fetch(`${origin}/agent/auth/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ claim_token: agentRegistrationBody.claim_token, verification_token: 'person-supplied-token' })
      });
      const agentClaimBody = await agentClaim.json() as Record<string, any>;
      expect(agentClaim.status).toBe(200);
      expect(agentClaimBody.access_token).toMatch(/^garden_at_/);
      expect(agentClaimBody).not.toHaveProperty('sessionToken');
      expect(agentClaimBody).not.toHaveProperty('user');

      const login = await fetch(`${origin}/api/v1/me/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-garden-request': 'personal-entrance' },
        body: JSON.stringify({ email: 'person@example.com', password: 'example-password' })
      });
      const loginBody = await login.json() as Record<string, any>;
      const session = login.headers.get('set-cookie')?.split(';')[0];
      expect(login.status).toBe(200);
      expect(session).toBe('mirror_session=signed-person-token');
      expect(login.headers.get('set-cookie')).toContain('HttpOnly');
      expect(login.headers.get('set-cookie')).toContain('Secure');
      expect(login.headers.get('set-cookie')).toContain('SameSite=Strict');
      expect(loginBody.user.username).toBe('gardener');
      expect(loginBody).not.toHaveProperty('token');

      const sessionRead = await fetch(`${origin}/api/v1/me/session`, {
        headers: { cookie: `other=discard; ${session}`, authorization: 'Bearer discard' }
      });
      const sessionBody = await sessionRead.json() as Record<string, any>;
      expect(sessionRead.status).toBe(200);
      expect(sessionBody.authenticated).toBe(true);
      expect(sessionBody).not.toHaveProperty('internal');
      expect(sessionHeaders?.cookie).toBe(session);
      expect(sessionHeaders?.authorization).toBeUndefined();

      const registration = await fetch(`${origin}/oauth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_name: 'Garden test helper',
          redirect_uris: ['https://client.example/callback'],
          grant_types: ['authorization_code'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none'
        })
      });
      const registrationBody = await registration.json() as Record<string, any>;
      expect(registration.status).toBe(201);
      expect(registrationBody.client_id).toMatch(/^garden_client_/);
      expect(registrationBody).not.toHaveProperty('client_secret');

      const verifier = 'garden-oauth-pkce-verifier-abcdefghijklmnopqrstuvwxyz';
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      const authorizeUrl = new URL(`${origin}/oauth/authorize`);
      authorizeUrl.search = new URLSearchParams({
        response_type: 'code',
        client_id: registrationBody.client_id,
        redirect_uri: 'https://client.example/callback',
        scope: 'garden:session:read',
        state: 'state-123',
        code_challenge: challenge,
        code_challenge_method: 'S256'
      }).toString();
      const authorizationPage = await fetch(authorizeUrl, { headers: { cookie: session! } });
      const authorizationHtml = await authorizationPage.text();
      expect(authorizationPage.status).toBe(200);
      expect(authorizationHtml).toContain('Allow Garden test helper?');
      expect(authorizationHtml).toContain('garden:session:read');
      const consentToken = authorizationHtml.match(/name="consent_token" value="([^"]+)"/)?.[1];
      expect(consentToken).toMatch(/^garden_consent_/);

      const approval = await fetch(`${origin}/oauth/authorize`, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: session! },
        body: new URLSearchParams({ consent_token: consentToken!, decision: 'approve' })
      });
      const approvalLocation = new URL(approval.headers.get('location')!);
      expect(approval.status).toBe(303);
      expect(approvalLocation.origin + approvalLocation.pathname).toBe('https://client.example/callback');
      expect(approvalLocation.searchParams.get('state')).toBe('state-123');
      expect(approvalLocation.searchParams.get('iss')).toBe('https://acommunitygarden.garden');

      const tokenRequest = new URLSearchParams({
        grant_type: 'authorization_code',
        code: approvalLocation.searchParams.get('code')!,
        client_id: registrationBody.client_id,
        redirect_uri: 'https://client.example/callback',
        code_verifier: verifier
      });
      const token = await fetch(`${origin}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: tokenRequest
      });
      const tokenBody = await token.json() as Record<string, any>;
      expect(token.status).toBe(200);
      expect(tokenBody.access_token).toMatch(/^garden_at_/);
      expect(tokenBody).not.toHaveProperty('refresh_token');

      const oauthSession = await fetch(`${origin}/api/v1/me/session`, {
        headers: { authorization: `Bearer ${tokenBody.access_token}` }
      });
      expect(oauthSession.status).toBe(200);
      expect((await oauthSession.json() as Record<string, any>).user.username).toBe('gardener');
      expect(sessionHeaders?.cookie).toBe(session);
      expect(sessionHeaders?.authorization).toBeUndefined();

      const underScoped = await fetch(`${origin}/api/v1/me/cultivate`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${tokenBody.access_token}`,
          'content-type': 'application/json',
          'x-garden-request': 'personal-entrance'
        },
        body: JSON.stringify({ input: 'private seed' })
      });
      expect(underScoped.status).toBe(403);
      expect(underScoped.headers.get('www-authenticate')).toContain('oauth-protected-resource');
      expect((await underScoped.json() as Record<string, any>).error).toBe('insufficient_scope');

      const replay = await fetch(`${origin}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: tokenRequest
      });
      expect(replay.status).toBe(400);
      expect((await replay.json() as Record<string, any>).error).toBe('invalid_grant');

      const community = await fetch(`${origin}/api/v1/community/cultivate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json', 'x-garden-request': 'community-api',
          cookie: session!, authorization: 'Bearer discard'
        },
        body: JSON.stringify({ input: 'community seed' })
      });
      const communityBody = await community.json() as Record<string, any>;
      expect(community.status).toBe(200);
      expect(communityBody.fruit.text).toBe('Shared fruit.');
      expect(communityBody.cultivation.personalContextConsulted).toBe(false);
      expect(communityBody.boundary.mode).toBe('community_api_read_only');
      expect(communityBody).not.toHaveProperty('model');
      expect(communityHeaders?.cookie).toBeUndefined();
      expect(communityHeaders?.authorization).toBeUndefined();

      const personal = await fetch(`${origin}/api/v1/me/cultivate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json', 'x-garden-request': 'personal-entrance',
          cookie: `other=discard; ${session}`, authorization: 'Bearer discard'
        },
        body: JSON.stringify({ input: 'personal seed' })
      });
      const personalBody = await personal.json() as Record<string, any>;
      expect(personal.status).toBe(200);
      expect(personalBody.fruit.text).toBe('Personal fruit.');
      expect(personalBody.cultivation.personalContextConsulted).toBe(true);
      expect(personalBody.cultivation.persisted).toBe(true);
      expect(personalBody.cultivation.persistenceLayer).toBe('private_conversation_transcript');
      expect(personalBody.comparisonReceipt.comparisons[0]).toEqual({
        observationSequence: 1, relevanceScore: 0.75, sharedTokens: ['personal', 'seed'],
        sharedPhrases: ['personal seed'], differenceCount: 1
      });
      expect(personalBody.comparisonReceipt.boundary).toEqual(expect.objectContaining({
        comparisonCreatesMeaning: false, graphMutationAllowed: false, automaticLearningAllowed: false
      }));
      expect(personalBody.comparisonReceipt.comparisons[0]).not.toHaveProperty('internalContent');
      expect(personalBody.boundary.crossPersonAccessAllowed).toBe(false);
      expect(personalBody).not.toHaveProperty('model');
      expect(personalBody).not.toHaveProperty('feedback');
      expect(personalHeaders?.cookie).toBe(session);
      expect(personalHeaders?.authorization).toBeUndefined();

      const garden = await fetch(`${origin}/api/v1/me/garden`, { headers: { cookie: session! } });
      const gardenBody = await garden.json() as Record<string, any>;
      expect(garden.status).toBe(200);
      expect(gardenBody.garden.relationships[0]).toEqual(expect.objectContaining({ source: 'mist', target: 'revision' }));
      expect(gardenBody.garden.relationships[0]).not.toHaveProperty('sourceFeedbackId');
      expect(gardenBody).not.toHaveProperty('internalUserId');
      expect(gardenHeaders?.cookie).toBe(session);
      expect(gardenBody.boundary.crossPersonAccessAllowed).toBe(false);

      const placement = await fetch(`${origin}/api/v1/me/garden/relationships`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-garden-request': 'personal-entrance', cookie: session! },
        body: JSON.stringify({
          confirmed: true,
          reviewNote: 'Explicitly approved.',
          associations: [{
            source: 'Flow', target: 'Grey', relationshipType: 'color_association', confidence: 'high',
            evidence: 'Profile owner placement.', counterexample: 'Owner may revise it.'
          }]
        })
      });
      const placementBody = await placement.json() as Record<string, any>;
      expect(placement.status).toBe(201);
      expect(placementBody.garden.relationships[0]).toEqual(expect.objectContaining({
        source: 'Flow', target: 'Grey', mutationSource: 'user_directed', profileOwnerConfirmed: true
      }));
      expect(placementBody.garden.relationships[0]).not.toHaveProperty('internalUserId');
      expect(placementBody.mutation).toEqual({ applied: true, profileOwnerConfirmed: true, relationshipCount: 1 });
      expect(placementBody.boundary).toEqual(expect.objectContaining({
        personalGraphMutated: true, sharedGraphMutationAllowed: false, colorAtlasMutationAllowed: false
      }));

      const transcript = await fetch(`${origin}/api/v1/me/transcript?limit=100`, { headers: { cookie: session! } });
      const transcriptBody = await transcript.json() as Record<string, any>;
      expect(transcript.status).toBe(200);
      expect(transcriptBody.transcript.events.map((event: Record<string, any>) => event.role)).toEqual(['user', 'assistant']);
      expect(transcriptBody.transcript.events[0]).not.toHaveProperty('internal');
      expect(transcriptBody.transcript.events[1].comparison).toEqual(expect.objectContaining({
        version: 'ari-comparison.v1', comparedObservationSequences: [1], graphMutationAllowed: false
      }));
      expect(transcriptBody.transcript.events[1].comparison).not.toHaveProperty('internal');
      expect(transcriptBody).not.toHaveProperty('internalUserId');
      expect(transcriptHeaders?.cookie).toBe(session);
      expect(transcriptBody.boundary.crossPersonAccessAllowed).toBe(false);

      const logout = await fetch(`${origin}/api/v1/me/session`, {
        method: 'DELETE', headers: { 'x-garden-request': 'personal-entrance', cookie: session! }
      });
      expect(logout.status).toBe(200);
      expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');

      expect((await fetch(`${origin}/account/me`)).status).toBe(404);
      expect((await fetch(`${origin}/local-ai/user-graph`)).status).toBe(404);
    } finally {
      await Promise.all([close(gateway), close(runtime)]);
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
  return new Promise(resolve => server.close(() => resolve()));
}
