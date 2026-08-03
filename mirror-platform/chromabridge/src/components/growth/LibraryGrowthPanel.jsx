import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, Layers, GitBranch, Star, Archive } from 'lucide-react';
import moment from 'moment';

const TIER_COLORS = {
  persona: '#FFB042',
  base: '#6C9EFF',
  bridge: '#A78BFA',
  shade: '#34D399',
  words: '#94A3B8',
};
const TIER_ORDER = ['persona', 'base', 'bridge', 'shade', 'words'];

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-white/35">{label}</p>
        <p className="text-lg font-semibold text-white/90 leading-tight">{value}</p>
      </div>
    </div>
  );
}

export default function LibraryGrowthPanel({ nodes }) {
  const data = useMemo(() => {
    const sorted = [...nodes].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    const series = [];
    let cum = 0;
    sorted.forEach((n) => {
      cum += 1;
      series.push({ date: moment(n.created_date).format('MMM D'), count: cum });
    });
    // downsample if too dense — keep last 30 points
    const step = Math.max(1, Math.ceil(series.length / 30));
    const sampled = series.filter((_, i) => i % step === 0 || i === series.length - 1);

    const tierCounts = {};
    TIER_ORDER.forEach((t) => { tierCounts[t] = 0; });
    let active = 0, archived = 0, traits = 0;
    sorted.forEach((n) => {
      const t = tierCounts[n.tier] !== undefined ? n.tier : 'shade';
      tierCounts[t] += 1;
      if (n.memory_status === 'archived') archived += 1; else active += 1;
      if (n.is_trait) traits += 1;
    });
    const pie = TIER_ORDER.map((t) => ({ name: t, value: tierCounts[t], color: TIER_COLORS[t] })).filter((d) => d.value > 0);

    return { sampled, pie, active, archived, traits, total: sorted.length, recent: sorted.slice(-4).reverse() };
  }, [nodes]);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#16161F] p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-amber-300" />
        <h2 className="text-sm font-semibold text-white/90">Library Expansion</h2>
        <span className="ml-auto text-xs text-white/30">{data.total} personal nodes</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        <Stat icon={Layers} label="Active" value={data.active} color="#34D399" />
        <Stat icon={Archive} label="Archived" value={data.archived} color="#94A3B8" />
        <Stat icon={GitBranch} label="Trait bridges" value={data.traits} color="#A78BFA" />
        <Stat icon={Star} label="Persona" value={data.pie.find((d) => d.name === 'persona')?.value || 0} color="#FFB042" />
      </div>

      {data.sampled.length > 1 ? (
        <div className="h-44 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.sampled} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="libGrowth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFB042" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#FFB042" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0E0E13', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'rgba(255,255,255,0.6)' }} />
              <Area type="monotone" dataKey="count" stroke="#FFB042" strokeWidth={2} fill="url(#libGrowth)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-44 flex items-center justify-center text-xs text-white/30 border border-dashed border-white/10 rounded-xl">
          Not enough nodes to chart growth yet.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/35 mb-2">Tier distribution</p>
          {data.pie.length > 0 ? (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.pie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={28} outerRadius={50} paddingAngle={2}>
                    {data.pie.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0E0E13', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-xs text-white/20">No nodes yet.</p>}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/35 mb-2">Recent additions</p>
          <div className="space-y-1.5">
            {data.recent.map((n) => (
              <div key={n.id} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: n.hex }} />
                <span className="text-white/70 truncate">{n.name}</span>
                <span className="ml-auto text-white/25 capitalize text-[10px]">{n.tier}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}