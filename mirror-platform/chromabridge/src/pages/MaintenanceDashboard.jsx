import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts';
import { Loader2, Activity, Network, GitBranch, ShieldCheck, RefreshCw } from 'lucide-react';

const ACCENT = '#c5b358';
const NODE_COLOR = '#7CB9E8';
const EDGE_COLOR = '#c5b358';

// Group records by day and return cumulative counts.
function buildGrowthSeries(records, dateField = 'created_date') {
  if (!records || records.length === 0) return [];
  const byDay = {};
  records.forEach((r) => {
    const d = new Date(r[dateField] || r.created_date);
    if (isNaN(d.getTime())) return;
    const key = d.toISOString().slice(0, 10);
    byDay[key] = (byDay[key] || 0) + 1;
  });
  const days = Object.keys(byDay).sort();
  const series = [];
  let cumulative = 0;
  days.forEach((day) => {
    cumulative += byDay[day];
    series.push({ date: day.slice(5), nodes: cumulative });
  });
  return series;
}

function buildEdgeSeries(records) {
  if (!records || records.length === 0) return [];
  const byDay = {};
  records.forEach((r) => {
    const d = new Date(r.created_date);
    if (isNaN(d.getTime())) return;
    const key = d.toISOString().slice(0, 10);
    byDay[key] = (byDay[key] || 0) + 1;
  });
  const days = Object.keys(byDay).sort();
  const series = [];
  let cumulative = 0;
  days.forEach((day) => {
    cumulative += byDay[day];
    series.push({ date: day.slice(5), edges: cumulative });
  });
  return series;
}

function buildMaintenanceSeries(logs) {
  if (!logs || logs.length === 0) return [];
  const byDay = {};
  logs.forEach((l) => {
    const d = new Date(l.run_at || l.created_date);
    if (isNaN(d.getTime())) return;
    const key = d.toISOString().slice(0, 10);
    if (!byDay[key]) byDay[key] = { date: key.slice(5), success: 0, partial: 0, failed: 0 };
    if (l.status === 'failed') byDay[key].failed += 1;
    else if (l.status === 'partial') byDay[key].partial += 1;
    else byDay[key].success += 1;
  });
  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div
      className="rounded-lg p-5 flex flex-col gap-2"
      style={{ backgroundColor: '#12180f', border: '1px solid rgba(197,179,88,0.25)' }}
    >
      <div className="flex items-center gap-2" style={{ color }}>
        <Icon className="w-4 h-4" />
        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: '#8a8470' }}>{label}</span>
      </div>
      <span className="text-3xl font-semibold" style={{ fontFamily: "'EB Garamond', serif", color: '#d4c5a0' }}>
        {value}
      </span>
      {sub && <span className="text-[11px]" style={{ color: '#6b6655' }}>{sub}</span>}
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div
      className="rounded-lg p-6 flex flex-col gap-4"
      style={{ backgroundColor: '#12180f', border: '1px solid rgba(197,179,88,0.25)' }}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold" style={{ fontFamily: "'EB Garamond', serif", color: '#c5b358' }}>{title}</h3>
        {subtitle && <p className="text-xs" style={{ color: '#6b6655' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function MaintenanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [logs, setLogs] = useState([]);

  const fetchData = async () => {
    const [nodeList, edgeList, logList] = await Promise.all([
      base44.entities.ColorNode.list('-created_date', 500),
      base44.entities.TrajectoryEdge.list('-created_date', 500),
      base44.entities.MaintenanceLog.list('-created_date', 200),
    ]);
    setNodes(nodeList || []);
    setEdges(edgeList || []);
    setLogs(logList || []);
  };

  useEffect(() => {
    (async () => {
      try {
        await fetchData();
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } catch {
    } finally {
      setRefreshing(false);
    }
  };

  const nodeSeries = useMemo(() => buildGrowthSeries(nodes), [nodes]);
  const edgeSeries = useMemo(() => buildEdgeSeries(edges), [edges]);
  const maintenanceSeries = useMemo(() => buildMaintenanceSeries(logs), [logs]);

  // Merge node + edge series onto a shared timeline for the combined chart.
  const combinedSeries = useMemo(() => {
    const map = {};
    nodeSeries.forEach((p) => { map[p.date] = { ...map[p.date], date: p.date, nodes: p.nodes }; });
    edgeSeries.forEach((p) => { map[p.date] = { ...map[p.date], date: p.date, edges: p.edges }; });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [nodeSeries, edgeSeries]);

  const lastLog = logs[0];
  const lastRunDate = lastLog ? new Date(lastLog.run_at || lastLog.created_date) : null;
  const graphHealthy = lastLog && lastLog.status === 'success';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0d140d' }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: ACCENT }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-24 md:pb-8"
      style={{ backgroundColor: '#0d140d', color: '#d4c5a0' }}
    >
      <div className="max-w-5xl mx-auto px-5 pt-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold" style={{ fontFamily: "'EB Garamond', serif", color: '#c5b358' }}>
              Graph Health
            </h1>
            <p className="text-xs" style={{ color: '#6b6655' }}>
              Node & connection growth, and Librarian maintenance activity over time.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-xs uppercase tracking-wider transition-opacity"
            style={{ color: '#c5b358', border: '1px solid rgba(197,179,88,0.3)', backgroundColor: 'rgba(197,179,88,0.06)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Network} label="Color Nodes" value={nodes.length} sub="total in graph" color={NODE_COLOR} />
          <StatCard icon={GitBranch} label="Connections" value={edges.length} sub="trajectory edges" color={EDGE_COLOR} />
          <StatCard
            icon={ShieldCheck}
            label="Last Maintenance"
            value={lastRunDate ? lastRunDate.toLocaleDateString() : '—'}
            sub={lastLog ? `${lastLog.status} · ${lastLog.rounds_completed} rounds` : 'no runs yet'}
            color={graphHealthy ? '#6ec07a' : '#c5b358'}
          />
          <StatCard
            icon={Activity}
            label="Maintenance Runs"
            value={logs.length}
            sub="all-time logged"
            color={ACCENT}
          />
        </div>

        {/* Combined growth chart */}
        <ChartCard
          title="Graph Growth Over Time"
          subtitle="Cumulative nodes and connections by day"
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={combinedSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(197,179,88,0.1)" />
              <XAxis dataKey="date" tick={{ fill: '#6b6655', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b6655', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#12180f', border: '1px solid rgba(197,179,88,0.3)', color: '#d4c5a0' }}
              />
              <Legend wrapperStyle={{ color: '#8a8470', fontSize: 12 }} />
              <Line type="monotone" dataKey="nodes" stroke={NODE_COLOR} strokeWidth={2} dot={false} name="Nodes" />
              <Line type="monotone" dataKey="edges" stroke={EDGE_COLOR} strokeWidth={2} dot={false} name="Connections" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Maintenance activity chart */}
        <ChartCard
          title="Librarian Maintenance Activity"
          subtitle="Automated runs grouped by day and status"
        >
          {maintenanceSeries.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-sm" style={{ color: '#6b6655' }}>
              No maintenance runs logged yet. The Librarian runs automatically every 5 hours.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={maintenanceSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(197,179,88,0.1)" />
                <XAxis dataKey="date" tick={{ fill: '#6b6655', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b6655', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#12180f', border: '1px solid rgba(197,179,88,0.3)', color: '#d4c5a0' }}
                />
                <Legend wrapperStyle={{ color: '#8a8470', fontSize: 12 }} />
                <Bar dataKey="success" stackId="a" fill="#6ec07a" name="Success" />
                <Bar dataKey="partial" stackId="a" fill={ACCENT} name="Partial" />
                <Bar dataKey="failed" stackId="a" fill="#c0654a" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Recent runs */}
        <ChartCard title="Recent Maintenance Runs" subtitle="Latest Librarian summaries">
          <div className="flex flex-col gap-2">
            {logs.length === 0 ? (
              <p className="text-sm" style={{ color: '#6b6655' }}>No runs logged yet.</p>
            ) : (
              logs.slice(0, 5).map((log) => {
                const d = new Date(log.run_at || log.created_date);
                return (
                  <div
                    key={log.id}
                    className="rounded-md p-3 flex flex-col gap-1"
                    style={{ backgroundColor: '#0d140d', border: '1px solid rgba(197,179,88,0.15)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs" style={{ color: '#8a8470' }}>
                        {d.toLocaleString()}
                      </span>
                      <span
                        className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{
                          color: log.status === 'success' ? '#6ec07a' : log.status === 'failed' ? '#c0654a' : ACCENT,
                          backgroundColor: 'rgba(197,179,88,0.08)',
                        }}
                      >
                        {log.status}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed line-clamp-2" style={{ color: '#9a9270' }}>
                      {log.summary}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}