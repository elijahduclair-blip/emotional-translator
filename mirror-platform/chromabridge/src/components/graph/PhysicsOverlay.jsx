import React, { useState, useMemo } from 'react';
import { Loader2, Atom, ArrowRight, Zap } from 'lucide-react';
import { computeFieldForce, cognitiveDrift, nodePhysicsProfile, getNodeForceGroup } from '@/utils/physicsEngine';
import { FORCE_GROUPS } from '@/utils/shapeTraits';

const FORCE_COLORS = {
  gravity: '#5b6ee0',
  current: '#d9a64a',
  refraction: '#4ad97a',
};

export default function PhysicsOverlay({ nodes, profile }) {
  const [enabled, setEnabled] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // Compute physics profiles for all nodes with shape-trait metadata
  const physicsData = useMemo(() => {
    if (!nodes || nodes.length === 0) return [];
    return nodes
      .filter((n) => getNodeForceGroup(n))
      .map((node) => {
        const neighbors = nodes.filter((n) => n.id !== node.id && vectorDistance(n, node) < 100);
        const profile = nodePhysicsProfile(node, neighbors);
        return { node, ...profile };
      });
  }, [nodes]);

  // Compute field force at the profile's semantic origin
  const profileForce = useMemo(() => {
    if (!profile || nodes.length === 0) return null;
    const point = {
      x: profile.semantic_origin_x ?? 0,
      y: profile.semantic_origin_y ?? 0,
      z: profile.semantic_origin_z ?? 0,
    };
    return computeFieldForce(point, nodes);
  }, [profile, nodes]);

  // Force group distribution
  const forceStats = useMemo(() => {
    const stats = { gravity: 0, current: 0, refraction: 0 };
    for (const p of physicsData) {
      if (p.forceGroup) stats[p.forceGroup]++;
    }
    return stats;
  }, [physicsData]);

  const topNodes = useMemo(() => {
    return [...physicsData].sort((a, b) => b.energy - a.energy).slice(0, 5);
  }, [physicsData]);

  const selectedNode = selectedNodeId
    ? physicsData.find((p) => p.node.id === selectedNodeId)
    : null;

  if (physicsData.length === 0) {
    return (
      <div className="rounded-3xl p-7 text-center" style={{ background: 'linear-gradient(135deg, #FCEADD 0%, #F5D3C2 100%)', boxShadow: '0 8px 40px rgba(120, 100, 80, 0.12)', fontFamily: 'EB Garamond, serif' }}>
        <Atom className="w-5 h-5 text-[#A9866F] mx-auto mb-2" />
        <p className="text-xs text-[#2A2726]">
          No shape-trait nodes detected. Run the shape-trait assignment function to seed physics metadata.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-3xl p-7 space-y-0 relative"
      style={{
        background: 'linear-gradient(135deg, #FCEADD 0%, #F5D3C2 100%)',
        boxShadow: '0 8px 40px rgba(120, 100, 80, 0.12)',
        fontFamily: 'EB Garamond, serif',
      }}
    >
      <div className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <Atom className="w-4 h-4 text-[#A9866F]" />
          <h3 className="text-base font-semibold text-[#2A2726]">
            Physics Field
          </h3>
          {enabled && (
            <span className="flex items-center gap-1 text-[9px] px-2 py-0.5 bg-[#D3BDB1]/50 text-[#2A2726] rounded-full">
              <Zap className="w-2.5 h-2.5" /> active
            </span>
          )}
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className="text-xs text-[#2A2726] bg-[#D3BDB1]/50 px-3 py-1 rounded-full transition-colors hover:bg-[#D3BDB1]/70"
        >
          {enabled ? 'Hide' : 'Show'}
        </button>
      </div>

      {enabled && (
        <>
          {/* Force group distribution */}
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-[#DBC6B8]">
            {Object.entries(FORCE_GROUPS).map(([force, group]) => {
              const count = forceStats[force] || 0;
              const pct = physicsData.length > 0 ? (count / physicsData.length) * 100 : 0;
              return (
                <div
                  key={force}
                  className="px-3 py-2 rounded-2xl bg-[#D3BDB1]/20"
                  style={{ borderTop: `2px solid ${FORCE_COLORS[force]}` }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: FORCE_COLORS[force] }} />
                    <span className="text-[10px] text-[#2A2726]/70">
                      {group.label}
                    </span>
                  </div>
                  <div className="text-sm font-mono" style={{ color: FORCE_COLORS[force] }}>
                    {count}
                    <span className="text-[9px] text-[#A9866F] ml-1">({pct.toFixed(0)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Profile origin field force */}
          {profileForce && (
            <div className="px-3 py-2.5 bg-[#D3BDB1]/20 rounded-2xl space-y-1.5 pt-4 mt-4 border-t border-[#DBC6B8]">
              <p className="text-[10px] text-[#A9866F] uppercase tracking-wider">
                Field Force at Persona Origin
              </p>
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <span className="text-[#5b6ee0]">F_x: {profileForce.fx.toFixed(3)}</span>
                <span className="text-[#d9a64a]">F_y: {profileForce.fy.toFixed(3)}</span>
                <span className="text-[#4ad97a]">F_z: {profileForce.fz.toFixed(3)}</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                {Object.entries(profileForce.contributions).map(([force, count]) => (
                  <span key={force} className="text-[9px] text-[#A9866F] flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: FORCE_COLORS[force] }} />
                    {count} {FORCE_GROUPS[force].label.toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top drifting nodes */}
          <div className="space-y-1.5 pt-4 mt-4 border-t border-[#DBC6B8]">
            <p className="text-[10px] text-[#A9866F] uppercase tracking-wider mb-1">
              High-Energy Nodes
            </p>
            {topNodes.map((p) => (
                <button
                  key={p.node.id}
                  onClick={() => setSelectedNodeId(p.node.id === selectedNodeId ? null : p.node.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-full transition-colors ${
                    p.node.id === selectedNodeId
                      ? 'bg-[#D3BDB1]/50'
                      : 'bg-[#D3BDB1]/15 hover:bg-[#D3BDB1]/30'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.forceColor }} />
                  <span className="text-xs text-[#2A2726]/70 truncate flex-1 text-left">
                    {p.node.name}
                  </span>
                  <span className="text-[9px] text-[#A9866F] font-mono">{p.energy.toFixed(2)}</span>
                  <ArrowRight className="w-3 h-3 text-[#A9866F]" />
                </button>
              ))}
          </div>

          {/* Selected node detail */}
          {selectedNode && (
            <div className="px-3 py-2.5 bg-[#D3BDB1]/20 rounded-2xl space-y-2 pt-4 mt-4 border-t border-[#DBC6B8]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedNode.forceColor }} />
                <span className="text-xs text-[#2A2726] font-semibold">
                  {selectedNode.node.name}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-[#A9866F]">Force:</span>{' '}
                  <span style={{ color: selectedNode.forceColor }}>{selectedNode.forceLabel}</span>
                </div>
                <div>
                  <span className="text-[#A9866F]">Energy:</span>{' '}
                  <span className="font-mono text-[#2A2726]/70">{selectedNode.energy.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-[#A9866F]">Resonance:</span>{' '}
                  <span className="font-mono text-[#2A2726]/70">{selectedNode.resonance.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-[#A9866F]">Drift:</span>{' '}
                  <span className="font-mono text-[#2A2726]/70">
                    ({selectedNode.drift.dx.toFixed(2)}, {selectedNode.drift.dy.toFixed(2)}, {selectedNode.drift.dz.toFixed(2)})
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Inline import to avoid circular dependency
function vectorDistance(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}