import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowUpDown, Save, Loader2, Check, RefreshCw } from 'lucide-react';
import LibrarianSearchPanel, { LibrarianResultBanner } from '@/components/graph/LibrarianSearchPanel';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

const tierStyles = {
  base: 'bg-[#c5b358]/10 text-[#c5b358] border-[#c5b358]/30',
  bridge: 'bg-[#8b7355]/10 text-[#c5b358] border-[#8b7355]/30',
  shade: 'bg-[#4a544a]/20 text-[#d4d4d4]/60 border-[#4a544a]',
  words: 'bg-[#5a6e4a]/10 text-[#8a9a6a] border-[#5a6e4a]/30',
};

async function fetchAllNodes() {
  const all = [];
  let skip = 0;
  while (true) {
    const batch = await base44.entities.ColorNode.filter({}, '-created_date', 500, skip);
    all.push(...batch);
    if (batch.length < 500) break;
    skip += 500;
  }
  return all;
}

export default function DataExplorer() {
  const queryClient = useQueryClient();
  const { data: nodes, isLoading, refetch } = useQuery({
    queryKey: ['colorNodes', 'all'],
    queryFn: fetchAllNodes,
    staleTime: 5 * 60 * 1000,
  });

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [librarianIds, setLibrarianIds] = useState(null);
  const [librarianSummary, setLibrarianSummary] = useState('');

  const { pullDistance, refreshing } = usePullToRefresh(() => refetch());

  const anchorMap = useMemo(() => {
    const m = new Map();
    (nodes || []).forEach(n => { if (n.tier === 'base') m.set(n.id, n); });
    return m;
  }, [nodes]);

  const filtered = useMemo(() => {
    if (!nodes) return [];
    let result = nodes.filter(n => {
      if (librarianIds) return librarianIds.includes(n.id);
      const matchSearch = !search || n.name.toLowerCase().includes(search.toLowerCase());
      const matchTier = tierFilter === 'all' || n.tier === tierFilter;
      return matchSearch && matchTier;
    });
    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'tier') cmp = a.tier.localeCompare(b.tier);
      else if (sortKey === 'x') cmp = a.x - b.x;
      else if (sortKey === 'y') cmp = a.y - b.y;
      else if (sortKey === 'z') cmp = a.z - b.z;
      else if (sortKey === 'anchor') {
        const an = anchorMap.get(a.parent_anchor_id)?.name || '';
        const bn = anchorMap.get(b.parent_anchor_id)?.name || '';
        cmp = an.localeCompare(bn);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [nodes, search, tierFilter, sortKey, sortDir, librarianIds, anchorMap]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const setDraft = (id, field, value) => {
    setDrafts(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSave = async (node) => {
    const draft = drafts[node.id];
    if (!draft) return;
    setSavingId(node.id);
    try {
      const payload = {
        x: Number(draft.x ?? node.x),
        y: Number(draft.y ?? node.y),
        z: Number(draft.z ?? node.z),
      };
      const updated = await base44.entities.ColorNode.update(node.id, payload);
      queryClient.setQueryData(['colorNodes', 'all'], (old) =>
        old ? old.map(n => n.id === node.id ? { ...n, ...updated } : n) : old
      );
      setDrafts(prev => { const next = { ...prev }; delete next[node.id]; return next; });
      setSavedId(node.id);
      setTimeout(() => setSavedId(null), 1500);
    } finally {
      setSavingId(null);
    }
  };

  const tierCounts = useMemo(() => {
    if (!nodes) return { all: 0, base: 0, bridge: 0, shade: 0, words: 0 };
    return {
      all: nodes.length,
      base: nodes.filter(n => n.tier === 'base').length,
      bridge: nodes.filter(n => n.tier === 'bridge').length,
      shade: nodes.filter(n => n.tier === 'shade').length,
      words: nodes.filter(n => n.tier === 'words').length,
    };
  }, [nodes]);

  const SortHeader = ({ label, sortKey: key }) => (
    <button onClick={() => handleSort(key)} className="flex items-center gap-1 hover:text-[#c5b358] transition-colors">
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortKey === key ? 'text-[#c5b358]/60' : 'text-[#4a544a]'}`} />
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0d140d] text-[#d4d4d4] p-6 pb-24">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#c5b358]" style={{ fontFamily: 'EB Garamond, serif' }}>Data Explorer</h1>
            <p className="text-sm text-[#d4d4d4]/40 mt-1">Search, filter, and edit node floating-point coordinates directly.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={refreshing} className="text-[#c5b358] border-[#c5b358]/40 hover:bg-[#c5b358]/10">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </header>

        <LibrarianSearchPanel
          nodes={nodes}
          onApply={(ids, summary) => { setLibrarianIds(ids); setLibrarianSummary(summary); }}
        />
        {librarianIds && (
          <LibrarianResultBanner
            summary={librarianSummary}
            count={librarianIds.length}
            onClear={() => { setLibrarianIds(null); setLibrarianSummary(''); }}
          />
        )}

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a544a]" />
            <Input
              placeholder="Search nodes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-[#1a2a1a] border-[#4a544a] text-[#d4d4d4]"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {['all', 'base', 'bridge', 'shade', 'words'].map(tier => (
              <button
                key={tier}
                onClick={() => setTierFilter(tier)}
                className={`px-3 py-1.5 rounded-md text-xs capitalize transition-colors border ${tierFilter === tier ? 'bg-[#c5b358]/10 text-[#c5b358] border-[#c5b358]/40' : 'text-[#d4d4d4]/40 hover:text-[#d4d4d4]/60 border-[#4a544a]'}`}
              >
                {tier} <span className="text-[#c5b358] ml-1 px-1 py-0.5 rounded text-[10px] border border-[#c5b358]/20">{tierCounts[tier]}</span>
              </button>
            ))}
          </div>
        </div>

        {(pullDistance > 0 || refreshing) && (
          <div className="flex justify-center items-center overflow-hidden transition-all" style={{ height: Math.max(pullDistance, refreshing ? 32 : 0) }}>
            <Loader2 className={`w-5 h-5 text-[#c5b358]/50 ${refreshing ? 'animate-spin' : ''}`} />
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#4a544a]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-[#4a544a] text-sm">No nodes found.</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block rounded-xl overflow-hidden bg-[#1a2a1a] border-2 border-double border-[#c5b358]/40">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#4a544a] hover:bg-transparent">
                    <TableHead className="text-[#c5b358]/60"><SortHeader label="Name" sortKey="name" /></TableHead>
                    <TableHead className="text-[#c5b358]/60"><SortHeader label="Tier" sortKey="tier" /></TableHead>
                    <TableHead className="text-[#c5b358]/60"><SortHeader label="Anchor" sortKey="anchor" /></TableHead>
                    <TableHead className="text-[#c5b358]/60 text-right"><SortHeader label="X · Cool–Warm" sortKey="x" /></TableHead>
                    <TableHead className="text-[#c5b358]/60 text-right"><SortHeader label="Y · Gen–Spec" sortKey="y" /></TableHead>
                    <TableHead className="text-[#c5b358]/60 text-right"><SortHeader label="Z · Pass–Active" sortKey="z" /></TableHead>
                    <TableHead className="text-[#c5b358]/60 text-right">Save</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(node => {
                    const draft = drafts[node.id] || {};
                    const hasDraft = Object.keys(draft).length > 0;
                    return (
                      <TableRow key={node.id} className="border-[#4a544a]/30 hover:bg-[#c5b358]/5">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="w-5 h-5 rounded-full border border-[#4a544a] flex-shrink-0" style={{ backgroundColor: node.hex }} />
                            <span className="font-medium text-[#d4d4d4]">{node.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {node.parent_anchor_id && anchorMap.get(node.parent_anchor_id) ? (
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full border border-[#4a544a] shrink-0" style={{ backgroundColor: anchorMap.get(node.parent_anchor_id).hex }} />
                              <span className="text-xs text-[#d4d4d4]/60">{anchorMap.get(node.parent_anchor_id).name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-[#4a544a]">—</span>
                          )}
                        </TableCell>
                        {['x', 'y', 'z'].map(axis => (
                          <TableCell key={axis} className="text-right">
                            <Input
                              type="number"
                              step="any"
                              value={draft[axis] !== undefined ? draft[axis] : node[axis]}
                              onChange={e => setDraft(node.id, axis, e.target.value)}
                              className="w-24 ml-auto bg-[#0d140d] border-[#4a544a] font-mono text-xs text-right text-[#d4d4d4]/80"
                            />
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            disabled={!hasDraft || savingId === node.id}
                            onClick={() => handleSave(node)}
                          >
                            {savingId === node.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c5b358]/50" />
                            ) : savedId === node.id ? (
                              <Check className="w-3.5 h-3.5 text-[#8a9a6a]" />
                            ) : (
                              <Save className={`w-3.5 h-3.5 ${hasDraft ? 'text-[#c5b358]' : 'text-[#4a544a]'}`} />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile stacked cards */}
            <div className="md:hidden space-y-3">
              {filtered.map(node => {
                const draft = drafts[node.id] || {};
                const hasDraft = Object.keys(draft).length > 0;
                return (
                  <div key={node.id} className="rounded-xl border border-[#4a544a] bg-[#1a2a1a] p-4 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full border border-[#4a544a] flex-shrink-0" style={{ backgroundColor: node.hex }} />
                      <span className="font-medium flex-1 truncate text-[#d4d4d4]">{node.name}</span>
                      <Badge variant="outline" className={`capitalize ${tierStyles[node.tier] || ''}`}>{node.tier}</Badge>
                    </div>
                    {node.parent_anchor_id && anchorMap.get(node.parent_anchor_id) && (
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full border border-[#4a544a]" style={{ backgroundColor: anchorMap.get(node.parent_anchor_id).hex }} />
                        <span className="text-xs text-[#d4d4d4]/60">{anchorMap.get(node.parent_anchor_id).name}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      {['x', 'y', 'z'].map(axis => (
                        <div key={axis}>
                          <label className="text-[10px] text-[#c5b358]/60 uppercase block mb-1">{axis}</label>
                          <Input
                            type="number"
                            step="any"
                            value={draft[axis] !== undefined ? draft[axis] : node[axis]}
                            onChange={e => setDraft(node.id, axis, e.target.value)}
                            className="bg-[#0d140d] border-[#4a544a] font-mono text-xs text-[#d4d4d4]/80"
                          />
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full border border-[#4a544a] text-[#c5b358] hover:bg-[#c5b358]/10"
                      disabled={!hasDraft || savingId === node.id}
                      onClick={() => handleSave(node)}
                    >
                      {savingId === node.id ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-[#c5b358]/50" />
                      ) : savedId === node.id ? (
                        <Check className="w-3.5 h-3.5 mr-1.5 text-[#8a9a6a]" />
                      ) : (
                        <Save className={`w-3.5 h-3.5 mr-1.5 ${hasDraft ? 'text-[#c5b358]' : 'text-[#4a544a]'}`} />
                      )}
                      Save
                    </Button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}