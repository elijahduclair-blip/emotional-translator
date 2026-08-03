import React from 'react';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Loader2, Sparkles } from 'lucide-react';
import TraitBadge from '@/components/graph/TraitBadge';

/**
 * Wraps a child element with a hover card that displays the Librarian's
 * semantic trait associations for a profile attribute (shape, color, season).
 */
export default function AttributeTooltip({ label, traits, loading, children, profileId }) {
  const hasTraits = traits && traits.length > 0;

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <span className="cursor-help inline-flex">{children}</span>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        className="w-64 bg-[#1a2a1a] border-2 border-[#4a544a] text-[#d4d4d4] p-4 space-y-2"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(197,179,88,0.1), 0 4px 16px rgba(0,0,0,0.5)' }}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-[#c5b358]" />
          <span className="text-xs font-semibold text-[#c5b358]" style={{ fontFamily: 'EB Garamond, serif' }}>
            {label}
          </span>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#4a544a]">
            <Loader2 className="w-3 h-3 animate-spin" /> Resolving semantic traits…
          </div>
        )}

        {!loading && hasTraits && (
          <div className="flex flex-wrap gap-1.5">
            {traits.map((t, i) => (
              <TraitBadge key={i} trait={t} profileId={profileId} />
            ))}
          </div>
        )}

        {!loading && !hasTraits && (
          <p className="text-[10px] text-[#4a544a]/60" style={{ fontFamily: 'EB Garamond, serif' }}>
            No semantic traits resolved for this attribute.
          </p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}