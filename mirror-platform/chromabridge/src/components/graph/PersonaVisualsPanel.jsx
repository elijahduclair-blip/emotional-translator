import React, { useMemo } from 'react';
import { Shapes, Globe, Layers, Radio } from 'lucide-react';
import { resolvePreferredDomainId, getShapeForTier } from '@/utils/personaVisuals';

const TIER_LABELS = {
  base: 'Base',
  bridge: 'Bridge',
  shade: 'Shade',
  words: 'Words',
};

const TIER_ORDER = ['base', 'bridge', 'shade', 'words'];

const SHAPE_PREVIEW = {
  Square: <svg viewBox="0 0 40 40" className="w-6 h-6"><rect x="6" y="6" width="28" height="28" fill="currentColor" /></svg>,
  Rectangle: <svg viewBox="0 0 40 40" className="w-6 h-6"><rect x="2" y="12" width="36" height="16" fill="currentColor" /></svg>,
  Parallelogram: <svg viewBox="0 0 40 40" className="w-6 h-6"><polygon points="12,6 38,6 28,34 2,34" fill="currentColor" /></svg>,
  Trapezoid: <svg viewBox="0 0 40 40" className="w-6 h-6"><polygon points="10,6 30,6 38,34 2,34" fill="currentColor" /></svg>,
  Rhombus: <svg viewBox="0 0 40 40" className="w-6 h-6"><polygon points="20,2 38,20 20,38 2,20" fill="currentColor" /></svg>,
  Kite: <svg viewBox="0 0 40 40" className="w-6 h-6"><polygon points="20,2 32,16 20,38 8,16" fill="currentColor" /></svg>,
  Irregular: <svg viewBox="0 0 40 40" className="w-6 h-6"><polygon points="6,10 24,4 36,18 28,34 12,30 2,22" fill="currentColor" /></svg>,
};

export default function PersonaVisualsPanel({ profile, domains }) {
  const preferredDomainId = useMemo(
    () => resolvePreferredDomainId(domains, profile?.archetype),
    [domains, profile?.archetype]
  );

  const emphasizedDomain = useMemo(
    () => domains?.find(d => d.id === preferredDomainId) || null,
    [domains, preferredDomainId]
  );

  const origin = useMemo(() => ({
    x: profile?.semantic_origin_x ?? 0,
    y: profile?.semantic_origin_y ?? 0,
    z: profile?.semantic_origin_z ?? 0,
  }), [profile?.semantic_origin_x, profile?.semantic_origin_y, profile?.semantic_origin_z]);

  const tierShapes = useMemo(
    () => TIER_ORDER.map(tier => ({ tier, shape: getShapeForTier(profile, tier) })),
    [profile]
  );

  if (!profile) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-[#16161F] p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-indigo-400" />
        <h2 className="text-sm font-semibold text-white/80">Active Persona Visuals</h2>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400/70">
          <Radio className="w-3 h-3" /> live sync
        </span>
      </div>

      {/* Domain Emphasis */}
      <div>
        <p className="flex items-center gap-1.5 text-xs text-white/40 mb-2">
          <Globe className="w-3 h-3" /> Domain Emphasis
        </p>
        {emphasizedDomain ? (
          <div className="flex items-center gap-2.5 bg-white/5 rounded-lg px-3 py-2.5 border border-white/10">
            <div className="w-4 h-4 rounded-full ring-1 ring-white/20" style={{ backgroundColor: emphasizedDomain.color }} />
            <div className="flex-1">
              <p className="text-sm text-white/80">{emphasizedDomain.name}</p>
              <p className="text-[10px] text-white/30 font-mono">
                {emphasizedDomain.member_count} members · centroid ({emphasizedDomain.centroid_x?.toFixed(0)}, {emphasizedDomain.centroid_y?.toFixed(0)}, {emphasizedDomain.centroid_z?.toFixed(0)})
              </p>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300/70 border border-emerald-500/20">emphasized</span>
          </div>
        ) : (
          <p className="text-xs text-white/30 px-3 py-2.5 bg-white/5 rounded-lg border border-white/10">
            No domain mapped to archetype "{profile.archetype}"
          </p>
        )}
      </div>

      {/* Shape Morphing */}
      <div>
        <p className="flex items-center gap-1.5 text-xs text-white/40 mb-2">
          <Shapes className="w-3 h-3" /> Shape Morphing (per tier)
        </p>
        <div className="grid grid-cols-4 gap-2">
          {tierShapes.map(({ tier, shape }) => {
            const idx = TIER_ORDER.indexOf(tier);
            const shapes = profile.fav_shapes || [];
            const shapeName = shapes.length > 0 ? shapes[idx % shapes.length] : null;
            return (
              <div key={tier} className="flex flex-col items-center gap-1.5 bg-white/5 rounded-lg px-2 py-3 border border-white/10">
                <span className={shape ? 'text-white/70' : 'text-white/20'} title={shapeName}>
                  {shapeName ? (SHAPE_PREVIEW[shapeName] || <span className="w-6 h-6 rounded-full bg-white/10 block" />) : <span className="w-6 h-6 rounded-full bg-white/10 block" />}
                </span>
                <span className="text-[10px] text-white/40">{TIER_LABELS[tier]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Proximity Origin */}
      <div>
        <p className="flex items-center gap-1.5 text-xs text-white/40 mb-2">
          <Radio className="w-3 h-3" /> Proximity Origin
        </p>
        <div className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2.5 border border-white/10">
          <span className="text-[10px] text-white/30">X</span>
          <span className="text-xs font-mono text-white/70">{origin.x.toFixed(1)}</span>
          <span className="text-[10px] text-white/30">Y</span>
          <span className="text-xs font-mono text-white/70">{origin.y.toFixed(1)}</span>
          <span className="text-[10px] text-white/30">Z</span>
          <span className="text-xs font-mono text-white/70">{origin.z.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}