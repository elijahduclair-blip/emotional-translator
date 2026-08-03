import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, TrendingUp, Camera, Zap } from 'lucide-react';
import { SHAPE_TRAITS, TRAIT_CATEGORIES, FORCE_GROUPS, computeShapeDistribution, getDominantForce } from '@/utils/shapeTraits';

const SHAPE_PREVIEW = {
  Square: <svg viewBox="0 0 40 40" className="w-4 h-4"><rect x="6" y="6" width="28" height="28" fill="currentColor" /></svg>,
  Rectangle: <svg viewBox="0 0 40 40" className="w-4 h-4"><rect x="2" y="12" width="36" height="16" fill="currentColor" /></svg>,
  Parallelogram: <svg viewBox="0 0 40 40" className="w-4 h-4"><polygon points="12,6 38,6 28,34 2,34" fill="currentColor" /></svg>,
  Trapezoid: <svg viewBox="0 0 40 40" className="w-4 h-4"><polygon points="10,6 30,6 38,34 2,34" fill="currentColor" /></svg>,
  Rhombus: <svg viewBox="0 0 40 40" className="w-4 h-4"><polygon points="20,2 38,20 20,38 2,20" fill="currentColor" /></svg>,
  Kite: <svg viewBox="0 0 40 40" className="w-4 h-4"><polygon points="20,2 32,16 20,38 8,16" fill="currentColor" /></svg>,
  Irregular: <svg viewBox="0 0 40 40" className="w-4 h-4"><polygon points="6,10 24,4 36,18 28,34 12,30 2,22" fill="currentColor" /></svg>,
};

export default function ShapeVelocityPanel({ profile }) {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [currentDist, setCurrentDist] = useState(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const logs = await base44.entities.TraitTrackingLog.filter(
        { profile_id: profile.id },
        '-snapshot_at',
        20
      );
      setSnapshots(logs);
      if (logs.length > 0) {
        setCurrentDist({
          distribution: logs[0].distribution || [],
          dominant_force: logs[0].dominant_force,
          force_counts: logs[0].force_counts || { gravity: 0, current: 0, refraction: 0 },
          total_nodes: logs[0].total_nodes || 0,
        });
      } else {
        // Compute from profile shapes directly if no snapshots exist
        const dist = computeShapeDistribution(profile.fav_shapes);
        const dominant = getDominantForce(dist);
        const distribution = Object.entries(dist).map(([trait, data]) => ({
          trait,
          shape: data.shapes[0],
          count: data.count,
          force: data.force,
        }));
        setCurrentDist({
          distribution,
          dominant_force: dominant.force,
          force_counts: dominant.counts,
          total_nodes: distribution.reduce((s, d) => s + d.count, 0),
        });
      }
    } catch {
      // fall back to local computation
      const dist = computeShapeDistribution(profile.fav_shapes);
      const dominant = getDominantForce(dist);
      const distribution = Object.entries(dist).map(([trait, data]) => ({
        trait,
        shape: data.shapes[0],
        count: data.count,
        force: data.force,
      }));
      setCurrentDist({
        distribution,
        dominant_force: dominant.force,
        force_counts: dominant.counts,
        total_nodes: distribution.reduce((s, d) => s + d.count, 0),
      });
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSnapshot = async () => {
    if (!profile || snapshotting) return;
    setSnapshotting(true);
    try {
      await base44.functions.invoke('snapshotShapeDistribution', {
        profile_id: profile.id,
        trigger: 'manual',
      });
      await load();
    } catch {
      // ignore
    } finally {
      setSnapshotting(false);
    }
  };

  if (!currentDist) {
    return (
      <div className="rounded-3xl p-7 flex justify-center" style={{ background: 'linear-gradient(135deg, #FCEADD 0%, #F5D3C2 100%)', boxShadow: '0 8px 40px rgba(120, 100, 80, 0.12)' }}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-[#A9866F]" /> : null}
      </div>
    );
  }

  const { distribution, dominant_force, force_counts, total_nodes } = currentDist;
  const dominantGroup = FORCE_GROUPS[dominant_force] || FORCE_GROUPS.gravity;
  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  // Build sparkline data from snapshots (force_counts over time)
  const sparklineData = snapshots.slice(0, 10).reverse().map((s) => ({
    gravity: s.force_counts?.gravity || 0,
    current: s.force_counts?.current || 0,
    refraction: s.force_counts?.refraction || 0,
  }));

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
          <TrendingUp className="w-4 h-4 text-[#A9866F]" />
          <h3 className="text-base font-semibold text-[#2A2726]">
            Shape Velocity
          </h3>
        </div>
        <button
          onClick={handleSnapshot}
          disabled={snapshotting}
          className="flex items-center gap-1 text-xs text-[#2A2726] bg-[#D3BDB1]/50 px-3 py-1 rounded-full transition-colors hover:bg-[#D3BDB1]/70 disabled:opacity-50"
        >
          {snapshotting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
          Snapshot
        </button>
      </div>

      {/* Dominant Force */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[#D3BDB1]/30 rounded-full">
        <Zap className="w-3.5 h-3.5" style={{ color: dominantGroup.color }} />
        <span className="text-xs text-[#2A2726] font-semibold">
          {dominantGroup.label}
        </span>
        <span className="text-[10px] text-[#A9866F] ml-auto">{dominantGroup.description}</span>
      </div>

      {/* Trait Distribution Bars */}
      <div className="space-y-2 pt-4 mt-4 border-t border-[#DBC6B8]">
        {TRAIT_CATEGORIES.map((cat) => {
          const entry = distribution.find((d) => d.trait === cat.trait);
          const count = entry?.count || 0;
          const pct = total_nodes > 0 ? (count / total_nodes) * 100 : 0;
          const barWidth = (count / maxCount) * 100;
          return (
            <div key={cat.trait} className="flex items-center gap-2">
              <span className="text-[#A9866F] shrink-0">{SHAPE_PREVIEW[cat.shape]}</span>
              <span className="text-[10px] text-[#2A2726]/70 w-24 shrink-0 truncate">
                {cat.trait}
              </span>
              <div className="flex-1 h-2.5 bg-[#DBC6B8]/40 rounded-full relative overflow-hidden">
                <div
                  className="absolute h-full rounded-full transition-all"
                  style={{ width: `${barWidth}%`, backgroundColor: cat.color, opacity: count > 0 ? 0.8 : 0.2 }}
                />
              </div>
              <span className="text-[10px] text-[#A9866F] w-8 text-right font-mono">{count}</span>
              <span className="text-[9px] text-[#A9866F]/60 w-8 text-right font-mono">{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>

      {/* Force Group Summary */}
      <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-[#DBC6B8]">
        {Object.entries(FORCE_GROUPS).map(([force, group]) => {
          const count = force_counts[force] || 0;
          const pct = total_nodes > 0 ? (count / total_nodes) * 100 : 0;
          const isDominant = force === dominant_force;
          return (
            <div
              key={force}
              className={`px-3 py-2 rounded-2xl ${isDominant ? 'bg-[#D3BDB1]/40' : 'bg-[#D3BDB1]/20'}`}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                <span className="text-[9px] text-[#2A2726]/70">
                  {group.label}
                </span>
              </div>
              <div className="text-xs font-mono mt-0.5" style={{ color: group.color }}>
                {count} <span className="text-[9px] text-[#A9866F]">({pct.toFixed(0)}%)</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sparkline (history) */}
      {sparklineData.length > 1 && (
        <div className="pt-4 mt-4 border-t border-[#DBC6B8]">
          <p className="text-[10px] text-[#A9866F] uppercase tracking-wider mb-2">
            Force History ({sparklineData.length} snapshots)
          </p>
          <div className="flex items-end gap-1 h-12">
            {sparklineData.map((s, i) => {
              const total = s.gravity + s.current + s.refraction || 1;
              const gH = (s.gravity / total) * 100;
              const cH = (s.current / total) * 100;
              const rH = (s.refraction / total) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col-reverse h-full rounded-sm overflow-hidden bg-[#DBC6B8]/30">
                  <div style={{ height: `${gH}%`, backgroundColor: FORCE_GROUPS.gravity.color, opacity: 0.7 }} />
                  <div style={{ height: `${cH}%`, backgroundColor: FORCE_GROUPS.current.color, opacity: 0.7 }} />
                  <div style={{ height: `${rH}%`, backgroundColor: FORCE_GROUPS.refraction.color, opacity: 0.7 }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[10px] text-[#A9866F]/70 text-center pt-4 mt-4 border-t border-[#DBC6B8]">
        {total_nodes} total trait signals across {distribution.length} categories
      </p>
    </div>
  );
}