import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, GitBranch, Sparkles, Check, ArrowUpRight } from 'lucide-react';

export default function TraitPromotionPanel({ profile }) {
  const [candidates, setCandidates] = useState(null);
  const [promoted, setPromoted] = useState([]);
  const [threshold, setThreshold] = useState(5);
  const [loading, setLoading] = useState(false);
  const [promoting, setPromoting] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('discoverTraitCandidates', { profile_id: profile.id });
      setCandidates(res.data.candidates || []);
      setPromoted(res.data.promoted || []);
      setThreshold(res.data.threshold || 5);
    } catch (e) {
      setError(e.message || 'Failed to scan traits.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const handlePromote = async (traitName) => {
    if (!profile || promoting) return;
    setPromoting(traitName);
    setError(null);
    try {
      await base44.functions.invoke('promoteTraitToBridge', {
        trait_name: traitName,
        profile_id: profile.id,
      });
      await load();
    } catch (e) {
      setError(e.message || 'Failed to promote trait.');
    } finally {
      setPromoting(null);
    }
  };

  const eligible = (candidates || []).filter((c) => c.node_count >= threshold);
  const belowThreshold = (candidates || []).filter((c) => c.node_count < threshold);

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
          <GitBranch className="w-4 h-4 text-[#A9866F]" />
          <h3 className="text-base font-semibold text-[#2A2726]">
            Trait Bridges
          </h3>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs text-[#2A2726] bg-[#D3BDB1]/50 px-3 py-1 rounded-full transition-colors hover:bg-[#D3BDB1]/70 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Scan'}
        </button>
      </div>

      <p className="text-xs text-[#2A2726]/70 leading-relaxed pb-4">
        Persona traits and favorite shapes that accumulate enough graph density are promoted
        to bridge nodes — structural indices the Librarian uses to find nodes in your Active Memory.
      </p>

      {error && (
        <div className="text-xs text-red-700 bg-red-100/50 border border-red-300/40 px-3 py-2 rounded-xl mb-4">
          {error}
        </div>
      )}

      {/* Promoted trait bridges */}
      {promoted.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-[#DBC6B8]">
          <p className="text-[10px] text-[#A9866F] uppercase tracking-wider">
            Bridged
          </p>
          <div className="flex flex-wrap gap-1.5">
            {promoted.map((t) => (
              <span
                key={t.id}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-[#D3BDB1]/40 text-[#2A2726] rounded-full"
              >
                <span className="w-2.5 h-2.5 rounded-full border border-[#DBC6B8]" style={{ backgroundColor: t.hex }} />
                {t.name}
                <Check className="w-3 h-3 text-[#A9866F]" />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Eligible candidates */}
      {eligible.length > 0 && (
        <div className="space-y-2 pt-4 mt-4 border-t border-[#DBC6B8]">
          <p className="text-[10px] text-[#A9866F] uppercase tracking-wider">
            Ready to Bridge
          </p>
          <div className="space-y-1.5">
            {eligible.map((c) => (
              <div
                key={c.trait}
                className="flex items-center justify-between gap-2 px-3 py-2 bg-[#D3BDB1]/20 rounded-2xl"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="w-3 h-3 text-[#A9866F] shrink-0" />
                  <span className="text-xs text-[#2A2726] truncate">
                    {c.trait}
                  </span>
                  <span className="text-[10px] text-[#A9866F] shrink-0">
                    {c.node_count} nodes
                  </span>
                </div>
                <button
                  onClick={() => handlePromote(c.trait)}
                  disabled={promoting !== null}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-[#D3BDB1]/50 text-[#2A2726] rounded-full hover:bg-[#D3BDB1]/70 transition-colors disabled:opacity-50"
                >
                  {promoting === c.trait ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ArrowUpRight className="w-3 h-3" />
                  )}
                  Bridge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Below threshold */}
      {belowThreshold.length > 0 && (
        <div className="space-y-2 pt-4 mt-4 border-t border-[#DBC6B8]">
          <p className="text-[10px] text-[#A9866F] uppercase tracking-wider">
            Gathering Density ({threshold}+ needed)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {belowThreshold.map((c) => (
              <span
                key={c.trait}
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-[#D3BDB1]/25 text-[#2A2726]/70 rounded-full"
              >
                {c.trait}
                <span className="text-[9px] text-[#A9866F]">{c.node_count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Empty / initial state */}
      {candidates && eligible.length === 0 && belowThreshold.length === 0 && promoted.length === 0 && (
        <p className="text-xs text-[#A9866F] text-center py-4">
          No trait labels on this profile yet.
        </p>
      )}
    </div>
  );
}