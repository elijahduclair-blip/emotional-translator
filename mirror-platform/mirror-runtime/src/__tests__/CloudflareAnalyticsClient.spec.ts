import { describe, expect, it } from 'vitest';
import {
  CloudflareAnalyticsClient,
  classifyFailure,
  sanitizeAnalyticsPath
} from '../clients/CloudflareAnalyticsClient';

describe('CloudflareAnalyticsClient', () => {
  it('stays disabled without both backend-only environment values', async () => {
    let calls = 0;
    const client = new CloudflareAnalyticsClient({
      fetcher: async () => {
        calls += 1;
        return new Response('{}');
      }
    });

    const result = await client.getOutsideWeather();
    expect(result.status).toBe('not_configured');
    expect(result.privacy.rawIpQueried).toBe(false);
    expect(result.privacy.userAgentQueried).toBe(false);
    expect(calls).toBe(0);
  });

  it('keeps sections independent, redacts token-like paths, and caches the eight reads', async () => {
    let calls = 0;
    const seenAuthorization: string[] = [];
    const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      seenAuthorization.push(new Headers(init?.headers).get('authorization') || '');
      const request = JSON.parse(String(init?.body || '{}')) as { query: string };
      if (request.query.includes('CountriesAndNetworks')) {
        return jsonResponse({ errors: [{ message: 'field unavailable' }] });
      }
      return jsonResponse(graphqlFixture(request.query));
    };
    const client = new CloudflareAnalyticsClient({
      zoneTag: 'zone-id',
      token: 'server-secret-token',
      fetcher: fetcher as typeof fetch,
      cacheTtlMs: 60_000,
      now: () => new Date('2026-08-12T18:00:00.000Z')
    });

    const first = await client.getOutsideWeather(24);
    const second = await client.getOutsideWeather(24);

    expect(first.status).toBe('partial');
    expect(first.sections.countriesAndNetworks.status).toBe('unavailable');
    expect(first.sections.requestsAndVisitors.status).toBe('ready');
    expect(first.sections.requestedPaths.data.paths[0].path).toBe('/reset/:redacted');
    expect(first.sections.edgeVsOriginFailures.data.failures[0].classification).toBe('origin_not_reached');
    expect(first.sections.botAndThreat.data.botClassification).toBe('unknown');
    expect(first.sections.botAndThreat.data).not.toHaveProperty('clientIP');
    expect(second.cached).toBe(true);
    expect(calls).toBe(8);
    expect(seenAuthorization).toEqual(Array(8).fill('Bearer server-secret-token'));
    expect(JSON.stringify(first)).not.toContain('server-secret-token');
  });

  it('never upgrades an unconfirmed origin miss into a tunnel failure', () => {
    expect(classifyFailure(530, 0)).toBe('origin_not_reached');
    expect(classifyFailure(502, 502)).toBe('origin_failure');
    expect(classifyFailure(403, 0)).toBe('edge_blocked');
    expect(classifyFailure(404, 404)).toBe('not_a_failure');
    expect(sanitizeAnalyticsPath('/account/abcdefghijklmnopqrstuvwxyz123456')).toBe('/account/:redacted');
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function graphqlFixture(query: string) {
  let zone: Record<string, unknown> = {};
  if (query.includes('RequestsAndVisitors')) {
    zone = { httpRequests1dGroups: [{ dimensions: { date: '2026-08-12' }, sum: { requests: 20, pageViews: 3, encryptedRequests: 18, bytes: 5000 }, uniq: { uniques: 4 } }] };
  } else if (query.includes('RequestedPaths')) {
    zone = { httpRequestsAdaptiveGroups: [{ count: 6, dimensions: { clientRequestPath: '/reset/abcdefghijklmnopqrstuvwxyz123456', clientRequestHTTPHost: 'acommunitygarden.garden', clientRequestHTTPMethodName: 'GET', edgeResponseStatus: 404, originResponseStatus: 404, clientCountryName: 'US' } }] };
  } else if (query.includes('StatusCodes')) {
    zone = { httpRequests1dGroups: [{ sum: { responseStatusMap: [{ edgeResponseStatus: 200, requests: 5 }] } }] };
  } else if (query.includes('CacheStatus')) {
    zone = { httpRequestsAdaptiveGroups: [{ count: 5, dimensions: { cacheStatus: 'dynamic', edgeResponseStatus: 200 } }] };
  } else if (query.includes('ProtocolAndTLS')) {
    zone = { httpRequests1dGroups: [{ sum: { clientHTTPVersionMap: [{ clientHTTPProtocol: 'HTTP/2', requests: 5 }], clientSSLMap: [{ clientSSLProtocol: 'TLSv1.3', requests: 5 }] } }] };
  } else if (query.includes('EdgeVsOriginFailures')) {
    zone = { httpRequestsAdaptiveGroups: [{ count: 7, dimensions: { edgeResponseStatus: 530, originResponseStatus: 0, cacheStatus: 'dynamic', clientRequestPath: '/' } }] };
  } else if (query.includes('BotAndThreat')) {
    zone = { firewallEventsAdaptive: [{ datetime: '2026-08-12T17:00:00Z', action: 'block', source: 'firewallManaged', description: 'Managed rule', clientCountryName: 'US', clientRequestPath: '/wp-config.php', clientRequestHTTPMethodName: 'GET', edgeResponseStatus: 403 }], httpRequests1dGroups: [{ sum: { threats: 1, ipClassMap: [{ ipType: 'noRecord', requests: 5 }] } }] };
  }
  return { data: { viewer: { zones: [zone] } } };
}
