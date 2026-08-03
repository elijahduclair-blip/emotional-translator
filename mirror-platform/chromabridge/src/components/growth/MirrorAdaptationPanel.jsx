import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Compass, Tag, Star, GitBranch } from 'lucide-react';
import moment from 'moment';

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-white/35">{label}</p>
        <p className="text-base font-semibold text-white/90 leading-tight truncate">{value}</p>
      </div>
    </div>
  );
}

export default function MirrorAdaptationPanel({ profile, nodes }) {
  const data = useMemo(() => {
    const trajectory = (profile?.star_trajectory || []).map((p, i) => ({
      date: moment(p.moved_at || p.x).format('M/D'),
      r: Math.round(Math.sqrt((p.x || 0) ** 2 + (p.y || 0) ** 2 + (p.z || 0) ** 2)),
      idx: i,
    }));
    const labels = profile?.semantic_labels || [];
    const traits = nodes.filter((n) => n.is_trait).length;
    return { trajectory, labels, traits };
  }, [profile, nodes]);

  if (!profile) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#16161F] p-5 h-full flex items-center justify-center text-xs text-white/30 text-center">
        Create a persona profile in the Mirror to see how it is adapting to you.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#16161F] p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Compass className="w-4 h-4 text-amber-300" />
        <h2 className="text-sm font-semibold text-white/90">Mirror Adaptation</h2>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Stat icon={Star} label="Lens" value={profile.archetype || '—'} color="#FFB042" />
        <Stat icon={GitBranch} label="Trait bridges" value={data.traits} color="#A78BFA" />
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/35 mb-2 flex items-center gap-1.5">
          <Tag className="w-3 h-3" /> Semantic labels earned
        </p>
        {data.labels.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {data.labels.map((l) => (
              <span key={l} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-200/80 border border-amber-500/20">
                {l}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-white/25">No labels earned yet.</p>
        )}
      </div>

      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-wider text-white/35 mb-2">Semantic origin drift</p>
        {data.trajectory.length > 1 ? (
          <div className="h-28 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trajectory} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }} axisLine={false} tickLine={false} minTickGap={20} />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ background: '#0E0E13', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'rgba(255,255,255,0.6)' }} />
                <Line type="monotone" dataKey="r" stroke="#6C9EFF" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-white/25">The star has not moved yet — your semantic origin is still settling.</p>
        )}
      </div>
    </div>
  );
}