const GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const QUERY_TIMEOUT_MS = 12_000;

type Fetcher = typeof fetch;

type SectionStatus = 'ready' | 'unavailable';

export interface WeatherSection<T> {
  status: SectionStatus;
  data: T | null;
  error: 'cloudflare_query_failed' | null;
}

export interface OutsideWeatherResult {
  version: 'garden-outside-weather.v1';
  status: 'ready' | 'partial' | 'not_configured';
  source: 'cloudflare_graphql_analytics';
  cached: boolean;
  fetchedAt: string | null;
  window: { label: string; hours: number; dailyBucketNotice: string };
  sections: Record<string, WeatherSection<any>>;
  availability: {
    botClassification: 'unknown';
    botScore: 'unavailable_on_free_plan';
    asn: 'unavailable_on_free_plan';
    colo: 'unavailable_on_free_plan';
  };
  privacy: {
    rawIpQueried: false;
    userAgentQueried: false;
    messageContentQueried: false;
    responseContentQueried: false;
    authenticationDataQueried: false;
    boundary: string;
  };
}

interface CloudflareAnalyticsClientOptions {
  zoneTag?: string;
  token?: string;
  fetcher?: Fetcher;
  cacheTtlMs?: number;
  now?: () => Date;
}

interface QueryDefinition {
  name: string;
  query: string;
  variables: (window: QueryWindow) => Record<string, string>;
  normalize: (zone: Record<string, any> | null) => unknown;
}

interface QueryWindow {
  sinceTime: string;
  untilTime: string;
  sinceDate: string;
  untilDate: string;
}

const QUERY_REQUESTS_AND_VISITORS = `
  query RequestsAndVisitors($zoneTag: String!, $since: Date!, $until: Date!) {
    viewer { zones(filter: { zoneTag: $zoneTag }) {
      httpRequests1dGroups(filter: { date_geq: $since, date_leq: $until }, limit: 100) {
        dimensions { date }
        sum { requests pageViews encryptedRequests bytes }
        uniq { uniques }
      }
    } }
  }
`;

const QUERY_COUNTRIES_AND_NETWORKS = `
  query CountriesAndNetworks($zoneTag: String!, $since: Date!, $until: Date!) {
    viewer { zones(filter: { zoneTag: $zoneTag }) {
      httpRequests1dGroups(filter: { date_geq: $since, date_leq: $until }, limit: 100) {
        sum { countryMap { clientCountryName requests threats bytes } }
      }
    } }
  }
`;

const QUERY_REQUESTED_PATHS = `
  query RequestedPaths($zoneTag: String!, $since: Time!, $until: Time!) {
    viewer { zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(filter: { datetime_geq: $since, datetime_leq: $until }, limit: 50) {
        count
        dimensions {
          clientRequestPath clientRequestHTTPHost clientRequestHTTPMethodName
          edgeResponseStatus originResponseStatus clientCountryName
        }
      }
    } }
  }
`;

const QUERY_STATUS_CODES = `
  query StatusCodes($zoneTag: String!, $since: Date!, $until: Date!) {
    viewer { zones(filter: { zoneTag: $zoneTag }) {
      httpRequests1dGroups(filter: { date_geq: $since, date_leq: $until }, limit: 100) {
        sum { responseStatusMap { edgeResponseStatus requests } }
      }
    } }
  }
`;

const QUERY_CACHE_STATUS = `
  query CacheStatus($zoneTag: String!, $since: Time!, $until: Time!) {
    viewer { zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(filter: { datetime_geq: $since, datetime_leq: $until }, limit: 100) {
        count
        dimensions { cacheStatus edgeResponseStatus }
      }
    } }
  }
`;

const QUERY_PROTOCOL_AND_TLS = `
  query ProtocolAndTLS($zoneTag: String!, $since: Date!, $until: Date!) {
    viewer { zones(filter: { zoneTag: $zoneTag }) {
      httpRequests1dGroups(filter: { date_geq: $since, date_leq: $until }, limit: 100) {
        sum {
          clientHTTPVersionMap { clientHTTPProtocol requests }
          clientSSLMap { clientSSLProtocol requests }
        }
      }
    } }
  }
`;

const QUERY_EDGE_VS_ORIGIN_FAILURES = `
  query EdgeVsOriginFailures($zoneTag: String!, $since: Time!, $until: Time!) {
    viewer { zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(filter: { datetime_geq: $since, datetime_leq: $until }, limit: 100) {
        count
        dimensions { edgeResponseStatus originResponseStatus cacheStatus clientRequestPath }
      }
    } }
  }
`;

const QUERY_BOT_AND_THREAT = `
  query BotAndThreat($zoneTag: String!, $since: Time!, $until: Time!, $sinceDate: Date!, $untilDate: Date!) {
    viewer { zones(filter: { zoneTag: $zoneTag }) {
      firewallEventsAdaptive(filter: { datetime_geq: $since, datetime_leq: $until }, limit: 50) {
        datetime action source kind ruleId description clientCountryName
        clientRequestPath clientRequestHTTPMethodName edgeResponseStatus verifiedBotCategory
      }
      httpRequests1dGroups(filter: { date_geq: $sinceDate, date_leq: $untilDate }, limit: 100) {
        sum { threats ipClassMap { ipType requests } }
      }
    } }
  }
`;

export class CloudflareAnalyticsClient {
  private readonly zoneTag: string;
  private readonly token: string;
  private readonly fetcher: Fetcher;
  private readonly cacheTtlMs: number;
  private readonly now: () => Date;
  private cache: { expiresAt: number; hours: number; value: OutsideWeatherResult } | null = null;
  private pending: Promise<OutsideWeatherResult> | null = null;

  constructor(options: CloudflareAnalyticsClientOptions = {}) {
    this.zoneTag = String(options.zoneTag || '').trim();
    this.token = String(options.token || '').trim();
    this.fetcher = options.fetcher || fetch;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.now = options.now || (() => new Date());
  }

  isConfigured(): boolean {
    return Boolean(this.zoneTag && this.token);
  }

  async getOutsideWeather(hoursBack: number = 24): Promise<OutsideWeatherResult> {
    const hours = Number.isInteger(hoursBack) && hoursBack >= 1 && hoursBack <= 168 ? hoursBack : 24;
    if (!this.isConfigured()) return emptyOutsideWeather('not_configured', hours);

    const nowMs = this.now().getTime();
    if (this.cache && this.cache.hours === hours && this.cache.expiresAt > nowMs) {
      return { ...this.cache.value, cached: true };
    }
    if (this.pending) return { ...(await this.pending), cached: true };

    this.pending = this.fetchFresh(hours);
    try {
      const value = await this.pending;
      this.cache = { value, hours, expiresAt: this.now().getTime() + this.cacheTtlMs };
      return value;
    } finally {
      this.pending = null;
    }
  }

  private async fetchFresh(hours: number): Promise<OutsideWeatherResult> {
    const until = this.now();
    const since = new Date(until.getTime() - hours * 60 * 60 * 1000);
    const window: QueryWindow = {
      sinceTime: since.toISOString(),
      untilTime: until.toISOString(),
      sinceDate: since.toISOString().slice(0, 10),
      untilDate: until.toISOString().slice(0, 10)
    };
    const queries = queryDefinitions();
    const settled = await Promise.allSettled(queries.map(query => this.runQuery(query, window)));
    const sections: Record<string, WeatherSection<any>> = {};
    settled.forEach((result, index) => {
      const name = queries[index].name;
      sections[name] = result.status === 'fulfilled'
        ? { status: 'ready', data: result.value, error: null }
        : { status: 'unavailable', data: null, error: 'cloudflare_query_failed' };
    });
    const failures = settled.filter(result => result.status === 'rejected').length;
    return {
      ...emptyOutsideWeather(failures ? 'partial' : 'ready', hours),
      cached: false,
      fetchedAt: until.toISOString(),
      sections
    };
  }

  private async runQuery(definition: QueryDefinition, window: QueryWindow): Promise<unknown> {
    const response = await this.fetcher(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.token}`
      },
      body: JSON.stringify({
        query: definition.query,
        variables: { zoneTag: this.zoneTag, ...definition.variables(window) }
      }),
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS)
    });
    if (!response.ok) throw new Error(`Cloudflare analytics request failed (${response.status}).`);
    const body = await response.json().catch(() => null) as Record<string, any> | null;
    if (!body || (Array.isArray(body.errors) && body.errors.length)) throw new Error('Cloudflare analytics query failed.');
    const zone = body.data?.viewer?.zones?.[0];
    return definition.normalize(zone && typeof zone === 'object' ? zone : null);
  }
}

export function classifyFailure(
  edgeStatus: number,
  originStatus: number
): 'origin_not_reached' | 'origin_failure' | 'edge_blocked' | 'not_a_failure' {
  if (edgeStatus >= 500 && edgeStatus < 600 && originStatus === 0) return 'origin_not_reached';
  if (edgeStatus >= 500 && edgeStatus < 600 && originStatus >= 500 && originStatus < 600) return 'origin_failure';
  if (edgeStatus >= 400 && edgeStatus < 500 && originStatus === 0) return 'edge_blocked';
  return 'not_a_failure';
}

export function sanitizeAnalyticsPath(value: unknown): string {
  const path = String(value || '/').slice(0, 240);
  return path
    .split('/')
    .map(segment => /[a-z0-9_-]{24,}/i.test(segment) ? ':redacted' : segment)
    .join('/');
}

function queryDefinitions(): QueryDefinition[] {
  const daily = (window: QueryWindow) => ({ since: window.sinceDate, until: window.untilDate });
  const timed = (window: QueryWindow) => ({ since: window.sinceTime, until: window.untilTime });
  return [
    { name: 'requestsAndVisitors', query: QUERY_REQUESTS_AND_VISITORS, variables: daily, normalize: normalizeRequests },
    { name: 'countriesAndNetworks', query: QUERY_COUNTRIES_AND_NETWORKS, variables: daily, normalize: normalizeCountries },
    { name: 'requestedPaths', query: QUERY_REQUESTED_PATHS, variables: timed, normalize: normalizePaths },
    { name: 'statusCodes', query: QUERY_STATUS_CODES, variables: daily, normalize: normalizeStatusCodes },
    { name: 'cacheStatus', query: QUERY_CACHE_STATUS, variables: timed, normalize: normalizeCacheStatus },
    { name: 'protocolAndTLS', query: QUERY_PROTOCOL_AND_TLS, variables: daily, normalize: normalizeProtocol },
    { name: 'edgeVsOriginFailures', query: QUERY_EDGE_VS_ORIGIN_FAILURES, variables: timed, normalize: normalizeFailures },
    {
      name: 'botAndThreat', query: QUERY_BOT_AND_THREAT,
      variables: window => ({ ...timed(window), sinceDate: window.sinceDate, untilDate: window.untilDate }),
      normalize: normalizeThreats
    }
  ];
}

function normalizeRequests(zone: Record<string, any> | null) {
  const rows = array(zone?.httpRequests1dGroups);
  return {
    requests: sum(rows, row => row.sum?.requests),
    pageViews: sum(rows, row => row.sum?.pageViews),
    encryptedRequests: sum(rows, row => row.sum?.encryptedRequests),
    bytes: sum(rows, row => row.sum?.bytes),
    uniqueVisitors: sum(rows, row => row.uniq?.uniques),
    uniqueVisitorBasis: 'sum_of_daily_unique_counts',
    daily: rows.map(row => ({
      date: String(row.dimensions?.date || ''),
      requests: number(row.sum?.requests),
      uniqueVisitors: number(row.uniq?.uniques)
    })).slice(0, 8)
  };
}

function normalizeCountries(zone: Record<string, any> | null) {
  const records = array(zone?.httpRequests1dGroups).flatMap(row => array(row.sum?.countryMap));
  return {
    countries: aggregate(records, item => String(item.clientCountryName || 'unknown'), item => item.requests)
      .slice(0, 12),
    asn: 'unavailable_on_free_plan'
  };
}

function normalizePaths(zone: Record<string, any> | null) {
  return {
    paths: array(zone?.httpRequestsAdaptiveGroups).map(row => ({
      path: sanitizeAnalyticsPath(row.dimensions?.clientRequestPath),
      host: String(row.dimensions?.clientRequestHTTPHost || 'unknown').slice(0, 160),
      method: String(row.dimensions?.clientRequestHTTPMethodName || 'unknown').slice(0, 16),
      edgeStatus: number(row.dimensions?.edgeResponseStatus),
      originStatus: number(row.dimensions?.originResponseStatus),
      country: String(row.dimensions?.clientCountryName || 'unknown').slice(0, 8),
      requests: number(row.count)
    })).sort((a, b) => b.requests - a.requests).slice(0, 12)
  };
}

function normalizeStatusCodes(zone: Record<string, any> | null) {
  const records = array(zone?.httpRequests1dGroups).flatMap(row => array(row.sum?.responseStatusMap));
  return {
    codes: aggregate(records, item => String(number(item.edgeResponseStatus)), item => item.requests)
      .map(item => ({ status: number(item.label), requests: item.count }))
      .sort((a, b) => a.status - b.status)
  };
}

function normalizeCacheStatus(zone: Record<string, any> | null) {
  const records = array(zone?.httpRequestsAdaptiveGroups);
  return {
    statuses: aggregate(records, item => String(item.dimensions?.cacheStatus || 'unknown'), item => item.count)
  };
}

function normalizeProtocol(zone: Record<string, any> | null) {
  const rows = array(zone?.httpRequests1dGroups);
  const http = rows.flatMap(row => array(row.sum?.clientHTTPVersionMap));
  const tls = rows.flatMap(row => array(row.sum?.clientSSLMap));
  return {
    httpVersions: aggregate(http, item => String(item.clientHTTPProtocol || 'unknown'), item => item.requests),
    tlsVersions: aggregate(tls, item => String(item.clientSSLProtocol || 'unknown'), item => item.requests),
    schemeField: 'unavailable_on_free_plan'
  };
}

function normalizeFailures(zone: Record<string, any> | null) {
  return {
    failures: array(zone?.httpRequestsAdaptiveGroups).map(row => {
      const edgeStatus = number(row.dimensions?.edgeResponseStatus);
      const originStatus = number(row.dimensions?.originResponseStatus);
      return {
        edgeStatus,
        originStatus,
        requests: number(row.count),
        path: sanitizeAnalyticsPath(row.dimensions?.clientRequestPath),
        classification: classifyFailure(edgeStatus, originStatus)
      };
    }).filter(row => row.classification !== 'not_a_failure')
      .sort((a, b) => b.requests - a.requests).slice(0, 12),
    tunnelFailureConfirmed: false
  };
}

function normalizeThreats(zone: Record<string, any> | null) {
  const daily = array(zone?.httpRequests1dGroups);
  const reputation = daily.flatMap(row => array(row.sum?.ipClassMap));
  return {
    botClassification: 'unknown',
    botScore: 'unavailable_on_free_plan',
    threats: sum(daily, row => row.sum?.threats),
    reputation: aggregate(reputation, item => String(item.ipType || 'unknown'), item => item.requests),
    firewallEvents: array(zone?.firewallEventsAdaptive).map(event => ({
      datetime: String(event.datetime || ''),
      action: String(event.action || 'unknown').slice(0, 40),
      source: String(event.source || 'unknown').slice(0, 80),
      description: String(event.description || '').slice(0, 240),
      country: String(event.clientCountryName || 'unknown').slice(0, 8),
      path: sanitizeAnalyticsPath(event.clientRequestPath),
      method: String(event.clientRequestHTTPMethodName || 'unknown').slice(0, 16),
      edgeStatus: number(event.edgeResponseStatus)
    })).slice(0, 12)
  };
}

function emptyOutsideWeather(status: OutsideWeatherResult['status'], hours: number): OutsideWeatherResult {
  return {
    version: 'garden-outside-weather.v1',
    status,
    source: 'cloudflare_graphql_analytics',
    cached: false,
    fetchedAt: null,
    window: {
      label: `Last ${hours} hours`,
      hours,
      dailyBucketNotice: 'Unique-client, status, protocol, and country totals use the UTC daily buckets intersecting this window.'
    },
    sections: {},
    availability: {
      botClassification: 'unknown',
      botScore: 'unavailable_on_free_plan',
      asn: 'unavailable_on_free_plan',
      colo: 'unavailable_on_free_plan'
    },
    privacy: {
      rawIpQueried: false,
      userAgentQueried: false,
      messageContentQueried: false,
      responseContentQueried: false,
      authenticationDataQueried: false,
      boundary: 'Outside weather is aggregated operational metadata. It does not become graph evidence, personal traits, or semantic meaning.'
    }
  };
}

function aggregate(records: any[], label: (item: any) => string, value: (item: any) => unknown) {
  const totals = new Map<string, number>();
  for (const record of records) {
    const key = label(record);
    totals.set(key, (totals.get(key) || 0) + number(value(record)));
  }
  return [...totals.entries()].map(([itemLabel, count]) => ({ label: itemLabel, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function array(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sum(records: any[], value: (item: any) => unknown): number {
  return records.reduce((total, record) => total + number(value(record)), 0);
}
