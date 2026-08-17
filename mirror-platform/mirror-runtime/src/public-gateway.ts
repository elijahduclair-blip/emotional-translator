import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createWebBotAuthDirectoryResponse, createWebBotAuthIdentity } from './web-bot-auth';

const MAX_SEED_BODY_BYTES = 64 * 1024;
const DEFAULT_RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;
const PUBLIC_CONTENT_SIGNAL = 'search=yes, ai-input=yes, ai-train=no';
const PUBLIC_ORIGIN = 'https://acommunitygarden.garden';
const OAUTH_AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1000;
const OAUTH_ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const OAUTH_CLIENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const OAUTH_SCOPES = {
  'garden:session:read': 'Read the signed-in person account identity.',
  'garden:cultivate': 'Submit a private cultivation request using the person context.',
  'garden:graph:read': 'Read the person reviewed graph overlay.',
  'garden:graph:write': 'Place relationships only after the person explicitly confirms them.',
  'garden:transcript:read': 'Read the person ordered private conversation transcript.'
} as const;
const OAUTH_SCOPE_VALUES = Object.keys(OAUTH_SCOPES);
const PUBLIC_DISCOVERY_LINKS = [
  `<${PUBLIC_ORIGIN}/.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"`,
  `<${PUBLIC_ORIGIN}/openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json;version=3.1"`,
  `<${PUBLIC_ORIGIN}/api-docs.md>; rel="service-doc"; type="text/markdown"`,
  `<${PUBLIC_ORIGIN}/auth.md>; rel="authorization"; type="text/markdown"`,
  `<${PUBLIC_ORIGIN}/.well-known/agent-card.json>; rel="service-meta"; type="application/json"`,
  `<${PUBLIC_ORIGIN}/.well-known/agent-skills/index.json>; rel="service-meta"; type="application/json"`,
  `<${PUBLIC_ORIGIN}/.well-known/mcp/server-card.json>; rel="service-meta"; type="application/json"`,
  `<${PUBLIC_ORIGIN}/.well-known/oauth-authorization-server>; rel="authorization-server"; type="application/json"`,
  `<${PUBLIC_ORIGIN}/.well-known/oauth-protected-resource>; rel="protected-resource"; type="application/json"`,
  `<${PUBLIC_ORIGIN}/.well-known/http-message-signatures-directory>; rel="http-message-signatures-directory"; type="application/http-message-signatures-directory+json"`
].join(', ');
const entrancePage = readFileSync(join(__dirname, '..', 'public', 'entrance.html'), 'utf8');
const entranceMarkdown = readFileSync(join(__dirname, '..', 'public', 'entrance.md'), 'utf8');
const apiDocsMarkdown = readFileSync(join(__dirname, '..', 'public', 'api-docs.md'), 'utf8');
const authMarkdown = readFileSync(join(__dirname, '..', 'public', 'auth.md'), 'utf8');
const publicAgentSkills = [
  {
    name: 'read-garden-identity',
    title: 'Read Community Garden identity',
    description: 'Read the public identity, purpose, adaptation model, and non-mutation boundary of Community Garden.',
    content: readFileSync(join(__dirname, '..', 'public', 'agent-skills', 'read-garden-identity', 'SKILL.md'), 'utf8')
  },
  {
    name: 'read-ari-foundation',
    title: 'Read ARI foundation',
    description: 'Read the public foundation rules ARI uses for ordered, relational, and boundary-aware translation.',
    content: readFileSync(join(__dirname, '..', 'public', 'agent-skills', 'read-ari-foundation', 'SKILL.md'), 'utf8')
  },
  {
    name: 'inspect-ari-tool-registry',
    title: 'Inspect ARI tool registry',
    description: 'Inspect ARI team roles, tool status, declared scopes, and immutable public safety boundaries.',
    content: readFileSync(join(__dirname, '..', 'public', 'agent-skills', 'inspect-ari-tool-registry', 'SKILL.md'), 'utf8')
  }
];
const publicAgentSkillDocuments = new Map(publicAgentSkills.map(skill => [
  `/.well-known/agent-skills/${skill.name}/SKILL.md`,
  skill.content
]));
const publicMcpTools = [
  publicMcpTool('garden_identity', 'Read Community Garden identity', publicAgentSkills[0].description),
  publicMcpTool('ari_foundation', 'Read ARI foundation', publicAgentSkills[1].description),
  publicMcpTool('ari_tool_registry', 'Inspect ARI tool registry', publicAgentSkills[2].description)
];
const discoveryStyles = readFileSync(join(__dirname, '..', 'public', 'discovery.css'), 'utf8');
const publicDocuments = new Map<string, string>([
  ['/about', readFileSync(join(__dirname, '..', 'public', 'about.html'), 'utf8')],
  ['/ari', readFileSync(join(__dirname, '..', 'public', 'ari.html'), 'utf8')],
  ['/theory-of-alignment', readFileSync(join(__dirname, '..', 'public', 'theory-of-alignment.html'), 'utf8')],
  ['/privacy', readFileSync(join(__dirname, '..', 'public', 'privacy.html'), 'utf8')]
]);
const publicMarkdownDocuments = new Map<string, string>([
  ['/about', readFileSync(join(__dirname, '..', 'public', 'about.md'), 'utf8')],
  ['/ari', readFileSync(join(__dirname, '..', 'public', 'ari.md'), 'utf8')],
  ['/theory-of-alignment', readFileSync(join(__dirname, '..', 'public', 'theory-of-alignment.md'), 'utf8')],
  ['/privacy', readFileSync(join(__dirname, '..', 'public', 'privacy.md'), 'utf8')]
]);
const robotsText = `User-agent: *
Content-Signal: ${PUBLIC_CONTENT_SIGNAL}
Allow: /
Disallow: /api/
Disallow: /analytics/
Disallow: /garden/
Disallow: /health

Sitemap: https://acommunitygarden.garden/sitemap.xml
`;
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://acommunitygarden.garden/</loc><lastmod>2026-08-13</lastmod></url>
  <url><loc>https://acommunitygarden.garden/about</loc><lastmod>2026-08-13</lastmod></url>
  <url><loc>https://acommunitygarden.garden/ari</loc><lastmod>2026-08-13</lastmod></url>
  <url><loc>https://acommunitygarden.garden/theory-of-alignment</loc><lastmod>2026-08-13</lastmod></url>
  <url><loc>https://acommunitygarden.garden/privacy</loc><lastmod>2026-08-13</lastmod></url>
</urlset>
`;
const openApiJson = JSON.stringify(publicOpenApiDocument(), null, 2);
const agentSkillsIndexJson = JSON.stringify({
  $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
  skills: publicAgentSkills.map(skill => ({
    name: skill.name,
    type: 'skill-md',
    description: skill.description,
    url: `${PUBLIC_ORIGIN}/.well-known/agent-skills/${skill.name}/SKILL.md`,
    digest: `sha256:${crypto.createHash('sha256').update(skill.content).digest('hex')}`
  }))
}, null, 2);
const agentCardJson = JSON.stringify({
  protocolVersion: '1.0',
  name: 'ARI - Accountable Relational Intelligence',
  description: 'Community Garden relational translator. ARI compares ordered language, consults bounded evidence, and returns non-diagnostic relational language without autonomous learning or graph mutation.',
  supportedInterfaces: [{ url: `${PUBLIC_ORIGIN}/a2a/v1`, protocolBinding: 'HTTP+JSON' }],
  provider: { organization: 'Community Garden', url: PUBLIC_ORIGIN },
  version: 'garden-ari.v1',
  documentationUrl: `${PUBLIC_ORIGIN}/ari`,
  capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain', 'application/json'],
  skills: [{
    id: 'cultivate-public-seed',
    name: 'Cultivate a public seed',
    description: 'Translate one supplied statement through ARI without personal context, persistence, or graph mutation.',
    tags: ['relational-translation', 'theory-of-alignment', 'non-diagnostic'],
    examples: ['Help me understand the relational movement in this statement.'],
    inputModes: ['text/plain'],
    outputModes: ['text/plain', 'application/json']
  }],
  supportsAuthenticatedExtendedCard: false
}, null, 2);
const mcpServerCardJson = JSON.stringify({
  $schema: 'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
  version: '1.0',
  protocolVersion: '2025-06-18',
  serverInfo: { name: 'community-garden-ari', title: 'Community Garden ARI Public Context', version: '1.0.0' },
  description: 'A stateless, read-only MCP surface for ARI public identity, foundation, and tool-boundary discovery.',
  documentationUrl: `${PUBLIC_ORIGIN}/api-docs.md`,
  transport: { type: 'streamable-http', endpoint: '/mcp' },
  capabilities: { tools: { listChanged: false } },
  requires: {},
  authentication: { required: false, schemes: [] },
  instructions: 'Use these tools only to inspect public Garden context. This server cannot access personal plots, invoke private tools, or mutate any graph.',
  resources: [],
  tools: publicMcpTools,
  prompts: [],
  _meta: publicAgentBoundary()
}, null, 2);
const apiCatalogJson = JSON.stringify({
  linkset: [{
    anchor: `${PUBLIC_ORIGIN}/api/v1`,
    'service-desc': [{ href: `${PUBLIC_ORIGIN}/openapi.json`, type: 'application/vnd.oai.openapi+json;version=3.1' }],
    'service-doc': [{ href: `${PUBLIC_ORIGIN}/api-docs.md`, type: 'text/markdown' }],
    'service-meta': [
      { href: `${PUBLIC_ORIGIN}/auth.md`, type: 'text/markdown' },
      { href: `${PUBLIC_ORIGIN}/.well-known/agent-card.json`, type: 'application/json' },
      { href: `${PUBLIC_ORIGIN}/.well-known/agent-skills/index.json`, type: 'application/json' },
      { href: `${PUBLIC_ORIGIN}/.well-known/mcp/server-card.json`, type: 'application/json' }
    ],
    status: [{ href: `${PUBLIC_ORIGIN}/health`, type: 'application/json' }]
  }]
}, null, 2);
const oauthAuthorizationServerJson = JSON.stringify(publicOAuthAuthorizationServerMetadata(), null, 2);
const oauthProtectedResourceJson = JSON.stringify(publicOAuthProtectedResourceMetadata(), null, 2);

export interface GardenPublicGatewayOptions {
  runtimeOrigin?: string;
  rateLimitMax?: number;
  authRateLimitMax?: number;
  trustProxy?: boolean;
  oauthSecret?: string;
  webBotAuthSecret?: string;
}

interface OAuthClientRegistration {
  version: 'garden-oauth-client.v1';
  clientName: string;
  redirectUris: string[];
  issuedAt: number;
  expiresAt: number;
}

interface OAuthAuthorizationRequest {
  clientId: string;
  clientName: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes: string[];
  resource: string;
}

interface OAuthAuthorizationCode extends OAuthAuthorizationRequest {
  sessionToken: string;
  subject: string;
  expiresAt: number;
}

interface OAuthConsentEnvelope {
  version: 'garden-oauth-consent.v1';
  request: OAuthAuthorizationRequest;
  sessionHash: string;
  expiresAt: number;
}

interface OAuthAccessTokenEnvelope {
  version: 'garden-oauth-access.v1';
  issuer: string;
  audience: string;
  subject: string;
  sessionToken: string;
  scopes: string[];
  issuedAt: number;
  expiresAt: number;
}

interface AgentClaimEnvelope {
  version: 'garden-agent-claim.v1';
  claimId: string;
  scopes: string[];
  issuedAt: number;
  expiresAt: number;
}

export function createGardenPublicGateway(options: GardenPublicGatewayOptions = {}) {
  const runtimeOrigin = String(options.runtimeOrigin || 'http://127.0.0.1:3100').replace(/\/$/, '');
  const oauthSecret = oauthSecretKey(options.oauthSecret || crypto.randomBytes(32).toString('base64url'));
  const webBotAuthIdentity = options.webBotAuthSecret
    ? createWebBotAuthIdentity(options.webBotAuthSecret)
    : null;
  const oauthAuthorizationCodes = new Map<string, OAuthAuthorizationCode>();
  const limitFruit = createFixedWindowRateLimiter({
    maxRequests: options.rateLimitMax || DEFAULT_RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
    trustProxy: options.trustProxy === true
  });
  const limitSession = createFixedWindowRateLimiter({
    maxRequests: options.authRateLimitMax || 5,
    windowMs: RATE_WINDOW_MS,
    trustProxy: options.trustProxy === true
  });
  const limitAgentReads = createFixedWindowRateLimiter({
    maxRequests: 60,
    windowMs: RATE_WINDOW_MS,
    trustProxy: options.trustProxy === true
  });

  return createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://garden-entrance.local');
    const path = url.pathname;
    try {
      if ((request.method === 'GET' || request.method === 'HEAD') && (path === '/' || path === '/index.html')) {
        if (acceptsMarkdown(request)) {
          return sendStatic(response, request.method, 'text/markdown; charset=utf-8', entranceMarkdown, {
            'content-signal': PUBLIC_CONTENT_SIGNAL,
            link: PUBLIC_DISCOVERY_LINKS,
            vary: 'Accept'
          });
        }
        const visitorCookies = analyticsCookies(request, isSecureRequest(request));
        if (visitorCookies.length) response.setHeader('set-cookie', visitorCookies);
        return sendStatic(response, request.method, 'text/html; charset=utf-8', entrancePage, {
          'content-signal': PUBLIC_CONTENT_SIGNAL,
          link: PUBLIC_DISCOVERY_LINKS,
          vary: 'Accept'
        });
      }

      if ((request.method === 'GET' || request.method === 'HEAD') && publicDocuments.has(path)) {
        const markdown = acceptsMarkdown(request);
        return sendStatic(
          response,
          request.method,
          markdown ? 'text/markdown; charset=utf-8' : 'text/html; charset=utf-8',
          markdown ? publicMarkdownDocuments.get(path)! : publicDocuments.get(path)!,
          { 'content-signal': PUBLIC_CONTENT_SIGNAL, link: PUBLIC_DISCOVERY_LINKS, vary: 'Accept' }
        );
      }

      if ((request.method === 'GET' || request.method === 'HEAD') && path === '/.well-known/api-catalog') {
        return sendStatic(
          response,
          request.method,
          'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
          apiCatalogJson,
          { 'content-signal': PUBLIC_CONTENT_SIGNAL, link: PUBLIC_DISCOVERY_LINKS }
        );
      }

      if ((request.method === 'GET' || request.method === 'HEAD') && path === '/.well-known/http-message-signatures-directory') {
        if (!webBotAuthIdentity) return sendJson(response, 503, { error: 'ARI outbound request identity is not configured.' });
        const directory = createWebBotAuthDirectoryResponse(
          webBotAuthIdentity,
          String(request.headers.host || new URL(PUBLIC_ORIGIN).host)
        );
        return sendStatic(response, request.method, directory.headers['content-type'], directory.body, {
          'cache-control': directory.headers['cache-control'],
          signature: directory.headers.signature,
          'signature-input': directory.headers['signature-input'],
          'access-control-allow-origin': '*'
        });
      }

      if ((request.method === 'GET' || request.method === 'HEAD') && path === '/openapi.json') {
        return sendStatic(response, request.method, 'application/vnd.oai.openapi+json;version=3.1; charset=utf-8', openApiJson, {
          'content-signal': PUBLIC_CONTENT_SIGNAL,
          link: PUBLIC_DISCOVERY_LINKS
        });
      }

      if ((request.method === 'GET' || request.method === 'HEAD') && path === '/api-docs.md') {
        return sendStatic(response, request.method, 'text/markdown; charset=utf-8', apiDocsMarkdown, {
          'content-signal': PUBLIC_CONTENT_SIGNAL,
          link: PUBLIC_DISCOVERY_LINKS
        });
      }

      if ((request.method === 'GET' || request.method === 'HEAD') && path === '/auth.md') {
        return sendStatic(response, request.method, 'text/markdown; charset=utf-8', authMarkdown, {
          'content-signal': PUBLIC_CONTENT_SIGNAL,
          link: PUBLIC_DISCOVERY_LINKS
        });
      }

      if ((request.method === 'GET' || request.method === 'HEAD') && path === '/.well-known/oauth-authorization-server') {
        return sendStatic(response, request.method, 'application/json; charset=utf-8', oauthAuthorizationServerJson, publicDiscoveryHeaders());
      }

      if ((request.method === 'GET' || request.method === 'HEAD') && path === '/.well-known/oauth-protected-resource') {
        return sendStatic(response, request.method, 'application/json; charset=utf-8', oauthProtectedResourceJson, publicDiscoveryHeaders());
      }

      if (request.method === 'POST' && path === '/oauth/register') {
        limitSession(request, response);
        return handleOAuthRegistration(request, response, oauthSecret);
      }

      if (request.method === 'GET' && path === '/oauth/authorize') {
        return handleOAuthAuthorizationPage(request, response, url, runtimeOrigin, oauthSecret);
      }

      if (request.method === 'POST' && path === '/oauth/authorize') {
        limitSession(request, response);
        return handleOAuthAuthorizationDecision(request, response, runtimeOrigin, oauthSecret, oauthAuthorizationCodes);
      }

      if (request.method === 'POST' && path === '/oauth/token') {
        limitSession(request, response);
        return handleOAuthTokenExchange(request, response, oauthSecret, oauthAuthorizationCodes);
      }

      if (request.method === 'POST' && path === '/agent/auth') {
        limitSession(request, response);
        return handleAgentAuthRegistration(request, response, runtimeOrigin, oauthSecret);
      }

      if (request.method === 'POST' && path === '/agent/auth/claim') {
        limitSession(request, response);
        return handleAgentAuthClaim(request, response, runtimeOrigin, oauthSecret);
      }

      if ((request.method === 'GET' || request.method === 'HEAD') && path === '/.well-known/agent-card.json') {
        return sendStatic(response, request.method, 'application/json; charset=utf-8', agentCardJson, publicDiscoveryHeaders());
      }

      if ((request.method === 'GET' || request.method === 'HEAD') && path === '/.well-known/agent-skills/index.json') {
        return sendStatic(response, request.method, 'application/json; charset=utf-8', agentSkillsIndexJson, publicDiscoveryHeaders());
      }

      if ((request.method === 'GET' || request.method === 'HEAD') && publicAgentSkillDocuments.has(path)) {
        return sendStatic(response, request.method, 'text/markdown; charset=utf-8', publicAgentSkillDocuments.get(path)!, publicDiscoveryHeaders());
      }

      if ((request.method === 'GET' || request.method === 'HEAD') && (
        path === '/.well-known/mcp/server-card.json' || path === '/.well-known/mcp.json'
      )) {
        return sendStatic(response, request.method, 'application/json; charset=utf-8', mcpServerCardJson, publicDiscoveryHeaders());
      }

      if (request.method === 'OPTIONS' && path === '/mcp') {
        response.writeHead(204, {
          ...securityHeaders(),
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
          'access-control-allow-headers': 'Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id',
          'access-control-expose-headers': 'MCP-Protocol-Version'
        });
        return response.end();
      }

      if (request.method === 'GET' && path === '/mcp') {
        response.writeHead(405, {
          ...securityHeaders(),
          allow: 'POST, DELETE, OPTIONS',
          'access-control-allow-origin': '*'
        });
        return response.end();
      }

      if (request.method === 'DELETE' && path === '/mcp') {
        response.writeHead(204, { ...securityHeaders(), 'access-control-allow-origin': '*' });
        return response.end();
      }

      if (request.method === 'POST' && path === '/mcp') {
        return handlePublicMcpRequest(request, response, runtimeOrigin, () => limitAgentReads(request, response));
      }

      if (request.method === 'POST' && path === '/a2a/v1/message:send') {
        limitFruit(request, response);
        const body = await readJson(request);
        const input = a2aMessageText(body);
        if (!input) return sendProtocolJson(response, 400, {
          error: { code: 'INVALID_ARGUMENT', message: 'A2A message must contain a non-empty text part.' }
        }, 'application/a2a+json; charset=utf-8');
        const result = await runtimeJson(runtimeOrigin, '/garden/fruit', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-mirror-request': 'same-origin',
            'x-garden-entrance': 'public_entrance',
            'x-forwarded-for': clientAddress(request, options.trustProxy === true)
          },
          body: JSON.stringify({ input })
        });
        if (result.status >= 400) return sendProtocolJson(response, result.status, {
          error: { code: 'CULTIVATION_FAILED', message: publicError(result.body).error }
        }, 'application/a2a+json; charset=utf-8');
        const fruit = publicFruit(result.body);
        return sendProtocolJson(response, 200, {
          message: {
            messageId: crypto.randomUUID(),
            contextId: typeof body.message === 'object' && body.message ? String((body.message as Record<string, unknown>).contextId || crypto.randomUUID()) : crypto.randomUUID(),
            role: 'ROLE_AGENT',
            parts: [{ text: fruit.fruit.text }],
            metadata: { version: fruit.version, cultivation: fruit.cultivation, boundary: fruit.boundary }
          }
        }, 'application/a2a+json; charset=utf-8');
      }

      if ((request.method === 'GET' || request.method === 'HEAD') && path === '/discovery.css') {
        return sendStatic(response, request.method, 'text/css; charset=utf-8', discoveryStyles);
      }

      if ((request.method === 'GET' || request.method === 'HEAD') && path === '/robots.txt') {
        return sendStatic(response, request.method, 'text/plain; charset=utf-8', robotsText);
      }

      if ((request.method === 'GET' || request.method === 'HEAD') && path === '/sitemap.xml') {
        return sendStatic(response, request.method, 'application/xml; charset=utf-8', sitemapXml);
      }

      if (request.method === 'GET' && path === '/health') {
        return sendJson(response, 200, { status: 'ready', entrance: 'open', version: 'garden-entrance.v1' });
      }

      if (request.method === 'GET' && path === '/api/v1') {
        return sendJson(response, 200, publicApiIdentity());
      }

      if (request.method === 'GET' && path === '/garden/identity') {
        const result = await runtimeJson(runtimeOrigin, '/garden/identity');
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 200, publicIdentity(result.body));
      }

      if (request.method === 'GET' && path === '/api/v1/ari/foundation') {
        const result = await runtimeJson(runtimeOrigin, '/api/v1/ari/foundation');
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 200, result.body);
      }

      if (request.method === 'GET' && path === '/api/v1/ari/tools') {
        const result = await runtimeJson(runtimeOrigin, '/api/v1/ari/tools');
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 200, result.body);
      }

      if (request.method === 'POST' && path === '/analytics/visit') {
        requirePublicEntranceRequest(request);
        const body = await readJson(request);
        const result = await runtimeJson(runtimeOrigin, '/analytics/visit', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-mirror-request': 'same-origin',
            'x-garden-entrance': 'public_entrance',
            ...forwardAnalyticsHeaders(request),
            ...(request.headers.cookie ? { cookie: String(request.headers.cookie) } : {})
          },
          body: JSON.stringify({ room: String(body.room || '') })
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 202, { recorded: true, contentStored: false });
      }

      if (request.method === 'POST' && path === '/garden/fruit') {
        requirePublicEntranceRequest(request);
        limitFruit(request, response);
        const body = await readJson(request);
        const input = typeof body.input === 'string' ? body.input.trim() : '';
        if (!input) return sendJson(response, 400, { error: 'A seed of information is required.' });
        const result = await runtimeJson(runtimeOrigin, '/garden/fruit', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-mirror-request': 'same-origin',
            'x-garden-entrance': 'public_entrance',
            ...forwardAnalyticsHeaders(request),
            'x-forwarded-for': clientAddress(request, options.trustProxy === true)
          },
          body: JSON.stringify({ input })
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 200, publicFruit(result.body));
      }

      if (request.method === 'POST' && path === '/api/v1/community/cultivate') {
        requireGardenRequest(request, 'community-api');
        limitFruit(request, response);
        const body = await readJson(request);
        const input = typeof body.input === 'string' ? body.input.trim() : '';
        if (!input) return sendJson(response, 400, { error: 'A seed of information is required.' });
        const result = await runtimeJson(runtimeOrigin, '/api/v1/community/cultivate', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-mirror-request': 'same-origin',
            ...forwardAnalyticsHeaders(request),
            'x-forwarded-for': clientAddress(request, options.trustProxy === true)
          },
          body: JSON.stringify({ input })
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 200, publicCommunityFruit(result.body));
      }

      if (request.method === 'POST' && path === '/api/v1/me/session') {
        requireGardenRequest(request, 'personal-entrance');
        limitSession(request, response);
        const result = await runtimeJson(runtimeOrigin, '/api/v1/me/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
          body: JSON.stringify(await readJson(request))
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        response.setHeader('set-cookie', secureSessionCookie(result.headers.get('set-cookie')));
        return sendJson(response, 200, publicSession(result.body));
      }

      if (request.method === 'POST' && path === '/api/v1/me/account') {
        requireGardenRequest(request, 'personal-entrance');
        limitSession(request, response);
        const body = await readJson(request);
        const result = await runtimeJson(runtimeOrigin, '/api/v1/me/account', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
          body: JSON.stringify({
            username: String(body.username || '').trim().slice(0, 80),
            email: String(body.email || '').trim().slice(0, 254),
            password: String(body.password || '').slice(0, 256)
          })
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 202, publicAccountAction(result.body, 'Check your email to verify the account.'));
      }

      if (request.method === 'POST' && path === '/api/v1/me/account/verify') {
        requireGardenRequest(request, 'personal-entrance');
        limitSession(request, response);
        const body = await readJson(request);
        const result = await runtimeJson(runtimeOrigin, '/api/v1/me/account/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
          body: JSON.stringify({ token: String(body.token || '').slice(0, 512) })
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 200, { verified: result.body.verified === true, message: 'Email verified. You may sign in.' });
      }

      if (request.method === 'POST' && path === '/api/v1/me/account/resend-verification') {
        requireGardenRequest(request, 'personal-entrance');
        limitSession(request, response);
        const body = await readJson(request);
        const result = await runtimeJson(runtimeOrigin, '/api/v1/me/account/resend-verification', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
          body: JSON.stringify({ email: String(body.email || '').trim().slice(0, 254) })
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 202, publicAccountAction(result.body, 'If the account can receive this request, an email has been sent.'));
      }

      if (request.method === 'GET' && path === '/api/v1/me/session') {
        const result = await runtimeJson(runtimeOrigin, '/api/v1/me/session', {
          headers: { cookie: requirePersonalCredential(request, oauthSecret, ['garden:session:read']) }
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 200, publicSession(result.body));
      }

      if (request.method === 'DELETE' && path === '/api/v1/me/session') {
        requireGardenRequest(request, 'personal-entrance');
        const result = await runtimeJson(runtimeOrigin, '/api/v1/me/session', {
          method: 'DELETE',
          headers: { 'x-mirror-request': 'same-origin', cookie: requirePersonalSession(request) }
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        response.setHeader('set-cookie', secureSessionCookie(null, true));
        return sendJson(response, 200, { signedOut: true });
      }

      if (request.method === 'POST' && path === '/api/v1/me/cultivate') {
        requireGardenRequest(request, 'personal-entrance');
        limitFruit(request, response);
        const body = await readJson(request);
        const input = typeof body.input === 'string' ? body.input.trim() : '';
        if (!input) return sendJson(response, 400, { error: 'A seed of information is required.' });
        const result = await runtimeJson(runtimeOrigin, '/api/v1/me/cultivate', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-mirror-request': 'same-origin',
            ...forwardAnalyticsHeaders(request),
            'x-forwarded-for': clientAddress(request, options.trustProxy === true),
            cookie: requirePersonalCredential(request, oauthSecret, ['garden:cultivate'])
          },
          body: JSON.stringify({ input })
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 200, publicPersonalFruit(result.body));
      }

      if (request.method === 'GET' && path === '/api/v1/me/garden') {
        const result = await runtimeJson(runtimeOrigin, '/api/v1/me/garden', {
          headers: { cookie: requirePersonalCredential(request, oauthSecret, ['garden:graph:read']) }
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 200, publicPersonalGarden(result.body));
      }

      if (request.method === 'POST' && path === '/api/v1/me/garden/relationships') {
        requireGardenRequest(request, 'personal-entrance');
        const body = await readJson(request);
        const associations = Array.isArray(body.associations) ? body.associations : [];
        if (associations.length > 12) return sendJson(response, 400, { error: 'No more than 12 personal relationships may be placed at once.' });
        const result = await runtimeJson(runtimeOrigin, '/api/v1/me/garden/relationships', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-mirror-request': 'same-origin',
            cookie: requirePersonalCredential(request, oauthSecret, ['garden:graph:write'])
          },
          body: JSON.stringify({
            confirmed: body.confirmed === true,
            reviewNote: String(body.reviewNote || '').slice(0, 1_000),
            associations: associations.map((association: Record<string, any>) => ({
              source: String(association?.source || '').slice(0, 120),
              target: String(association?.target || '').slice(0, 120),
              relationshipType: String(association?.relationshipType || '').slice(0, 80),
              confidence: String(association?.confidence || '').slice(0, 16),
              evidence: String(association?.evidence || '').slice(0, 1_000),
              counterexample: String(association?.counterexample || '').slice(0, 1_000)
            }))
          })
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 201, publicPersonalGardenMutation(result.body));
      }

      if (request.method === 'GET' && path === '/api/v1/me/transcript') {
        const query = new URLSearchParams();
        if (url.searchParams.has('limit')) query.set('limit', String(url.searchParams.get('limit')));
        if (url.searchParams.has('before')) query.set('before', String(url.searchParams.get('before')));
        const suffix = query.size ? `?${query}` : '';
        const result = await runtimeJson(runtimeOrigin, `/api/v1/me/transcript${suffix}`, {
          headers: { cookie: requirePersonalCredential(request, oauthSecret, ['garden:transcript:read']) }
        });
        if (result.status >= 400) return sendJson(response, result.status, publicError(result.body));
        return sendJson(response, 200, publicPersonalTranscript(result.body));
      }

      return sendJson(response, 404, { error: 'This path is not part of the public Garden Entrance.' });
    } catch (error) {
      const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 500;
      const message = status >= 500 ? 'The Garden Entrance is temporarily unavailable.' : error instanceof Error ? error.message : 'Request failed.';
      const code = oauthCode(error, 'invalid_token');
      if ((status === 401 || status === 403) && path.startsWith('/api/v1/me/')) response.setHeader('www-authenticate', oauthChallenge(code, message));
      if (typeof (error as { oauthCode?: unknown })?.oauthCode === 'string') {
        return sendJson(response, status, { error: code, error_description: message });
      }
      return sendJson(response, status, { error: message });
    }
  });
}

function publicOAuthAuthorizationServerMetadata() {
  return {
    issuer: PUBLIC_ORIGIN,
    authorization_endpoint: `${PUBLIC_ORIGIN}/oauth/authorize`,
    token_endpoint: `${PUBLIC_ORIGIN}/oauth/token`,
    registration_endpoint: `${PUBLIC_ORIGIN}/oauth/register`,
    scopes_supported: OAUTH_SCOPE_VALUES,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${PUBLIC_ORIGIN}/auth.md`,
    protected_resources: [PUBLIC_ORIGIN],
    agent_auth: {
      skill: `${PUBLIC_ORIGIN}/auth.md`,
      register_uri: `${PUBLIC_ORIGIN}/agent/auth`,
      claim_uri: `${PUBLIC_ORIGIN}/agent/auth/claim`,
      identity_types_supported: ['identity_assertion'],
      identity_assertion: {
        assertion_types_supported: ['verified_email'],
        credential_types_supported: ['access_token']
      }
    }
  };
}

function publicOAuthProtectedResourceMetadata() {
  return {
    resource: PUBLIC_ORIGIN,
    authorization_servers: [PUBLIC_ORIGIN],
    bearer_methods_supported: ['header'],
    scopes_supported: OAUTH_SCOPE_VALUES,
    resource_documentation: `${PUBLIC_ORIGIN}/auth.md`
  };
}

async function handleOAuthRegistration(request: IncomingMessage, response: ServerResponse, secret: Buffer) {
  try {
    const body = await readJson(request);
    const redirectUris = validateOAuthRedirectUris(body.redirect_uris);
    if (body.token_endpoint_auth_method !== undefined && body.token_endpoint_auth_method !== 'none') {
      throw oauthError(400, 'invalid_client_metadata', 'Only public clients using token_endpoint_auth_method "none" are supported.');
    }
    const requestedGrantTypes = body.grant_types === undefined ? ['authorization_code'] : safeStringArray(body.grant_types);
    const requestedResponseTypes = body.response_types === undefined ? ['code'] : safeStringArray(body.response_types);
    if (requestedGrantTypes.length !== 1 || requestedGrantTypes[0] !== 'authorization_code') {
      throw oauthError(400, 'invalid_client_metadata', 'Only the authorization_code grant is supported.');
    }
    if (requestedResponseTypes.length !== 1 || requestedResponseTypes[0] !== 'code') {
      throw oauthError(400, 'invalid_client_metadata', 'Only the code response type is supported.');
    }
    const now = Date.now();
    const registration: OAuthClientRegistration = {
      version: 'garden-oauth-client.v1',
      clientName: String(body.client_name || 'Registered Garden client').trim().slice(0, 120) || 'Registered Garden client',
      redirectUris,
      issuedAt: now,
      expiresAt: now + OAUTH_CLIENT_TTL_MS
    };
    const clientId = `garden_client_${sealOAuthEnvelope(registration, secret, 'client')}`;
    return sendJson(response, 201, {
      client_id: clientId,
      client_id_issued_at: Math.floor(now / 1000),
      client_id_expires_at: Math.floor(registration.expiresAt / 1000),
      client_name: registration.clientName,
      redirect_uris: registration.redirectUris,
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none'
    });
  } catch (error) {
    return sendOAuthJsonError(response, error, 'invalid_client_metadata');
  }
}

async function handleAgentAuthRegistration(
  request: IncomingMessage,
  response: ServerResponse,
  runtimeOrigin: string,
  secret: Buffer
) {
  try {
    const body = await readJson(request);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw oauthError(400, 'invalid_request', 'A valid verified account email is required.');
    const scopes = validateOAuthScopes(typeof body.scope === 'string' ? body.scope : null);
    const result = await runtimeJson(runtimeOrigin, '/api/v1/agent/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
      body: JSON.stringify({ email })
    });
    if (result.status >= 400) throw oauthError(result.status, 'temporarily_unavailable', String(result.body?.error || 'The verification request could not be started.'));
    const claimId = String(result.body?.claimId || '');
    if (!claimId) throw oauthError(502, 'server_error', 'The verification request could not be established.');
    const now = Date.now();
    const claim: AgentClaimEnvelope = {
      version: 'garden-agent-claim.v1',
      claimId,
      scopes,
      issuedAt: now,
      expiresAt: now + 10 * 60 * 1000
    };
    return sendJson(response, 202, {
      status: 'pending_user_verification',
      claim_token: `garden_claim_${sealOAuthEnvelope(claim, secret, 'agent-claim')}`,
      claim_uri: `${PUBLIC_ORIGIN}/agent/auth/claim`,
      verification_method: 'verified_email',
      expires_in: 600,
      scope: scopes.join(' '),
      message: 'If the verified account can receive this request, a one-time verification token has been sent. Ask the person for that token; do not access their mailbox.'
    });
  } catch (error) {
    return sendOAuthJsonError(response, error, 'invalid_request');
  }
}

async function handleAgentAuthClaim(
  request: IncomingMessage,
  response: ServerResponse,
  runtimeOrigin: string,
  secret: Buffer
) {
  try {
    const body = await readJson(request);
    const claimToken = String(body.claim_token || '');
    const verificationToken = String(body.verification_token || '');
    if (!claimToken.startsWith('garden_claim_') || !verificationToken) throw oauthError(400, 'invalid_grant', 'The agent claim is invalid or expired.');
    const claim = openOAuthEnvelope<AgentClaimEnvelope>(claimToken.slice('garden_claim_'.length), secret, 'agent-claim');
    if (claim.version !== 'garden-agent-claim.v1' || claim.expiresAt <= Date.now()) throw oauthError(400, 'invalid_grant', 'The agent claim is invalid or expired.');
    const scopes = validateOAuthScopes(claim.scopes.join(' '));
    const result = await runtimeJson(runtimeOrigin, '/api/v1/agent/auth/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mirror-request': 'same-origin' },
      body: JSON.stringify({ claimId: claim.claimId, verificationToken: verificationToken.slice(0, 512) })
    });
    if (result.status >= 400) throw oauthError(400, 'invalid_grant', 'The agent claim is invalid or expired.');
    const sessionToken = String(result.body?.token || '');
    const subject = String(result.body?.user?.id || '');
    if (!sessionToken || !subject) throw oauthError(502, 'server_error', 'The Garden session could not be established.');
    const now = Date.now();
    const access: OAuthAccessTokenEnvelope = {
      version: 'garden-oauth-access.v1',
      issuer: PUBLIC_ORIGIN,
      audience: PUBLIC_ORIGIN,
      subject,
      sessionToken,
      scopes,
      issuedAt: now,
      expiresAt: now + OAUTH_ACCESS_TOKEN_TTL_MS
    };
    return sendJson(response, 200, {
      access_token: `garden_at_${sealOAuthEnvelope(access, secret, 'access')}`,
      token_type: 'Bearer',
      expires_in: Math.floor(OAUTH_ACCESS_TOKEN_TTL_MS / 1000),
      scope: scopes.join(' ')
    });
  } catch (error) {
    return sendOAuthJsonError(response, error, 'invalid_grant');
  }
}

async function handleOAuthAuthorizationPage(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  runtimeOrigin: string,
  secret: Buffer
) {
  try {
    const authorization = parseOAuthAuthorizationRequest(url.searchParams, secret);
    const sessionCookie = requirePersonalSession(request);
    const session = await runtimeJson(runtimeOrigin, '/api/v1/me/session', { headers: { cookie: sessionCookie } });
    if (session.status >= 400) throw oauthError(401, 'login_required', 'Sign in to Community Garden before approving access.');
    const consent: OAuthConsentEnvelope = {
      version: 'garden-oauth-consent.v1',
      request: authorization,
      sessionHash: sha256Base64Url(sessionCookie),
      expiresAt: Date.now() + 10 * 60 * 1000
    };
    const consentToken = `garden_consent_${sealOAuthEnvelope(consent, secret, 'consent')}`;
    return sendOAuthHtml(response, 200, oauthApprovalHtml(session.body.user || {}, authorization, consentToken));
  } catch (error) {
    const status = oauthStatus(error, 400);
    const description = oauthDescription(error, 'The authorization request is invalid.');
    if (status === 401) response.setHeader('www-authenticate', oauthChallenge());
    return sendOAuthHtml(response, status, oauthMessageHtml(
      status === 401 ? 'Sign in before authorizing' : 'Authorization request rejected',
      description,
      status === 401 ? `${PUBLIC_ORIGIN}/#account` : undefined
    ));
  }
}

async function handleOAuthAuthorizationDecision(
  request: IncomingMessage,
  response: ServerResponse,
  runtimeOrigin: string,
  secret: Buffer,
  authorizationCodes: Map<string, OAuthAuthorizationCode>
) {
  let authorization: OAuthAuthorizationRequest | undefined;
  try {
    const form = await readForm(request);
    const sessionCookie = requirePersonalSession(request);
    const consentToken = String(form.get('consent_token') || '');
    if (!consentToken.startsWith('garden_consent_')) throw oauthError(400, 'invalid_request', 'The approval receipt is missing or invalid.');
    const consent = openOAuthEnvelope<OAuthConsentEnvelope>(consentToken.slice('garden_consent_'.length), secret, 'consent');
    if (consent.version !== 'garden-oauth-consent.v1' || consent.expiresAt <= Date.now()) {
      throw oauthError(400, 'invalid_request', 'The approval receipt expired. Start authorization again.');
    }
    if (!constantTimeEqual(consent.sessionHash, sha256Base64Url(sessionCookie))) {
      throw oauthError(400, 'invalid_request', 'The approval receipt does not belong to this signed-in session.');
    }
    authorization = validateStoredAuthorizationRequest(consent.request, secret);
    const decision = String(form.get('decision') || 'deny');
    if (decision !== 'approve') {
      return redirectOAuthAuthorization(response, authorization.redirectUri, {
        error: 'access_denied',
        error_description: 'The person did not approve this request.',
        state: authorization.state,
        iss: PUBLIC_ORIGIN
      });
    }
    const session = await runtimeJson(runtimeOrigin, '/api/v1/me/session', { headers: { cookie: sessionCookie } });
    if (session.status >= 400) throw oauthError(401, 'login_required', 'The Garden session expired. Sign in and try again.');
    removeExpiredAuthorizationCodes(authorizationCodes);
    const code = crypto.randomBytes(32).toString('base64url');
    authorizationCodes.set(code, {
      ...authorization,
      sessionToken: personalSessionToken(sessionCookie),
      subject: String(session.body.user?.id || ''),
      expiresAt: Date.now() + OAUTH_AUTHORIZATION_CODE_TTL_MS
    });
    return redirectOAuthAuthorization(response, authorization.redirectUri, {
      code,
      state: authorization.state,
      iss: PUBLIC_ORIGIN
    });
  } catch (error) {
    if (authorization) {
      return redirectOAuthAuthorization(response, authorization.redirectUri, {
        error: oauthCode(error, 'invalid_request'),
        error_description: oauthDescription(error, 'The authorization request could not be completed.'),
        state: authorization.state,
        iss: PUBLIC_ORIGIN
      });
    }
    return sendOAuthHtml(response, oauthStatus(error, 400), oauthMessageHtml(
      'Authorization request rejected',
      oauthDescription(error, 'The authorization request could not be completed.')
    ));
  }
}

async function handleOAuthTokenExchange(
  request: IncomingMessage,
  response: ServerResponse,
  secret: Buffer,
  authorizationCodes: Map<string, OAuthAuthorizationCode>
) {
  try {
    const form = await readForm(request);
    if (form.get('grant_type') !== 'authorization_code') throw oauthError(400, 'unsupported_grant_type', 'Only authorization_code is supported.');
    const code = String(form.get('code') || '');
    const authorization = authorizationCodes.get(code);
    authorizationCodes.delete(code);
    if (!authorization || authorization.expiresAt <= Date.now()) throw oauthError(400, 'invalid_grant', 'The authorization code is invalid, expired, or already used.');
    validateStoredAuthorizationRequest(authorization, secret);
    if (String(form.get('client_id') || '') !== authorization.clientId) throw oauthError(400, 'invalid_grant', 'The client identifier does not match the authorization code.');
    if (String(form.get('redirect_uri') || '') !== authorization.redirectUri) throw oauthError(400, 'invalid_grant', 'The redirect address does not match the authorization code.');
    const verifier = String(form.get('code_verifier') || '');
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) throw oauthError(400, 'invalid_grant', 'A valid PKCE code_verifier is required.');
    if (!constantTimeEqual(sha256Base64Url(verifier), authorization.codeChallenge)) {
      throw oauthError(400, 'invalid_grant', 'PKCE verification failed.');
    }
    const now = Date.now();
    const access: OAuthAccessTokenEnvelope = {
      version: 'garden-oauth-access.v1',
      issuer: PUBLIC_ORIGIN,
      audience: PUBLIC_ORIGIN,
      subject: authorization.subject,
      sessionToken: authorization.sessionToken,
      scopes: authorization.scopes,
      issuedAt: now,
      expiresAt: now + OAUTH_ACCESS_TOKEN_TTL_MS
    };
    return sendJson(response, 200, {
      access_token: `garden_at_${sealOAuthEnvelope(access, secret, 'access')}`,
      token_type: 'Bearer',
      expires_in: Math.floor(OAUTH_ACCESS_TOKEN_TTL_MS / 1000),
      scope: authorization.scopes.join(' ')
    });
  } catch (error) {
    return sendOAuthJsonError(response, error, 'invalid_request');
  }
}

function parseOAuthAuthorizationRequest(params: URLSearchParams, secret: Buffer): OAuthAuthorizationRequest {
  if (params.get('response_type') !== 'code') throw oauthError(400, 'unsupported_response_type', 'Only response_type=code is supported.');
  const clientId = String(params.get('client_id') || '');
  const client = decodeOAuthClient(clientId, secret);
  const redirectUri = String(params.get('redirect_uri') || '');
  if (!client.redirectUris.includes(redirectUri)) throw oauthError(400, 'invalid_request', 'The redirect address is not registered for this client.');
  const codeChallenge = String(params.get('code_challenge') || '');
  if (params.get('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge)) {
    throw oauthError(400, 'invalid_request', 'PKCE with code_challenge_method=S256 is required.');
  }
  const requestedResource = String(params.get('resource') || PUBLIC_ORIGIN);
  if (requestedResource !== PUBLIC_ORIGIN) throw oauthError(400, 'invalid_target', 'The requested resource is not served by this authorization server.');
  const scopes = validateOAuthScopes(params.get('scope'));
  const state = String(params.get('state') || '').slice(0, 512);
  return { clientId, clientName: client.clientName, redirectUri, state, codeChallenge, scopes, resource: requestedResource };
}

function validateStoredAuthorizationRequest(value: OAuthAuthorizationRequest, secret: Buffer) {
  const client = decodeOAuthClient(value.clientId, secret);
  if (!client.redirectUris.includes(value.redirectUri)) throw oauthError(400, 'invalid_request', 'The redirect registration is no longer valid.');
  validateOAuthScopes(value.scopes.join(' '));
  if (value.resource !== PUBLIC_ORIGIN) throw oauthError(400, 'invalid_target', 'The requested resource is not served here.');
  return value;
}

function decodeOAuthClient(clientId: string, secret: Buffer) {
  if (!clientId.startsWith('garden_client_')) throw oauthError(400, 'invalid_client', 'Register this public client before requesting authorization.');
  const client = openOAuthEnvelope<OAuthClientRegistration>(clientId.slice('garden_client_'.length), secret, 'client');
  if (client.version !== 'garden-oauth-client.v1' || client.expiresAt <= Date.now()) throw oauthError(400, 'invalid_client', 'The client registration is invalid or expired.');
  validateOAuthRedirectUris(client.redirectUris);
  return client;
}

function validateOAuthRedirectUris(value: unknown) {
  const redirectUris = safeStringArray(value);
  if (!redirectUris.length || redirectUris.length > 5) throw oauthError(400, 'invalid_client_metadata', 'One to five redirect_uris are required.');
  const unique = [...new Set(redirectUris)];
  if (unique.length !== redirectUris.length) throw oauthError(400, 'invalid_client_metadata', 'redirect_uris must not contain duplicates.');
  for (const redirectUri of redirectUris) {
    let url: URL;
    try { url = new URL(redirectUri); } catch { throw oauthError(400, 'invalid_client_metadata', 'Every redirect URI must be an absolute address.'); }
    if (url.hash || url.username || url.password) throw oauthError(400, 'invalid_client_metadata', 'Redirect URIs must not contain fragments or user information.');
    const loopback = url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === '[::1]' || url.hostname === '::1');
    if (url.protocol !== 'https:' && !loopback) throw oauthError(400, 'invalid_client_metadata', 'Redirect URIs must use HTTPS or an HTTP loopback IP address.');
  }
  return unique;
}

function validateOAuthScopes(value: string | null) {
  const scopes = value ? [...new Set(value.split(/\s+/).filter(Boolean))] : ['garden:session:read'];
  if (!scopes.length || scopes.some(scope => !OAUTH_SCOPE_VALUES.includes(scope))) {
    throw oauthError(400, 'invalid_scope', 'One or more requested Garden scopes are not supported.');
  }
  return scopes;
}

function requirePersonalCredential(request: IncomingMessage, secret: Buffer, requiredScopes: string[]) {
  const cookie = personalSessionCookie(request);
  if (cookie) return cookie;
  const authorization = String(request.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) throw oauthError(401, 'invalid_token', 'Authentication required.');
  const token = authorization.slice('Bearer '.length).trim();
  if (!token.startsWith('garden_at_')) throw oauthError(401, 'invalid_token', 'The Garden access token is invalid.');
  let access: OAuthAccessTokenEnvelope;
  try { access = openOAuthEnvelope<OAuthAccessTokenEnvelope>(token.slice('garden_at_'.length), secret, 'access'); }
  catch { throw oauthError(401, 'invalid_token', 'The Garden access token is invalid.'); }
  if (access.version !== 'garden-oauth-access.v1' || access.issuer !== PUBLIC_ORIGIN || access.audience !== PUBLIC_ORIGIN || access.expiresAt <= Date.now()) {
    throw oauthError(401, 'invalid_token', 'The Garden access token is invalid or expired.');
  }
  if (requiredScopes.some(scope => !access.scopes.includes(scope))) throw oauthError(403, 'insufficient_scope', `Required scope: ${requiredScopes.join(' ')}`);
  return `mirror_session=${encodeURIComponent(access.sessionToken)}`;
}

function personalSessionCookie(request: IncomingMessage) {
  return String(request.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith('mirror_session=') && value !== 'mirror_session=');
}

function personalSessionToken(cookie: string) {
  const value = cookie.slice(cookie.indexOf('=') + 1);
  if (!value) throw oauthError(401, 'invalid_token', 'The signed-in Garden session is unavailable.');
  try { return decodeURIComponent(value); } catch { throw oauthError(401, 'invalid_token', 'The signed-in Garden session is invalid.'); }
}

function oauthSecretKey(value: string) {
  return crypto.createHash('sha256').update(`community-garden-oauth.v1\0${value}`).digest();
}

function sealOAuthEnvelope(value: unknown, secret: Buffer, purpose: string) {
  const nonce = crypto.randomBytes(12);
  const key = crypto.createHmac('sha256', secret).update(`garden-oauth:${purpose}:v1`).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(`garden-oauth:${purpose}:v1`));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64url');
}

function openOAuthEnvelope<T>(value: string, secret: Buffer, purpose: string): T {
  const packed = Buffer.from(value, 'base64url');
  if (packed.length < 29) throw new Error('Invalid OAuth envelope.');
  const nonce = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const encrypted = packed.subarray(28);
  const key = crypto.createHmac('sha256', secret).update(`garden-oauth:${purpose}:v1`).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(Buffer.from(`garden-oauth:${purpose}:v1`));
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')) as T;
}

function sha256Base64Url(value: string) {
  return crypto.createHash('sha256').update(value).digest('base64url');
}

function constantTimeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function safeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : [];
}

async function readForm(request: IncomingMessage) {
  const contentType = String(request.headers['content-type'] || '').toLowerCase();
  if (!contentType.startsWith('application/x-www-form-urlencoded')) throw oauthError(415, 'invalid_request', 'Content-Type must be application/x-www-form-urlencoded.');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_SEED_BODY_BYTES) throw oauthError(413, 'invalid_request', 'The OAuth request exceeds 64 KB.');
    chunks.push(buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function oauthApprovalHtml(user: Record<string, unknown>, authorization: OAuthAuthorizationRequest, consentToken: string) {
  const scopeItems = authorization.scopes.map(scope => `<li><code>${escapeHtml(scope)}</code> - ${escapeHtml(OAUTH_SCOPES[scope as keyof typeof OAUTH_SCOPES])}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Authorize ${escapeHtml(authorization.clientName)}</title><style>body{font-family:system-ui,sans-serif;max-width:42rem;margin:4rem auto;padding:0 1rem;color:#16221b;background:#f4f2e9}main{background:#fff;border:1px solid #cad5cc;border-radius:18px;padding:2rem}button{padding:.8rem 1.2rem;margin:.5rem .5rem 0 0;border-radius:999px;border:1px solid #273c30}button[value=approve]{background:#173c2b;color:#fff}code{font-size:.9em}small{color:#526158}</style></head><body><main><p>Community Garden OAuth</p><h1>Allow ${escapeHtml(authorization.clientName)}?</h1><p>Signed in as <strong>${escapeHtml(String(user.username || user.email || 'Garden account'))}</strong>.</p><p>This registered client is asking to:</p><ul>${scopeItems}</ul><p><small>Redirect address: ${escapeHtml(authorization.redirectUri)}. Approval does not grant administrator access, cross-person access, or shared graph mutation.</small></p><form method="post" action="/oauth/authorize"><input type="hidden" name="consent_token" value="${escapeHtml(consentToken)}"><button type="submit" name="decision" value="approve">Allow once</button><button type="submit" name="decision" value="deny">Deny</button></form></main></body></html>`;
}

function oauthMessageHtml(title: string, message: string, link?: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${link ? `<p><a href="${escapeHtml(link)}">Open the Community Garden account room</a></p>` : ''}</main></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}

function redirectOAuthAuthorization(response: ServerResponse, redirectUri: string, values: Record<string, string>) {
  const location = new URL(redirectUri);
  for (const [name, value] of Object.entries(values)) if (value) location.searchParams.set(name, value);
  response.writeHead(303, { ...securityHeaders(), location: location.toString(), 'cache-control': 'no-store' });
  return response.end();
}

function sendOAuthHtml(response: ServerResponse, status: number, html: string) {
  response.writeHead(status, { ...securityHeaders(), 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  return response.end(html);
}

function removeExpiredAuthorizationCodes(codes: Map<string, OAuthAuthorizationCode>) {
  const now = Date.now();
  for (const [code, authorization] of codes) if (authorization.expiresAt <= now) codes.delete(code);
}

function oauthChallenge(error = 'invalid_token', description = 'A valid Garden OAuth access token is required.') {
  return `Bearer realm="Community Garden", resource_metadata="${PUBLIC_ORIGIN}/.well-known/oauth-protected-resource", error="${error}", error_description="${description.replace(/["\\]/g, '')}"`;
}

function oauthError(status: number, code: string, description: string) {
  return Object.assign(new Error(description), { status, oauthCode: code });
}

function oauthStatus(error: unknown, fallback: number) {
  return typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : fallback;
}

function oauthCode(error: unknown, fallback: string) {
  return typeof (error as { oauthCode?: unknown })?.oauthCode === 'string' ? (error as { oauthCode: string }).oauthCode : fallback;
}

function oauthDescription(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function sendOAuthJsonError(response: ServerResponse, error: unknown, fallbackCode: string) {
  const status = oauthStatus(error, 400);
  if (status === 401 || status === 403) response.setHeader('www-authenticate', oauthChallenge(oauthCode(error, fallbackCode), oauthDescription(error, 'Authorization failed.')));
  return sendJson(response, status, { error: oauthCode(error, fallbackCode), error_description: oauthDescription(error, 'Authorization failed.') });
}

async function runtimeJson(origin: string, path: string, init?: RequestInit) {
  const response = await fetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(70_000) });
  const body = await response.json().catch(() => ({})) as Record<string, any>;
  return { status: response.status, body, headers: response.headers };
}

function publicApiIdentity() {
  return {
    version: 'garden-api.v1',
    name: 'Community Garden API',
    ariFoundation: '/api/v1/ari/foundation',
    ariTools: '/api/v1/ari/tools',
    oauth: {
      discovery: '/.well-known/oauth-authorization-server',
      protectedResource: '/.well-known/oauth-protected-resource',
      registration: '/oauth/register'
    },
    entrances: {
      person: {
        session: '/api/v1/me/session',
        createAccount: '/api/v1/me/account',
        verifyAccount: '/api/v1/me/account/verify',
        cultivate: '/api/v1/me/cultivate',
        garden: '/api/v1/me/garden',
        placeRelationships: '/api/v1/me/garden/relationships',
        transcript: '/api/v1/me/transcript',
        requestHeader: 'x-garden-request: personal-entrance'
      },
      people: {
        cultivate: '/api/v1/community/cultivate',
        requestHeader: 'x-garden-request: community-api'
      }
    },
    boundary: {
      crossPersonAccessAllowed: false,
      personalMemoryAvailableToCommunity: false,
      automaticLearningAllowed: false,
      sharedGraphMutationAllowed: false
    }
  };
}

function publicOpenApiDocument() {
  const jsonResponse = (description: string) => ({ description, content: { 'application/json': { schema: { type: 'object' } } } });
  const inputBody = {
    required: true,
    content: { 'application/json': { schema: { type: 'object', required: ['input'], properties: { input: { type: 'string', maxLength: 10_000 } } } } }
  };
  const gardenIntent = [{ gardenIntent: [] }];
  const personalSession = (scope: string) => [{ gardenSession: [] }, { gardenOAuth: [scope] }];
  const personalWrite = (scope: string) => [{ gardenIntent: [], gardenSession: [] }, { gardenIntent: [], gardenOAuth: [scope] }];
  return {
    openapi: '3.1.0',
    info: {
      title: 'Community Garden Public API',
      version: 'garden-api.v1',
      description: 'Bounded public, community, and account-scoped entrances for ARI. Internal runtime and administrator routes are not published.'
    },
    servers: [{ url: PUBLIC_ORIGIN }],
    tags: [
      { name: 'Discovery', description: 'Public identity and ARI capability descriptions.' },
      { name: 'Agent protocols', description: 'Public A2A, Agent Skills, and read-only MCP discovery surfaces.' },
      { name: 'Cultivation', description: 'Bounded public or community relational translation.' },
      { name: 'Account', description: 'User-directed registration, sessions, and private cultivation.' }
    ],
    paths: {
      '/api/v1': { get: { tags: ['Discovery'], summary: 'Describe the public API entrances', responses: { '200': jsonResponse('Public API catalog') } } },
      '/garden/identity': { get: { tags: ['Discovery'], summary: 'Describe Community Garden and its boundaries', responses: { '200': jsonResponse('Public Garden identity') } } },
      '/api/v1/ari/foundation': { get: { tags: ['Discovery'], summary: 'Read ARI foundation rules', responses: { '200': jsonResponse('ARI foundation') } } },
      '/api/v1/ari/tools': { get: { tags: ['Discovery'], summary: 'Read ARI tool registry', responses: { '200': jsonResponse('Bounded tool registry') } } },
      '/.well-known/oauth-authorization-server': { get: { tags: ['Discovery'], summary: 'Discover the Garden OAuth authorization server', responses: { '200': jsonResponse('OAuth authorization server metadata') } } },
      '/.well-known/oauth-protected-resource': { get: { tags: ['Discovery'], summary: 'Discover OAuth requirements for protected Garden APIs', responses: { '200': jsonResponse('OAuth protected resource metadata') } } },
      '/.well-known/http-message-signatures-directory': { get: { tags: ['Agent protocols'], summary: 'Discover ARI Web Bot Auth verification keys', responses: { '200': jsonResponse('Signed Ed25519 HTTP Message Signatures directory') } } },
      '/oauth/register': { post: { tags: ['Account'], summary: 'Register a short-lived public OAuth client', responses: { '201': jsonResponse('OAuth client registration') } } },
      '/oauth/authorize': { get: { tags: ['Account'], summary: 'Ask the signed-in person to approve OAuth scopes', responses: { '200': { description: 'Human approval page' } } } },
      '/oauth/token': { post: { tags: ['Account'], summary: 'Exchange a one-time authorization code using PKCE', responses: { '200': jsonResponse('Opaque Garden access token') } } },
      '/agent/auth': { post: { tags: ['Account'], summary: 'Start a person-approved verified-email agent claim', responses: { '202': jsonResponse('Pending verified-email claim'), '429': jsonResponse('Rate limit reached') } } },
      '/agent/auth/claim': { post: { tags: ['Account'], summary: 'Exchange a person-supplied one-time verification token for bounded access', responses: { '200': jsonResponse('Opaque Garden access token'), '400': jsonResponse('Invalid or expired claim') } } },
      '/.well-known/agent-card.json': { get: { tags: ['Agent protocols'], summary: 'Discover ARI through an A2A Agent Card', responses: { '200': jsonResponse('Public A2A Agent Card') } } },
      '/.well-known/agent-skills/index.json': { get: { tags: ['Agent protocols'], summary: 'Discover ARI public Agent Skills', responses: { '200': jsonResponse('Agent Skills discovery index') } } },
      '/.well-known/mcp/server-card.json': { get: { tags: ['Agent protocols'], summary: 'Discover the ARI public MCP server', responses: { '200': jsonResponse('MCP Server Card') } } },
      '/mcp': { post: { tags: ['Agent protocols'], summary: 'Use the stateless read-only ARI MCP server', responses: { '200': jsonResponse('MCP JSON-RPC response') } } },
      '/a2a/v1/message:send': { post: { tags: ['Agent protocols'], summary: 'Send one non-persistent public message to ARI', responses: { '200': jsonResponse('A2A message response'), '429': jsonResponse('Rate limit reached') } } },
      '/garden/fruit': { post: { tags: ['Cultivation'], summary: 'Cultivate a bounded public seed', security: gardenIntent, requestBody: inputBody, responses: { '200': jsonResponse('Public fruit'), '429': jsonResponse('Rate limit reached') } } },
      '/api/v1/community/cultivate': { post: { tags: ['Cultivation'], summary: 'Cultivate through the shared community entrance', security: gardenIntent, requestBody: inputBody, responses: { '200': jsonResponse('Community fruit') } } },
      '/api/v1/me/account': { post: { tags: ['Account'], summary: 'Create a user account pending email verification', security: gardenIntent, responses: { '202': jsonResponse('Verification requested') } } },
      '/api/v1/me/account/verify': { post: { tags: ['Account'], summary: 'Verify an email with a single-use token', security: gardenIntent, responses: { '200': jsonResponse('Email verified') } } },
      '/api/v1/me/account/resend-verification': { post: { tags: ['Account'], summary: 'Request another verification message', security: gardenIntent, responses: { '202': jsonResponse('Generic delivery response') } } },
      '/api/v1/me/session': {
        get: { tags: ['Account'], summary: 'Read the current account session', security: personalSession('garden:session:read'), responses: { '200': jsonResponse('Current session'), '401': jsonResponse('Authentication required') } },
        post: { tags: ['Account'], summary: 'Sign in and receive an HttpOnly session cookie', security: gardenIntent, responses: { '200': jsonResponse('Session created'), '429': jsonResponse('Rate limit reached') } },
        delete: { tags: ['Account'], summary: 'Sign out and clear the browser session cookie', security: [{ gardenIntent: [], gardenSession: [] }], responses: { '200': jsonResponse('Signed out') } }
      },
      '/api/v1/me/cultivate': { post: { tags: ['Account'], summary: 'Cultivate using the authenticated person private context', security: personalWrite('garden:cultivate'), requestBody: inputBody, responses: { '200': jsonResponse('Private fruit') } } },
      '/api/v1/me/garden': { get: { tags: ['Account'], summary: 'Read the authenticated person reviewed graph overlay', security: personalSession('garden:graph:read'), responses: { '200': jsonResponse('Personal graph') } } },
      '/api/v1/me/garden/relationships': { post: { tags: ['Account'], summary: 'Place user-confirmed relationships in the personal graph', security: personalWrite('garden:graph:write'), responses: { '201': jsonResponse('Personal graph mutation receipt') } } },
      '/api/v1/me/transcript': { get: { tags: ['Account'], summary: 'Read the authenticated person ordered private transcript', security: personalSession('garden:transcript:read'), responses: { '200': jsonResponse('Private transcript page') } } }
    },
    components: {
      securitySchemes: {
        gardenIntent: { type: 'apiKey', in: 'header', name: 'x-garden-request', description: 'Use public-entrance or personal-entrance as documented for the selected route.' },
        gardenSession: { type: 'apiKey', in: 'cookie', name: 'mirror_session', description: 'HttpOnly, Secure, SameSite session cookie issued after sign-in.' },
        gardenOAuth: {
          type: 'oauth2',
          description: 'Authorization code flow for registered public clients. PKCE S256 and explicit person approval are required.',
          flows: {
            authorizationCode: {
              authorizationUrl: `${PUBLIC_ORIGIN}/oauth/authorize`,
              tokenUrl: `${PUBLIC_ORIGIN}/oauth/token`,
              scopes: OAUTH_SCOPES
            }
          }
        }
      }
    },
    externalDocs: { description: 'Community Garden API documentation', url: `${PUBLIC_ORIGIN}/api-docs.md` }
  };
}

function publicIdentity(body: Record<string, any>) {
  return {
    version: String(body.version || 'garden-entrance.v1'),
    name: String(body.name || 'Community Garden'),
    kind: String(body.kind || 'public_cultivation_interface'),
    purpose: String(body.purpose || ''),
    technicalPerson: {
      name: String(body.technicalPerson?.name || 'ARI'),
      role: String(body.technicalPerson?.role || 'relational translator'),
      languageEngine: String(body.technicalPerson?.languageEngine || 'Qwen'),
      foundation: '/api/v1/ari/foundation',
      toolRegistry: '/api/v1/ari/tools'
    },
    cultivationCycle: safeStringList(body.cultivationCycle, 8),
    protectedRoots: safeStringList(body.protectedRoots, 12),
    adaptation: {
      immediate: String(body.adaptation?.immediate || ''),
      personal: String(body.adaptation?.personal || ''),
      shared: String(body.adaptation?.shared || '')
    },
    boundary: {
      semanticMutationAllowed: false,
      graphMutationAllowed: false,
      sourceMutationAllowed: false,
      reason: String(body.boundary?.reason || 'Visitors do not receive direct access to protected roots.')
    }
  };
}

function publicFruit(body: Record<string, any>) {
  return {
    version: String(body.version || 'garden-entrance.v1'),
    seed: {
      received: body.seed?.received === true,
      codePointCount: Number(body.seed?.codePointCount || 0)
    },
    fruit: {
      type: 'cultivated_response',
      language: String(body.fruit?.language || 'english'),
      text: String(body.fruit?.text || '')
    },
    cultivation: {
      stages: safeStringList(body.cultivation?.stages, 8),
      translator: {
        name: String(body.cultivation?.translator?.name || 'ARI'),
        domain: String(body.cultivation?.translator?.domain || 'Community Garden'),
        languageEngine: 'Qwen',
        foundationVersion: String(body.cultivation?.translator?.foundationVersion || 'unresolved')
      },
      graphSource: String(body.cultivation?.graphSource || 'unresolved'),
      relationshipNotice: String(body.cultivation?.relationshipNotice || ''),
      personalContextConsulted: false,
      persisted: false,
      sharedGraphMutated: false
    },
    boundary: {
      mode: 'public_fruit_read_only',
      semanticMutationAllowed: false,
      graphMutationAllowed: false,
      sourceMutationAllowed: false,
      reason: 'The public gateway returns cultivated fruit without forwarding identity cookies or exposing internal controls.'
    }
  };
}

function publicCommunityFruit(body: Record<string, any>) {
  const fruit = publicFruit(body);
  return {
    ...fruit,
    version: 'garden-api.v1',
    boundary: {
      ...fruit.boundary,
      mode: 'community_api_read_only',
      reason: 'The community API never forwards identity cookies and cannot read personal memory or mutate shared knowledge.'
    }
  };
}

function publicPersonalFruit(body: Record<string, any>) {
  const fruit = publicFruit(body);
  return {
    ...fruit,
    version: 'garden-api.v1',
    cultivation: {
      ...fruit.cultivation,
      personalContextConsulted: true,
      persisted: body.cultivation?.persisted === true,
      persistenceLayer: body.cultivation?.persisted === true ? 'private_conversation_transcript' : 'none',
      contextEventCount: Number(body.cultivation?.contextEventCount || 0),
      transcriptSequence: Number(body.cultivation?.transcriptSequence || 0) || null,
      sharedGraphMutated: false
    },
    comparisonReceipt: publicComparisonReceipt(body.comparisonReceipt),
    boundary: {
      mode: 'personal_api_private_context',
      semanticMutationAllowed: false,
      graphMutationAllowed: false,
      sourceMutationAllowed: false,
      crossPersonAccessAllowed: false,
      automaticLearningAllowed: false,
      reason: 'Only the authenticated person transcript and reviewed overlay may be consulted. The ordered exchange stays private and does not change shared knowledge.'
    }
  };
}

function publicPersonalGarden(body: Record<string, any>) {
  const relationships = Array.isArray(body.garden?.relationships) ? body.garden.relationships.slice(0, 100) : [];
  return {
    version: 'garden-api.v1',
    garden: {
      sourceLayer: 'user_graph',
      consulted: body.garden?.consulted === true,
      relationships: relationships.map((relationship: Record<string, any>) => ({
        id: String(relationship.id || ''),
        source: String(relationship.source || '').slice(0, 120),
        target: String(relationship.target || '').slice(0, 120),
        relationshipType: String(relationship.relationshipType || '').slice(0, 80),
        confidence: String(relationship.confidence || ''),
        evidence: String(relationship.evidence || '').slice(0, 1_000),
        counterexample: String(relationship.counterexample || '').slice(0, 1_000),
        mutationSource: relationship.mutationSource === 'user_directed' ? 'user_directed' : 'reviewed_feedback',
        profileOwnerConfirmed: relationship.profileOwnerConfirmed === true,
        reviewNote: String(relationship.reviewNote || '').slice(0, 1_000),
        sourceLayer: 'user_graph',
        createdAt: relationship.createdAt || null
      })),
      relationshipCount: Number(body.garden?.relationshipCount || relationships.length),
      truncated: body.garden?.truncated === true
    },
    boundary: {
      mode: 'personal_garden_owner_only',
      crossPersonAccessAllowed: false,
      sharedGraphMutationAllowed: false,
      colorAtlasMutationAllowed: false,
      automaticLearningAllowed: false
    }
  };
}

function publicPersonalGardenMutation(body: Record<string, any>) {
  const garden = publicPersonalGarden(body);
  return {
    ...garden,
    mutation: {
      applied: body.mutation?.applied === true,
      profileOwnerConfirmed: body.mutation?.profileOwnerConfirmed === true,
      relationshipCount: garden.garden.relationshipCount
    },
    boundary: {
      ...garden.boundary,
      mode: 'user_directed_personal_graph_mutation',
      personalGraphMutated: body.boundary?.personalGraphMutated === true,
      sharedGraphMutationAllowed: false,
      colorAtlasMutationAllowed: false,
      automaticLearningAllowed: false
    }
  };
}

function publicPersonalTranscript(body: Record<string, any>) {
  const events = Array.isArray(body.transcript?.events) ? body.transcript.events.slice(0, 200) : [];
  return {
    version: 'garden-api.v1',
    transcript: {
      events: events.map((event: Record<string, any>) => ({
        sequence: Number(event.sequence),
        interactionId: String(event.interactionId || ''),
        role: event.role === 'assistant' ? 'assistant' : 'user',
        content: String(event.content || ''),
        comparison: publicComparisonMemory(event.comparison),
        createdAt: event.createdAt || null
      })),
      count: events.length,
      hasMore: body.transcript?.hasMore === true,
      nextBefore: Number(body.transcript?.nextBefore) || null,
      order: 'oldest_to_newest_within_page'
    },
    boundary: {
      mode: 'account_scoped_append_only_transcript',
      crossPersonAccessAllowed: false,
      sharedGraphMutationAllowed: false,
      automaticLearningAllowed: false
    }
  };
}

function publicSession(body: Record<string, any>) {
  const user = body.user && typeof body.user === 'object' ? body.user : body;
  return {
    authenticated: true,
    user: {
      id: String(user.id || user.sub || ''),
      username: String(user.username || ''),
      email: String(user.email || ''),
      role: String(user.role || 'user'),
      mustChangePassword: user.must_change_password === true || user.mustChangePassword === true
    }
  };
}

function publicAccountAction(body: Record<string, any>, fallback: string) {
  return { message: String(body.message || fallback).slice(0, 240) };
}

function publicError(body: Record<string, any>) {
  return { error: String(body.error || 'The Garden could not cultivate this seed.').slice(0, 240) };
}

async function readJson(request: IncomingMessage) {
  const contentType = String(request.headers['content-type'] || '').toLowerCase();
  if (!/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/.test(contentType)) {
    throw httpError(415, 'Content-Type must be application/json.');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_SEED_BODY_BYTES) throw httpError(413, 'Garden request exceeds 64 KB.');
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown>;
  } catch {
    throw httpError(400, 'Request body must be valid JSON.');
  }
}

function requirePublicEntranceRequest(request: IncomingMessage) {
  return requireGardenRequest(request, 'public-entrance');
}

function requireGardenRequest(request: IncomingMessage, expected: string) {
  if (request.headers['x-garden-request'] !== expected) throw httpError(403, `Garden request header must be ${expected}.`);
}

function requirePersonalSession(request: IncomingMessage) {
  const session = String(request.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith('mirror_session='));
  if (!session || session === 'mirror_session=') throw httpError(401, 'Authentication required.');
  return session;
}

function secureSessionCookie(upstreamCookie: string | null, clear = false) {
  const match = String(upstreamCookie || '').match(/(?:^|;\s*)mirror_session=([^;]*)/);
  if (!clear && !match) throw httpError(502, 'The personal session could not be established.');
  const value = clear ? '' : match![1];
  return `mirror_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${clear ? 0 : 43_200}`;
}

function forwardAnalyticsHeaders(request: IncomingMessage) {
  const cookies = parseCookies(request);
  return {
    'x-garden-visitor': cookies.garden_visitor || '',
    'x-garden-session': cookies.garden_visit || ''
  };
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

function isSecureRequest(request: IncomingMessage) {
  if (String(request.headers['x-forwarded-proto'] || '').toLowerCase() === 'https') return true;
  const hostname = String(request.headers.host || '').split(':')[0].toLowerCase();
  return hostname !== 'localhost' && hostname !== '127.0.0.1';
}

function createFixedWindowRateLimiter({ maxRequests, windowMs, trustProxy }: { maxRequests: number; windowMs: number; trustProxy: boolean }) {
  const windows = new Map<string, { startedAt: number; count: number }>();
  return (request: IncomingMessage, response: ServerResponse) => {
    const now = Date.now();
    const key = clientAddress(request, trustProxy);
    const current = windows.get(key);
    const record = !current || now - current.startedAt >= windowMs ? { startedAt: now, count: 0 } : current;
    record.count += 1;
    windows.set(key, record);
    const remaining = Math.max(maxRequests - record.count, 0);
    const resetSeconds = Math.max(Math.ceil((record.startedAt + windowMs - now) / 1000), 1);
    response.setHeader('RateLimit-Limit', String(maxRequests));
    response.setHeader('RateLimit-Remaining', String(remaining));
    response.setHeader('RateLimit-Reset', String(resetSeconds));
    if (record.count > maxRequests) {
      response.setHeader('Retry-After', String(resetSeconds));
      throw httpError(429, 'Too many Garden Entrance requests. Try again later.');
    }
  };
}

function clientAddress(request: IncomingMessage, trustProxy: boolean) {
  if (trustProxy) {
    const cloudflareAddress = String(request.headers['cf-connecting-ip'] || '').trim();
    if (cloudflareAddress) return cloudflareAddress;
    const forwardedAddress = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwardedAddress) return forwardedAddress;
  }
  return request.socket.remoteAddress || 'unknown';
}

function safeStringList(value: unknown, limit: number) {
  return Array.isArray(value) ? value.slice(0, limit).map(item => String(item).slice(0, 240)) : [];
}

function publicComparisonReceipt(value: Record<string, any> | null | undefined) {
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
      sharedTokens: safeStringList(comparison.sharedTokens, 12),
      sharedPhrases: safeStringList(comparison.sharedPhrases, 12),
      differenceCount: boundedNonnegative(comparison.differenceCount, 256)
    })).filter((comparison: Record<string, any>) => comparison.observationSequence !== null),
    recurringLanguage: {
      tokens: publicRecurringLanguage(value.recurringLanguage?.tokens),
      phrases: publicRecurringLanguage(value.recurringLanguage?.phrases)
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

function publicComparisonMemory(value: Record<string, any> | null | undefined) {
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

function publicRecurringLanguage(value: unknown) {
  return (Array.isArray(value) ? value : []).slice(0, 12).map((item: Record<string, any>) => ({
    value: String(item?.value || '').slice(0, 120),
    supportCount: boundedNonnegative(item?.supportCount, 6),
    observationSequences: (Array.isArray(item?.observationSequences) ? item.observationSequences : [])
      .map(boundedPositive).filter((sequence: number | null): sequence is number => sequence !== null).slice(0, 6),
    status: 'observation_only'
  })).filter((item: Record<string, any>) => item.value);
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

function publicMcpTool(name: string, title: string, description: string) {
  return {
    name,
    title,
    description,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    outputSchema: { type: 'object', additionalProperties: true },
    annotations: {
      title,
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    _meta: publicAgentBoundary()
  };
}

function publicAgentBoundary() {
  return {
    mode: 'public_identity_read_only',
    personalContextAvailable: false,
    crossPersonAccessAllowed: false,
    taskInputStored: false,
    sharedGraphMutationAllowed: false,
    personalGraphMutationAllowed: false,
    colorAtlasMutationAllowed: false,
    administratorActionsAllowed: false
  };
}

function publicDiscoveryHeaders() {
  return {
    'access-control-allow-origin': '*',
    'content-signal': PUBLIC_CONTENT_SIGNAL,
    link: PUBLIC_DISCOVERY_LINKS
  };
}

function a2aMessageText(body: Record<string, unknown>) {
  const message = body.message && typeof body.message === 'object' ? body.message as Record<string, unknown> : {};
  const parts = Array.isArray(message.parts) ? message.parts : [];
  const text = parts
    .map(part => part && typeof part === 'object' ? String((part as Record<string, unknown>).text || '') : '')
    .filter(Boolean)
    .join('\n')
    .trim();
  if ([...text].length > 10_000) throw httpError(413, 'A2A text exceeds 10,000 Unicode code points.');
  return text;
}

async function handlePublicMcpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  runtimeOrigin: string,
  applyRateLimit: () => void
) {
  const body = await readJson(request);
  const id = body.id ?? null;
  if (body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return sendMcpError(response, id, -32600, 'Invalid JSON-RPC request.');
  }

  if (body.method === 'notifications/initialized') {
    response.writeHead(202, {
      ...securityHeaders(),
      'access-control-allow-origin': '*',
      'mcp-protocol-version': '2025-06-18'
    });
    return response.end();
  }

  if (body.method === 'initialize') {
    return sendMcpResult(response, id, {
      protocolVersion: '2025-06-18',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'community-garden-ari', title: 'Community Garden ARI Public Context', version: '1.0.0' },
      instructions: 'Public identity reads only. Personal context, tool execution, and graph mutation are unavailable.'
    });
  }

  if (body.method === 'ping') return sendMcpResult(response, id, {});
  if (body.method === 'tools/list') return sendMcpResult(response, id, { tools: publicMcpTools });

  if (body.method === 'tools/call') {
    const params = body.params && typeof body.params === 'object' ? body.params as Record<string, unknown> : {};
    const name = String(params.name || '');
    if (!publicMcpTools.some(tool => tool.name === name)) return sendMcpError(response, id, -32602, 'Unknown public ARI tool.');
    applyRateLimit();
    const result = await executePublicDiscoveryTool(name, runtimeOrigin);
    if (result.error) {
      return sendMcpResult(response, id, {
        content: [{ type: 'text', text: result.error }],
        isError: true
      });
    }
    return sendMcpResult(response, id, {
      content: [{ type: 'text', text: JSON.stringify(result.output, null, 2) }],
      structuredContent: result.output,
      isError: false
    });
  }

  return sendMcpError(response, id, -32601, 'Method not found.');
}

async function executePublicDiscoveryTool(name: string, runtimeOrigin: string) {
  const path = name === 'garden_identity'
    ? '/garden/identity'
    : name === 'ari_foundation'
      ? '/api/v1/ari/foundation'
      : '/api/v1/ari/tools';
  const result = await runtimeJson(runtimeOrigin, path);
  if (result.status >= 400) return { output: null, error: publicError(result.body).error };
  const output = name === 'garden_identity' ? publicIdentity(result.body) : result.body;
  return { output, error: null };
}

function sendMcpResult(response: ServerResponse, id: unknown, result: unknown) {
  return sendProtocolJson(response, 200, { jsonrpc: '2.0', id, result }, 'application/json; charset=utf-8', {
    'mcp-protocol-version': '2025-06-18'
  });
}

function sendMcpError(response: ServerResponse, id: unknown, code: number, message: string) {
  return sendProtocolJson(response, 200, { jsonrpc: '2.0', id, error: { code, message } }, 'application/json; charset=utf-8', {
    'mcp-protocol-version': '2025-06-18'
  });
}

function sendProtocolJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  contentType: string,
  extraHeaders: Record<string, string> = {}
) {
  response.writeHead(status, {
    'content-type': contentType,
    'access-control-allow-origin': '*',
    'x-robots-tag': 'noindex, nofollow',
    ...securityHeaders(),
    ...extraHeaders
  });
  response.end(JSON.stringify(body));
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'x-robots-tag': 'noindex, nofollow',
    ...securityHeaders()
  });
  response.end(JSON.stringify(body));
}

function sendStatic(
  response: ServerResponse,
  method: string | undefined,
  contentType: string,
  body: string,
  extraHeaders: Record<string, string> = {}
) {
  response.writeHead(200, {
    'content-type': contentType,
    'content-length': Buffer.byteLength(body),
    ...securityHeaders(),
    'cache-control': 'public, max-age=300, stale-while-revalidate=3600',
    ...extraHeaders
  });
  response.end(method === 'HEAD' ? undefined : body);
}

function acceptsMarkdown(request: IncomingMessage) {
  return String(request.headers.accept || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .some(value => value.startsWith('text/markdown') && !/;\s*q=0(?:\.0+)?(?:\s*;|$)/.test(value));
}

function securityHeaders() {
  return {
    'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'cache-control': 'no-store',
    'strict-transport-security': 'max-age=31536000; includeSubDomains'
  };
}

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}
