import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Loader2, GitBranch, Box, Compass } from 'lucide-react';

/**
 * A single persona trait tag with a hover card that displays the trait's
 * bridge node metadata (associated bridges, base anchors, coordinates).
 */
export default function TraitBadge({ trait, profileId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const handleHover = async (open) => {
    if (!open || fetched) return;
    setLoading(true);
    try {
      const nodes = await base44.entities.ColorNode.filter({
        name: trait,
        is_trait: true,
        trait_profile_id: profileId,
      });
      const bridge = nodes && nodes[0];
      if (!bridge) {
        setData({ notBridged: true });
        setFetched(true);
        return;
      }
      // Fetch nodes associated with this trait (nodes that list this trait in trait_associations)
      const associated = await base44.entities.ColorNode.filter({
        trait_associations: trait,
        memory_status: 'active',
      });
      setData({
        bridge,
        associated: associated.slice(0, 8),
        associatedCount: associated.length,
      });
      setFetched(true);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <HoverCard openDelay={150} onOpenChange={handleHover}>
      <HoverCardTrigger asChild>
        <span
          className="text-xs px-3 py-1 rounded-full text-[#2A2726] cursor-help transition-all hover:shadow-sm"
          style={{ fontFamily: 'EB Garamond, serif', background: 'rgba(211, 189, 177, 0.5)' }}
        >
          {trait}
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-72 bg-[#1a2a1a] border-2 border-[#4a544a] text-[#d4d4d4] p-4 space-y-3"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(197,179,88,0.1), 0 4px 16px rgba(0,0,0,0.5)' }}
      >
        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#4a544a]">
            <Loader2 className="w-3 h-3 animate-spin" /> Reading bridge…
          </div>
        )}

        {!loading && data?.notBridged && (
          <div className="space-y-2">
            <p className="text-xs text-[#4a544a]" style={{ fontFamily: 'EB Garamond, serif' }}>
              This trait has not yet been promoted to a bridge node.
            </p>
            <p className="text-[10px] text-[#4a544a]/60" style={{ fontFamily: 'EB Garamond, serif' }}>
              Once it accumulates enough graph density, it can be bridged.
            </p>
          </div>
        )}

        {!loading && data?.bridge && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 border border-[#4a544a]" style={{ backgroundColor: data.bridge.hex }} />
              <GitBranch className="w-3 h-3 text-[#c5b358]" />
              <span className="text-xs font-semibold text-[#c5b358]" style={{ fontFamily: 'EB Garamond, serif' }}>
                {data.bridge.name}
              </span>
            </div>

            {data.bridge.parents && data.bridge.parents.length > 0 && (
              <div className="flex items-start gap-2">
                <Compass className="w-3 h-3 text-[#4a544a] mt-0.5 shrink-0" />
                <div className="flex flex-wrap gap-1">
                  {data.bridge.parents.map((p, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[#0d140d] text-[#d4d4d4]/70 border border-[#4a544a]/40">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.bridge.trait_associations && data.bridge.trait_associations.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] text-[#4a544a] uppercase tracking-wider" style={{ fontFamily: 'EB Garamond, serif' }}>
                  Associations
                </p>
                <div className="flex flex-wrap gap-1">
                  {data.bridge.trait_associations.map((a, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[#c5b358]/5 text-[#c5b358]/70 border border-[#c5b358]/20">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-[#4a544a]/40">
              <div className="flex items-center gap-1.5 mb-1">
                <Box className="w-3 h-3 text-[#4a544a]" />
                <span className="text-[10px] text-[#4a544a]" style={{ fontFamily: 'EB Garamond, serif' }}>
                  {data.associatedCount} node{data.associatedCount !== 1 ? 's' : ''} in active memory
                </span>
              </div>
              {data.associated.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.associated.map((n, i) => (
                    <span key={i} className="text-[9px] px-1 py-0.5 bg-[#0d140d] text-[#d4d4d4]/40 border border-[#4a544a]/30 truncate max-w-[100px]">
                      {n.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 text-[9px] text-[#4a544a]/60 font-mono pt-1">
              <span>X: {data.bridge.x}</span>
              <span>Y: {data.bridge.y}</span>
              <span>Z: {data.bridge.z}</span>
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}