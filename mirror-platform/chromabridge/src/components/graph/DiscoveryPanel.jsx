import React from 'react';
import { Sparkles, X, GitBranch, Shield, EyeOff, PlusCircle, RefreshCw, Zap, Pencil, AlertCircle, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useBackToClose } from '@/hooks/useBackToClose';

const TYPE_META = {
  bridge: { icon: GitBranch, label: 'Candidate bridge', badge: 'bg-amber-500/15 text-amber-300/80 border-amber-500/20' },
  new_node: { icon: Zap, label: 'Missing concept', badge: 'bg-violet-500/15 text-violet-300 border-violet-500/20' },
  territory_mismatch: { icon: AlertCircle, label: 'Territory mismatch', badge: 'bg-rose-500/15 text-rose-300 border-rose-500/20' },
  dense_pocket: { icon: Layers, label: 'Dense pocket', badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20' },
};

function ClusterMetrics({ cluster }) {
  if (!cluster) return null;
  return (
    <div className="grid grid-cols-2 gap-1 text-[10px] text-white/40 mb-2">
      <span>Radius: <span className="font-mono text-white/60">{(cluster.radius || 0).toFixed(1)}</span></span>
      <span>Density: <span className="font-mono text-white/60">{(cluster.density || 0).toFixed(4)}</span></span>
      <span>Variance: <span className="font-mono text-white/60">{(cluster.variance || 0).toFixed(1)}</span></span>
      <span>Overlap: <span className="font-mono text-white/60">{cluster.overlapPct || 0}%</span></span>
      <span>Nearest: <span className="font-mono text-white/60">{(cluster.nearestTerritoryDist || 0).toFixed(1)}</span></span>
      <span>Nodes: <span className="font-mono text-white/60">{cluster.size || cluster.localDensity || 0}</span></span>
    </div>
  );
}

function DiscoveryContent({ candidates, selectedId, onSelect, onCreateBridge, onCreateConcept, onCreateConceptInstant, onCreateRepresentative, onDismiss, onRefresh, refreshing, onClose }) {
  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span className="text-sm font-medium text-white/90">Discovery</span>
          <span className="text-xs text-white/30">{candidates.length} candidates</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onRefresh} disabled={refreshing} className="text-white/30 hover:text-white transition-colors disabled:opacity-40" title="Run discovery scan">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-6 safe-bottom">
        {candidates.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-white/30">
            No candidates found. Click refresh to run a new scan.
          </div>
        )}
        {candidates.map((c) => {
          const id = c.id;
          const isSelected = id === selectedId;
          const isClusterType = c.type === 'territory_mismatch' || c.type === 'dense_pocket';
          const meta = TYPE_META[c.type] || TYPE_META.bridge;
          const TypeIcon = meta.icon;

          return (
            <div
              key={id}
              onClick={() => onSelect(isSelected ? null : id)}
              className={`px-4 py-3 border-b border-white/5 cursor-pointer transition-colors ${isSelected ? 'bg-amber-500/10' : 'hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <TypeIcon className="w-3.5 h-3.5 text-white/50 flex-shrink-0" />
                {c.nodeA ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.nodeA.hex }} />
                    <span className="text-xs text-white/80">{c.nodeA.name}</span>
                  </span>
                ) : isClusterType ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.cluster?.blendHex || '#888' }} />
                    <span className="text-xs text-white/80">Cluster of {c.cluster?.size || c.localDensity || '?'}</span>
                  </span>
                ) : null}
                {c.nodeB && (
                  <>
                    <span className="text-white/30 text-xs">↔</span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.nodeB.hex }} />
                      <span className="text-xs text-white/80">{c.nodeB.name}</span>
                    </span>
                  </>
                )}
                <span className="ml-auto text-xs font-mono text-amber-300/70">{(c.score || 0).toFixed(2)}</span>
              </div>

              <div className="flex items-center gap-1.5 mb-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${meta.badge}`}>
                  {meta.label}
                </span>
              </div>

              {isClusterType && c.insight && (
                <p className="text-xs text-white/50 italic mb-2 leading-relaxed border-l-2 border-white/10 pl-2">
                  {c.insight}
                </p>
              )}

              {isClusterType ? (
                <ClusterMetrics cluster={c.cluster} />
              ) : (
                <div className="grid grid-cols-2 gap-1 text-[10px] text-white/40 mb-2">
                  <span>Distance: <span className="font-mono text-white/60">{(c.distance || 0).toFixed(1)}</span></span>
                  <span>Shared: <span className="font-mono text-white/60">{c.sharedNeighbors || 0}</span></span>
                  <span>Density: <span className="font-mono text-white/60">{c.localDensity || 0}</span></span>
                  <span>Placement: <span className="text-white/60">{c.placementSources}</span></span>
                </div>
              )}

              {isSelected && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {c.type === 'new_node' && (
                    <>
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); onCreateConceptInstant(c); }} className="h-7 px-2 text-[11px] bg-violet-500/30 text-violet-200 border border-violet-500/40 hover:bg-violet-500/40 rounded-full">
                        <Zap className="w-3 h-3 mr-1" />Create
                      </Button>
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); onCreateConcept(c); }} className="h-7 px-2 text-[11px] bg-violet-500/15 text-violet-300/70 border border-violet-500/20 hover:bg-violet-500/25 rounded-full">
                        <Pencil className="w-3 h-3 mr-1" />Name…
                      </Button>
                    </>
                  )}
                  {c.type === 'bridge' && (
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); onCreateBridge(c); }} className="h-7 px-2 text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 rounded-full">
                      <GitBranch className="w-3 h-3 mr-1" />Create bridge
                    </Button>
                  )}
                  {c.type === 'dense_pocket' && (
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); onCreateRepresentative(c); }} className="h-7 px-2 text-[11px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 rounded-full">
                      <PlusCircle className="w-3 h-3 mr-1" />Create representative
                    </Button>
                  )}
                  <Button size="sm" onClick={(e) => { e.stopPropagation(); onDismiss(c); }} className="h-7 px-2 text-[11px] bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 rounded-full">
                    <Shield className="w-3 h-3 mr-1" />Boundary
                  </Button>
                  <Button size="sm" onClick={(e) => { e.stopPropagation(); onDismiss(c); }} className="h-7 px-2 text-[11px] bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 rounded-full">
                    <EyeOff className="w-3 h-3 mr-1" />Ignore
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function DiscoveryPanel({ open, candidates, selectedId, onSelect, onCreateBridge, onCreateConcept, onCreateConceptInstant, onCreateRepresentative, onDismiss, onRefresh, refreshing, onClose }) {
  const isMobile = useIsMobile();
  useBackToClose(open, onClose);

  const contentProps = { candidates, selectedId, onSelect, onCreateBridge, onCreateConcept, onCreateConceptInstant, onCreateRepresentative, onDismiss, onRefresh, refreshing, onClose };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DrawerContent className="max-h-[80vh] bg-[#16161F] border-white/10 flex flex-col">
          <DiscoveryContent {...contentProps} />
        </DrawerContent>
      </Drawer>
    );
  }

  if (!open) return null;
  return (
    <div className="absolute top-16 right-4 z-10 w-80 max-h-[calc(100vh-8rem)] flex flex-col bg-[#16161F]/95 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl">
      <DiscoveryContent {...contentProps} />
    </div>
  );
}