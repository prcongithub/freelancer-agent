import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchDashboard } from '../api/client';
import type { DashboardData } from '../types/api';

const PIPELINE_STAGES = [
  'discovered', 'bid_sent', 'shortlisted', 'won', 'building', 'deployed', 'delivered'
] as const;

const STAGE_COLORS: Record<string, string> = {
  discovered:  'bg-slate-100 text-slate-600 border-slate-200',
  bid_sent:    'bg-indigo-50 text-indigo-700 border-indigo-100',
  shortlisted: 'bg-amber-50 text-amber-700 border-amber-100',
  won:         'bg-emerald-50 text-emerald-700 border-emerald-100',
  building:    'bg-violet-50 text-violet-700 border-violet-100',
  deployed:    'bg-sky-50 text-sky-700 border-sky-100',
  delivered:   'bg-teal-50 text-teal-700 border-teal-100',
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then(res => setData(res.data))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;
  if (error)   return <PageError message={error} />;
  if (!data)   return null;

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Your revenue pipeline at a glance.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Discovered"  value={data.stats.total_discovered} />
        <StatCard label="Bids Sent"   value={data.stats.total_bids} />
        <StatCard label="Won"          value={data.stats.bids_won} color="text-emerald-600" />
        <StatCard label="Win Rate"     value={`${data.stats.win_rate.toFixed(1)}%`} color="text-indigo-600" />
      </div>

      {/* Pipeline */}
      <h2 className="text-base font-semibold text-slate-800 mb-3">Pipeline</h2>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-8">
        {PIPELINE_STAGES.map(stage => {
          const colorCls = STAGE_COLORS[stage] ?? 'bg-slate-50 text-slate-600 border-slate-200';
          return (
            <div key={stage} className={`rounded-xl border px-3 py-3 text-center ${colorCls}`}>
              <div className="text-2xl font-bold leading-none">
                {data.pipeline[stage] ?? 0}
              </div>
              <div className="text-[10px] font-medium mt-1.5 capitalize leading-tight">
                {stage.replace(/_/g, ' ')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Projects */}
      <h2 className="text-base font-semibold text-slate-800 mb-3">Recent Projects</h2>
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-sm">
        {data.recent_projects.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            No projects yet. The scanner will discover projects automatically.
          </p>
        ) : (
          data.recent_projects.map(project => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors group"
            >
              <div className="min-w-0">
                <div className="font-medium text-sm text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                  {project.title}
                </div>
                <div className="text-xs text-slate-400 capitalize mt-0.5">
                  {project.category?.replace(/_/g, ' ')}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                {project.fit_score?.total != null && (
                  <span className="text-xs font-semibold text-slate-500">
                    Score: <span className={scoreColor(project.fit_score.total)}>{project.fit_score.total}</span>
                  </span>
                )}
                <StatusBadge status={project.status} />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-slate-900' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">{label}</div>
      <div className={`text-3xl font-bold tracking-tight ${color}`}>{value}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    discovered:  'bg-slate-100 text-slate-600',
    bid_sent:    'bg-indigo-50 text-indigo-700',
    shortlisted: 'bg-amber-50 text-amber-700',
    won:         'bg-emerald-50 text-emerald-700',
    lost:        'bg-red-50 text-red-600',
    building:    'bg-violet-50 text-violet-700',
    deployed:    'bg-sky-50 text-sky-700',
    delivered:   'bg-teal-50 text-teal-700',
  };
  const cls = colours[status] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-500';
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-3 text-slate-400">
        <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
        <span className="text-sm font-medium">Loading…</span>
      </div>
    </div>
  );
}

export function PageError({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="text-sm font-medium text-red-500">{message}</div>
      </div>
    </div>
  );
}
