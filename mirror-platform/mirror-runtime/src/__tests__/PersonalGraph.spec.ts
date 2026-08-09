import { describe, expect, it } from 'vitest';
import { mergePersonalGraphOverlay } from '../MirrorRuntime';

describe('personal graph overlay', () => {
  it('prioritizes reviewed user routes without changing shared graph authority', () => {
    const shared = {
      sourceLayer: 'approved_graph',
      matchedNodes: [{ id: 'rose', label: 'Rose', family: 'rose' }],
      supportedRoutes: [{ id: 'rose-midnight', source: 'Rose', target: 'Midnight', relationshipType: 'balances' }]
    };
    const result = mergePersonalGraphOverlay(shared, {
      relationships: [{
        id: 'personal-1', source: 'Rose', target: 'Reflection', relationshipType: 'moves_toward', sourceLayer: 'user_graph'
      }],
      truncated: false
    });

    expect(result.sourceLayer).toBe('approved_graph');
    expect(result.matchedNodes[0]).toEqual(shared.matchedNodes[0]);
    expect(result.supportedRoutes[0]).toEqual(expect.objectContaining({ id: 'personal-1', sourceLayer: 'user_graph' }));
    expect(result.supportedRoutes).toContainEqual(shared.supportedRoutes[0]);
    expect(result.personalOverlay).toEqual(expect.objectContaining({
      consulted: true,
      relationshipCount: 1,
      sharedGraphChanged: false,
      colorAtlasChanged: false
    }));
    expect(shared).toEqual({
      sourceLayer: 'approved_graph',
      matchedNodes: [{ id: 'rose', label: 'Rose', family: 'rose' }],
      supportedRoutes: [{ id: 'rose-midnight', source: 'Rose', target: 'Midnight', relationshipType: 'balances' }]
    });
  });

  it('keeps the graph read bounded when a personal overlay is large', () => {
    const relationships = Array.from({ length: 30 }, (_, index) => ({
      id: `personal-${index}`,
      source: `Source ${index}`,
      target: `Target ${index}`,
      relationshipType: 'relates_to',
      sourceLayer: 'user_graph'
    }));
    const result = mergePersonalGraphOverlay({ sourceLayer: 'unresolved', matchedNodes: [], supportedRoutes: [] }, { relationships, truncated: true });
    expect(result.matchedNodes).toHaveLength(12);
    expect(result.supportedRoutes).toHaveLength(24);
    expect(result.personalOverlay.truncated).toBe(true);
  });
});
