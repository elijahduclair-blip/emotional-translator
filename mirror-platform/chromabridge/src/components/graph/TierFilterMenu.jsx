import React from 'react';
import { Layers, Check } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';

const TIER_META = [
  { key: 'base', label: 'Base', dot: 'bg-amber-400', active: 'text-amber-300' },
  { key: 'bridge', label: 'Bridge', dot: 'bg-sky-400', active: 'text-sky-300' },
  { key: 'shade', label: 'Shade', dot: 'bg-white/50', active: 'text-white/70' },
  { key: 'words', label: 'Words', dot: 'bg-emerald-400', active: 'text-emerald-300' },
];

export default function TierFilterMenu({ visibleTiers, onToggle, onAll, onNone, counts }) {
  const visibleCount = TIER_META.filter(t => visibleTiers[t.key]).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors text-white bg-white/10 hover:bg-white/15"
        >
          <Layers className="w-3.5 h-3.5" />
          Tiers
          <span className="text-[10px] font-mono text-white/50">{visibleCount}/{TIER_META.length}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 bg-[#1a1a24] border-white/10 p-3">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] uppercase tracking-wider text-white/40">Tier Visibility</span>
          <div className="flex gap-1.5">
            <button onClick={onAll} className="text-[10px] text-white/50 hover:text-white transition-colors">All</button>
            <span className="text-white/20">·</span>
            <button onClick={onNone} className="text-[10px] text-white/50 hover:text-white transition-colors">None</button>
          </div>
        </div>
        <div className="space-y-1">
          {TIER_META.map(tier => {
            const isVisible = visibleTiers[tier.key];
            return (
              <div
                key={tier.key}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors ${isVisible ? 'bg-white/5' : 'opacity-50'}`}
              >
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${tier.dot}`} />
                <span className={`text-sm flex-1 ${isVisible ? tier.active : 'text-white/40'}`}>{tier.label}</span>
                <span className="text-[10px] text-white/30 font-mono">{counts?.[tier.key] || 0}</span>
                <Switch checked={isVisible} onCheckedChange={() => onToggle(tier.key)} />
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}