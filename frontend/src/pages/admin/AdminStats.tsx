import { useEffect, useState } from 'react';
import { fetchAdminStats } from '../../api/client';
import type { AdminStats } from '../../types/api';

const STATUS_COLORS: Record<string, string> = {
  discovered:  'bg-slate-100 text-slate-600 border-slate-200',
  bid_sent:    'bg-indigo-50 text-indigo-700 border-indigo-100',
  shortlisted: 'bg-amber-50 text-amber-700 border-amber-100',
  won:         'bg-emerald-50 text-emerald-700 border-emerald-100',
  lost:        'bg-red-50 text-red-600 border-red-100',
};

export default function AdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    fetchAdminStats().then(r => setStats(r.data.stats));
  }, []);

  if (!stats) return (
    <div className="flex items-center gap-3 py-8 text-slate-400">
      <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
      <span className="text-sm">Loading…</span>
    </div>
  );

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Stats</h1>
        <p className="text-sm text-slate-500 mt-1">System-wide metrics and activity overview.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Users"       value={stats.users.total} />
        <StatCard label="Freelancers"       value={stats.users.freelancers} accent="text-indigo-600" />
        <StatCard label="Clients"           value={stats.users.clients} accent="text-sky-600" />
        <StatCard label="Analyses Run"      value={stats.analyses.total} accent="text-violet-600" />
      </div>

      <h2 className="text-base font-semibold text-slate-800 mb-4">Projects by Status</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {Object.entries(stats.projects.by_status).map(([status, count]) => {
          const colorCls = STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-600 border-slate-200';
          return (
            <div key={status} className={`rounded-xl border px-4 py-4 text-center ${colorCls}`}>
              <div className="text-3xl font-bold leading-none">{count}</div>
              <div className="text-xs font-medium mt-2 capitalize">{status.replace('_', ' ')}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent = 'text-slate-900' }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">{label}</div>
      <div className={`text-3xl font-bold tracking-tight ${accent}`}>{value}</div>
    </div>
  );
}
