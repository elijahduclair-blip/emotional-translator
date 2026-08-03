import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import NodePanel from '@/components/graph/NodePanel';
import AddNodeDialog from '@/components/graph/AddNodeDialog';
import PathBar from '@/components/graph/PathBar';
import { computePath, getTranslationProfile, computePathScore } from '@/components/graph/pathUtils';
import DiscoveryPanel from '@/components/graph/DiscoveryPanel';
import NewConceptDialog from '@/components/graph/NewConceptDialog';
import HierarchyTree from '@/components/graph/HierarchyTree';
import { Button } from '@/components/ui/button';
import { Plus, Search, X, Download, Loader2, Check, ExternalLink, Sparkles, GitBranch, Boxes, MoreHorizontal } from 'lucide-react';
import { wordToPath } from '@/utils/lexicalIndex';
import AddressLookupBar from '@/components/graph/AddressLookupBar';
import PersonaSelector from '@/components/graph/PersonaSelector';
import { resolvePreferredDomainId } from '@/utils/personaVisuals';
import { useIsMobile } from '@/hooks/use-mobile';
import { useBackToClose } from '@/hooks/useBackToClose';
import { Drawer, DrawerContent } from '@/components/ui/drawer';


/** Blend two hex colors by averaging RGB channels. */
function blendColors(hexA, hexB) {
  const pa = hexA.replace('#', '');
  const pb = hexB.replace('#', '');
  const ar = parseInt(pa.slice(0, 2), 16), ag = parseInt(pa.slice(2, 4), 16), ab = parseInt(pa.slice(4, 6), 16);
  const br = parseInt(pb.slice(0, 2), 16), bg = parseInt(pb.slice(2, 4), 16), bb = parseInt(pb.slice(4, 6), 16);
  const r = Math.round((ar + br) / 2), g = Math.round((ag + bg) / 2), b = Math.round((ab + bb) / 2);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export default function TranslationGraph() {
  const [nodes, setNodes] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedNodeId = searchParams.get('node');
  const discoveryOpen = searchParams.get('discovery') === 'open';
  const isMobile = useIsMobile();
  const moreActionsOpen = searchParams.get('moreActions') === 'open';
  const setMoreActionsOpen = useCallback((open) => {
    const next = new URLSearchParams(window.location.search);
    if (open) next.set('moreActions', 'open');
    else next.delete('moreActions');
    setSearchParams(next);
  }, [setSearchParams]);
  const setSelectedNodeId = useCallback((id) => {
    const next = new URLSearchParams(window.location.search);
    if (id) next.set('node', id);
    else next.delete('node');
    setSearchParams(next);
  }, [setSearchParams]);
  const setDiscoveryOpen = useCallback((open) => {
    const next = new URLSearchParams(window.location.search);
    if (open) next.set('discovery', 'open');
    else next.delete('discovery');
    setSearchParams(next);
  }, [setSearchParams]);
  const [threshold] = useState(100);
  const [searchQuery, setSearchQuery] = useState('');
  const addDialogOpen = searchParams.get('addNode') === 'true';
  const setAddDialogOpen = useCallback((open) => {
    const next = new URLSearchParams(window.location.search);
    if (open) next.set('addNode', 'true');
    else next.delete('addNode');
    setSearchParams(next);
  }, [setSearchParams]);
  const [pathMode, setPathMode] = useState(false);
  const [pathEndpoints, setPathEndpoints] = useState([]);
  const [pathSequence, setPathSequence] = useState(null);
  const [pathAnimating, setPathAnimating] = useState(false);
  const [profile, setProfile] = useState(null);
  const [discoveryCandidates, setDiscoveryCandidates] = useState([]);
  const [selectedDiscoveryId, setSelectedDiscoveryId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const conceptDialogOpen = searchParams.get('newConcept') === 'true';
  const setConceptDialogOpen = useCallback((open) => {
    const next = new URLSearchParams(window.location.search);
    if (open) next.set('newConcept', 'true');
    else next.delete('newConcept');
    setSearchParams(next);
  }, [setSearchParams]);
  const [conceptCandidate, setConceptCandidate] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState(null);
  const [domains, setDomains] = useState([]);
  const [profiles, setProfiles] = useState(null);
  const [selectedProfileId, setSelectedProfileId] = useState(null);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const thresholdRef = useRef(threshold);
  thresholdRef.current = threshold;

  useBackToClose(addDialogOpen, () => setAddDialogOpen(false));
  useBackToClose(conceptDialogOpen, () => setConceptDialogOpen(false));
  useBackToClose(moreActionsOpen, () => setMoreActionsOpen(false));

  useEffect(() => {
    (async () => {
      try {
        // Fetch profiles first to get the active star position
        let profiles = [];
        let pSkip = 0;
        while (true) {
          const batch = await base44.entities.UserProfile.filter({}, '-created_date', 500, pSkip);
          profiles.push(...batch);
          if (batch.length < 500) break;
          pSkip += 500;
        }
        setProfiles(profiles);

        // Use the orbital graph endpoint — only loads nodes within the star's proximity
        const activeProfile = profiles[0];
        let all = [];
        if (activeProfile) {
          try {
            const res = await base44.functions.invoke('fetchOrbitalGraph', {
              profile_id: activeProfile.id,
            });
            all = res.data.nodes || [];
          } catch {
            // Fallback: load all active nodes if orbital fetch fails
            let skip = 0;
            while (true) {
              const batch = await base44.entities.ColorNode.filter(
                { memory_status: 'active' },
                '-created_date',
                500,
                skip
              );
              all.push(...batch);
              if (batch.length < 500) break;
              skip += 500;
            }
          }
        } else {
          let skip = 0;
          while (true) {
            const batch = await base44.entities.ColorNode.filter(
              { memory_status: 'active' },
              '-created_date',
              500,
              skip
            );
            all.push(...batch);
            if (batch.length < 500) break;
            skip += 500;
          }
        }
        setNodes(all);
        try {
          const domainList = await base44.entities.Domain.list('-member_count', 500);
          setDomains(domainList);
        } catch { /* domains may not exist yet */ }
      } catch {
        setNodes([]);
      }
    })();
  }, []);



  const handleUpdateNode = useCallback((id, data) => {
    const prevNode = nodesRef.current?.find(n => n.id === id);
    setNodes(prev => prev ? prev.map(n => n.id === id ? { ...n, ...data } : n) : prev);
    base44.entities.ColorNode.update(id, data).catch(() => {
      if (prevNode) {
        setNodes(prev => prev ? prev.map(n => n.id === id ? prevNode : n) : prev);
      }
    });
  }, []);

  const handleAddNode = useCallback(async (data) => {
    let positioned = { x: 0, y: 127, z: 0, hex: data.hex };
    try {
      const res = await base44.functions.invoke('positionWord', { word: data.name });
      positioned = res.data;
    } catch (e) {
      // fallback to center if WordNet positioning fails
    }
    const created = await base44.entities.ColorNode.create({
      ...data,
      x: positioned.x,
      y: positioned.y,
      z: positioned.z,
      hex: data.hex || positioned.hex,
      lexical_path: wordToPath(data.name),
    });
    setNodes(prev => prev ? [...prev, created] : [created]);
  }, []);

  const handleDeleteNode = useCallback(async (id) => {
    const nodeToDelete = nodesRef.current?.find(n => n.id === id);
    setNodes(prev => prev ? prev.filter(n => n.id !== id) : prev);
    setSelectedNodeId(null);
    setPathEndpoints(prev => prev.filter(eid => eid !== id));
    setPathSequence(null);
    setPathAnimating(false);
    try {
      await base44.entities.ColorNode.delete(id);
    } catch (e) {
      if (nodeToDelete) {
        setNodes(prev => prev ? [...prev, nodeToDelete] : [nodeToDelete]);
      }
    }
  }, [setSelectedNodeId]);

  const handleToggleFavorite = useCallback((id, favorite) => {
    const prevNode = nodesRef.current?.find(n => n.id === id);
    setNodes(prev => prev ? prev.map(n => n.id === id ? { ...n, favorite } : n) : prev);
    base44.entities.ColorNode.update(id, { favorite }).catch(() => {
      if (prevNode) {
        setNodes(prev => prev ? prev.map(n => n.id === id ? { ...n, favorite: prevNode.favorite } : n) : prev);
      }
    });
  }, []);

  // Path tracing
  const togglePathMode = useCallback(() => {
    setPathMode(prev => {
      const next = !prev;
      if (!next) {
        setPathEndpoints([]);
        setPathSequence(null);
        setPathAnimating(false);
        setProfile(null);
      }
      setSelectedNodeId(null);
      return next;
    });
  }, []);

  const tracePath = useCallback(() => {
    if (pathEndpoints.length !== 2) return;
    const seq = computePath(nodesRef.current, pathEndpoints[0], pathEndpoints[1], thresholdRef.current);
    setPathSequence(seq);
    setPathAnimating(true);
    setProfile({ ...getTranslationProfile(nodesRef.current, pathEndpoints[0], pathEndpoints[1]), pathScore: computePathScore(seq, thresholdRef.current) });
  }, [pathEndpoints]);

  useEffect(() => {
    if (!pathMode || pathEndpoints.length !== 2) return;
    const seq = computePath(nodesRef.current, pathEndpoints[0], pathEndpoints[1], thresholdRef.current);
    setPathSequence(seq);
    setPathAnimating(true);
    setProfile({ ...getTranslationProfile(nodesRef.current, pathEndpoints[0], pathEndpoints[1]), pathScore: computePathScore(seq, thresholdRef.current) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathMode, pathEndpoints]);

  const handlePathNodeSelect = useCallback((id) => {
    setPathEndpoints(prev => {
      if (prev.length >= 2) return [id];
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  }, []);

  const clearPath = useCallback(() => {
    setPathEndpoints([]);
    setPathSequence(null);
    setPathAnimating(false);
    setProfile(null);
  }, []);

  // Discovery
  const loadCandidates = useCallback(async () => {
    const records = await base44.entities.DiscoveryCandidate.filter({ status: 'pending' });
    const nodeMap = new Map((nodesRef.current || []).map(n => [n.id, n]));
    const mapped = records
      .map(r => {
        const nodeA = r.node_a_id ? nodeMap.get(r.node_a_id) : null;
        const nodeB = r.node_b_id ? nodeMap.get(r.node_b_id) : null;
        const isClusterType = r.type === 'territory_mismatch' || r.type === 'dense_pocket';
        if (!isClusterType && (!nodeA || !nodeB)) return null;
        return {
          id: r.id,
          nodeA, nodeB,
          distance: r.distance,
          sharedNeighbors: r.shared_neighbors,
          localDensity: r.local_density,
          placementSources: 'auto-scan',
          score: r.score,
          type: r.type,
          insight: r.insight,
          cluster: {
            centroidX: r.cluster_centroid_x,
            centroidY: r.cluster_centroid_y,
            centroidZ: r.cluster_centroid_z,
            radius: r.cluster_radius,
            density: r.cluster_density,
            variance: r.cluster_variance,
            overlapPct: r.cluster_overlap_pct,
            nearestTerritoryDist: r.nearest_territory_distance,
            blendHex: r.cluster_blend_hex,
            size: r.local_density,
          },
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
    setDiscoveryCandidates(mapped);
  }, []);

  useEffect(() => {
    if (!discoveryOpen || !nodes) return;
    loadCandidates();
  }, [nodes, discoveryOpen, loadCandidates]);

  const toggleDiscovery = useCallback(() => {
    if (discoveryOpen) {
      setDiscoveryOpen(false);
      setSelectedDiscoveryId(null);
    } else {
      setDiscoveryOpen(true);
      loadCandidates();
    }
  }, [discoveryOpen, setDiscoveryOpen, loadCandidates]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await base44.functions.invoke('runDiscovery', {});
      await loadCandidates();
    } finally {
      setRefreshing(false);
    }
  }, [loadCandidates]);

  const handleCreateBridge = useCallback(async (candidate) => {
    const { nodeA, nodeB } = candidate;
    const tiers = ['base', 'bridge', 'shade'];
    const child = tiers.indexOf(nodeA.tier) >= tiers.indexOf(nodeB.tier) ? nodeA : nodeB;
    const parent = tiers.indexOf(nodeA.tier) >= tiers.indexOf(nodeB.tier) ? nodeB : nodeA;
    const updatedParents = [...new Set([...(child.parents || []), parent.name])];
    await base44.entities.ColorNode.update(child.id, { parents: updatedParents });
    setNodes(prev => prev ? prev.map(n => n.id === child.id ? { ...n, parents: updatedParents } : n) : prev);
    base44.entities.DiscoveryCandidate.update(candidate.id, { status: 'accepted' });
    setDiscoveryCandidates(prev => prev.filter(c => c.id !== candidate.id));
    setSelectedDiscoveryId(null);
  }, []);

  const handleCreateConcept = useCallback((candidate) => {
    setConceptCandidate(candidate);
    setConceptDialogOpen(true);
  }, []);

  const handleCreateConceptInstant = useCallback(async (candidate) => {
    const { nodeA, nodeB } = candidate;
    const autoName = `${nodeA.name} × ${nodeB.name}`;
    const mid = {
      x: (nodeA.x + nodeB.x) / 2,
      y: (nodeA.y + nodeB.y) / 2,
      z: (nodeA.z + nodeB.z) / 2,
    };
    const blendHex = blendColors(nodeA.hex, nodeB.hex);
    const created = await base44.entities.ColorNode.create({
      name: autoName,
      hex: blendHex,
      x: mid.x, y: mid.y, z: mid.z,
      tier: 'bridge',
      semantic_labels: [],
      parents: [],
    });
    const updates = await Promise.all([
      base44.entities.ColorNode.update(nodeA.id, { parents: [...new Set([...(nodeA.parents || []), autoName])] }),
      base44.entities.ColorNode.update(nodeB.id, { parents: [...new Set([...(nodeB.parents || []), autoName])] }),
    ]);
    setNodes(prev => prev ? [...prev, created].map(n => {
      if (n.id === nodeA.id) return { ...n, parents: updates[0].parents };
      if (n.id === nodeB.id) return { ...n, parents: updates[1].parents };
      return n;
    }) : prev);
    base44.entities.DiscoveryCandidate.update(candidate.id, { status: 'accepted' });
    setDiscoveryCandidates(prev => prev.filter(c => c.id !== candidate.id));
    setSelectedDiscoveryId(null);
  }, []);

  const handleCreateRepresentative = useCallback(async (candidate) => {
    const { cluster } = candidate;
    if (!cluster) return;
    const created = await base44.entities.ColorNode.create({
      name: 'Cluster Representative',
      hex: cluster.blendHex || '#888888',
      x: cluster.centroidX || 0,
      y: cluster.centroidY || 0,
      z: cluster.centroidZ || 0,
      tier: 'bridge',
      semantic_labels: [],
      parents: [],
    });
    setNodes(prev => prev ? [...prev, created] : prev);
    base44.entities.DiscoveryCandidate.update(candidate.id, { status: 'accepted' });
    setDiscoveryCandidates(prev => prev.filter(c => c.id !== candidate.id));
    setSelectedDiscoveryId(null);
  }, []);

  const confirmCreateConcept = useCallback(async (name) => {
    if (!conceptCandidate) return;
    const { nodeA, nodeB } = conceptCandidate;
    const mid = {
      x: (nodeA.x + nodeB.x) / 2,
      y: (nodeA.y + nodeB.y) / 2,
      z: (nodeA.z + nodeB.z) / 2,
    };
    const blendHex = blendColors(nodeA.hex, nodeB.hex);
    const created = await base44.entities.ColorNode.create({
      name, hex: blendHex,
      x: mid.x, y: mid.y, z: mid.z,
      tier: 'bridge',
      semantic_labels: [],
      parents: [],
    });
    const updates = await Promise.all([
      base44.entities.ColorNode.update(nodeA.id, { parents: [...new Set([...(nodeA.parents || []), name])] }),
      base44.entities.ColorNode.update(nodeB.id, { parents: [...new Set([...(nodeB.parents || []), name])] }),
    ]);
    setNodes(prev => prev ? [...prev, created].map(n => {
      if (n.id === nodeA.id) return { ...n, parents: updates[0].parents };
      if (n.id === nodeB.id) return { ...n, parents: updates[1].parents };
      return n;
    }) : prev);
    base44.entities.DiscoveryCandidate.update(conceptCandidate.id, { status: 'accepted' });
    setDiscoveryCandidates(prev => prev.filter(c => c.id !== conceptCandidate.id));
    setSelectedDiscoveryId(null);
    setConceptCandidate(null);
  }, [conceptCandidate]);

  const handleDismiss = useCallback((candidate) => {
    base44.entities.DiscoveryCandidate.update(candidate.id, { status: 'dismissed' });
    setDiscoveryCandidates(prev => prev.filter(c => c.id !== candidate.id));
    setSelectedDiscoveryId(null);
  }, []);

  // Export & Seed (moved from SceneToolbar)
  const handleExport = async () => {
    setExporting(true);
    setExportResult(null);
    try {
      const res = await base44.functions.invoke('exportToSheets', {});
      setExportResult(res.data);
    } catch (e) {
      setExportResult({ error: e.response?.data?.error || e.message });
    } finally {
      setExporting(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await base44.functions.invoke('seedWordNetHierarchy', {});
      setSeedResult(res.data);
      const fresh = await base44.entities.ColorNode.list();
      setNodes(fresh);
    } catch (e) {
      setSeedResult({ error: e.response?.data?.error || e.message });
    } finally {
      setSeeding(false);
    }
  };

  const handleDetect = async () => {
    setDetecting(true);
    setDetectResult(null);
    try {
      const res = await base44.functions.invoke('detectDomains', {});
      setDetectResult(res.data);
      const freshDomains = await base44.entities.Domain.list('-member_count', 500);
      setDomains(freshDomains);
    } catch (e) {
      setDetectResult({ error: e.response?.data?.error || e.message });
    } finally {
      setDetecting(false);
    }
  };

  const anchorMap = useMemo(() => {
    const m = new Map();
    (nodes || []).forEach(n => { if (n.tier === 'base') m.set(n.id, n.name); });
    return m;
  }, [nodes]);

  const domainMap = useMemo(() => {
    const m = new Map();
    (domains || []).forEach(d => m.set(d.id, { name: d.name, color: d.color }));
    return m;
  }, [domains]);

  const persona = useMemo(() => {
    if (!selectedProfileId || !profiles) return null;
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (!profile) return null;
    return {
      profile,
      origin: {
        x: profile.semantic_origin_x ?? 0,
        y: profile.semantic_origin_y ?? 0,
        z: profile.semantic_origin_z ?? 0,
      },
      preferredDomainId: resolvePreferredDomainId(domains, profile.archetype),
    };
  }, [selectedProfileId, profiles, domains]);

  // Stamp last_accessed_at + bump access_count when a node is viewed (Active Memory reinforcement)
  useEffect(() => {
    if (!selectedNodeId || !nodes) return;
    const now = new Date().toISOString();
    base44.entities.ColorNode.update(selectedNodeId, {
      last_accessed_at: now,
      access_count: (nodes.find(n => n.id === selectedNodeId)?.access_count || 0) + 1,
    }).catch(() => { /* best-effort access tracking */ });
  }, [selectedNodeId, nodes]);

  const selectedNode = nodes?.find(n => n.id === selectedNodeId) || null;

  if (nodes === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-white/10 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="safe-top flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-card/50 backdrop-blur-xl shrink-0 flex-wrap">
        <span className="text-white/80 text-sm font-semibold mr-2">ChromaBridge</span>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search nodes…"
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-8 py-1.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {!isMobile && <AddressLookupBar nodes={nodes} onSelectNode={setSelectedNodeId} />}

        <PersonaSelector profiles={profiles} selectedId={selectedProfileId} onSelect={setSelectedProfileId} />

        <div className="flex-1" />

        <Button size="sm" onClick={() => setAddDialogOpen(true)} className="bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-full">
          <Plus className="w-4 h-4 mr-1.5" />Add Node
        </Button>
        <Button size="sm" onClick={toggleDiscovery} className={discoveryOpen ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 rounded-full' : 'bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-full'}>
          <Sparkles className="w-4 h-4 mr-1.5" />Discovery
        </Button>

        {!isMobile && (
          <>
            <Button size="sm" onClick={handleSeed} disabled={seeding} className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded-full">
              {seeding ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <GitBranch className="w-4 h-4 mr-1.5" />}
              {seeding ? 'Seeding…' : 'Seed'}
            </Button>
            {seedResult && !seedResult.error && (
              <span className="text-xs text-indigo-300/80 whitespace-nowrap">+{seedResult.hypernymsCreated} nodes</span>
            )}
            {seedResult?.error && (
              <span className="text-xs text-red-400/80">{seedResult.error}</span>
            )}
            <Button size="sm" onClick={handleDetect} disabled={detecting} className="bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/20 rounded-full">
              {detecting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Boxes className="w-4 h-4 mr-1.5" />}
              {detecting ? 'Detecting…' : 'Domains'}
            </Button>
            {detectResult && !detectResult.error && (
              <span className="text-xs text-violet-300/80 whitespace-nowrap">{detectResult.domains_detected} domains · {detectResult.intersections_found} intersections</span>
            )}
            {detectResult?.error && (
              <span className="text-xs text-red-400/80">{detectResult.error}</span>
            )}
            <Button size="sm" onClick={handleExport} disabled={exporting} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 rounded-full">
              {exporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
              {exporting ? 'Exporting…' : 'Export'}
            </Button>
            {exportResult && !exportResult.error && (
              <a href={exportResult.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                <Check className="w-3 h-3" />{exportResult.count} rows<ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
            )}
            {exportResult?.error && (
              <span className="text-xs text-red-400/80">{exportResult.error}</span>
            )}
          </>
        )}

        {isMobile && (
          <Button size="sm" onClick={() => setMoreActionsOpen(true)} className="bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-full">
            <MoreHorizontal className="w-4 h-4 mr-1.5" />More
          </Button>
        )}
      </div>

      {/* Mobile More Actions drawer */}
      <Drawer open={moreActionsOpen} onOpenChange={setMoreActionsOpen}>
        <DrawerContent className="bg-card border-border safe-bottom">
          <div className="px-4 pb-6 pt-2 space-y-3">
            <span className="text-xs uppercase tracking-wider text-white/40 block mb-2">More Actions</span>
            <AddressLookupBar nodes={nodes} onSelectNode={(id) => { setSelectedNodeId(id); setMoreActionsOpen(false); }} />
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" onClick={handleSeed} disabled={seeding} className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded-full">
                {seeding ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <GitBranch className="w-4 h-4 mr-1.5" />}
                {seeding ? 'Seeding…' : 'Seed'}
              </Button>
              <Button size="sm" onClick={handleDetect} disabled={detecting} className="bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/20 rounded-full">
                {detecting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Boxes className="w-4 h-4 mr-1.5" />}
                {detecting ? 'Detecting…' : 'Domains'}
              </Button>
              <Button size="sm" onClick={handleExport} disabled={exporting} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 rounded-full">
                {exporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
                {exporting ? 'Exporting…' : 'Export'}
              </Button>
            </div>
            {seedResult && !seedResult.error && (
              <span className="text-xs text-indigo-300/80">+{seedResult.hypernymsCreated} nodes</span>
            )}
            {seedResult?.error && (
              <span className="text-xs text-red-400/80">{seedResult.error}</span>
            )}
            {detectResult && !detectResult.error && (
              <span className="text-xs text-violet-300/80">{detectResult.domains_detected} domains · {detectResult.intersections_found} intersections</span>
            )}
            {detectResult?.error && (
              <span className="text-xs text-red-400/80">{detectResult.error}</span>
            )}
            {exportResult && !exportResult.error && (
              <a href={exportResult.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                <Check className="w-3 h-3" />{exportResult.count} rows<ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
            )}
            {exportResult?.error && (
              <span className="text-xs text-red-400/80">{exportResult.error}</span>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Tree + NodePanel */}
      <div className="flex-1 flex overflow-hidden relative">
        <HierarchyTree
          nodes={nodes}
          searchQuery={searchQuery}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onToggleFavorite={handleToggleFavorite}
          pathMode={pathMode}
          pathEndpoints={pathEndpoints}
          onPathNodeSelect={handlePathNodeSelect}
          persona={persona}
        />
        <NodePanel
          node={selectedNode}
          onUpdate={handleUpdateNode}
          onDelete={handleDeleteNode}
          onClose={() => setSelectedNodeId(null)}
          anchorMap={anchorMap}
          domainMap={domainMap}
        />
      </div>

      <PathBar
        pathMode={pathMode}
        pathEndpoints={pathEndpoints}
        pathSequence={pathSequence}
        profile={profile}
        nodes={nodes}
        onTogglePathMode={togglePathMode}
        onTrace={tracePath}
        onClear={clearPath}
      />

      <DiscoveryPanel
        open={discoveryOpen}
        candidates={discoveryCandidates}
        selectedId={selectedDiscoveryId}
        onSelect={setSelectedDiscoveryId}
        onCreateBridge={handleCreateBridge}
        onCreateConcept={handleCreateConcept}
        onCreateConceptInstant={handleCreateConceptInstant}
        onCreateRepresentative={handleCreateRepresentative}
        onDismiss={handleDismiss}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onClose={() => setDiscoveryOpen(false)}
      />
      <AddNodeDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddNode}
      />
      <NewConceptDialog
        open={conceptDialogOpen}
        onOpenChange={setConceptDialogOpen}
        candidate={conceptCandidate}
        onCreate={confirmCreateConcept}
      />
    </div>
  );
}