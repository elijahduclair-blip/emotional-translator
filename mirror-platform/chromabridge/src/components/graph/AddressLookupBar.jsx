import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';

/**
 * AddressLookupBar — type a word to find its 1-indexed base-26 symbolic address.
 * Matches nodes by name (case-insensitive, prefix) and shows the symbolic_address.
 */
export default function AddressLookupBar({ nodes, onSelectNode }) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !nodes) return [];
    return nodes
      .filter(n => (n.name || '').toLowerCase().includes(q))
      .slice(0, 8)
      .map(n => ({
        id: n.id,
        name: n.name,
        address: n.symbolic_address || '—',
        hex: n.hex,
      }));
  }, [query, nodes]);

  return (
    <div className="relative w-64 shrink-0">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Find symbolic address…"
        className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-8 py-1.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-violet-400/40 font-mono"
      />
      {query && (
        <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {matches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1A1A24] border border-white/10 rounded-lg shadow-xl overflow-hidden z-30">
          {matches.map(m => (
            <button
              key={m.id}
              onClick={() => {
                onSelectNode?.(m.id);
                setQuery('');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors text-left"
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.hex }} />
              <span className="text-white/80 text-xs flex-1 truncate">{m.name}</span>
              <span className="text-violet-300 text-xs font-mono tracking-wider">{m.address}</span>
            </button>
          ))}
        </div>
      )}

      {query.trim() && matches.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1A1A24] border border-white/10 rounded-lg shadow-xl px-3 py-2 text-white/40 text-xs z-30">
          No node found for "{query}"
        </div>
      )}
    </div>
  );
}