import { useEffect, useState } from 'react';
import { fetchDashboard } from '../api/client';
import type { DashboardData } from '../types/api';

const PIPELINE_STAGES = [
  'discovered', 'bid_sent', 'shortlisted', 'won', 'building', 'deployed', 'delivered'
] as const;

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

  if (loading) return <div className="text-center py-10 text-gray-500">Loading...</div>;
  if (error)   return <div className="text-center py-10 text-red-600">{error}</div>;
  if (!data)   return null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Discovered"  value={data.stats.total_discovered} />
        <StatCard label="Bids Sent"   value={data.stats.total_bids} />
        <StatCard label="Won"          value={data.stats.bids_won} />
        <StatCard label="Win Rate"     value={`${data.stats.win_rate.toFixed(1)}%`} />
      </div>

      {/* Pipeline */}
      <h2 className="text-lg font-semibold mb-3">Pipeline</h2>
      <div className="flex gap-2 mb-8 overflow-x-auto">
        {PIPELINE_STAGES.map(stage => (
          <div key={stage} className="flex-1 min-w-[80px] bg-white rounded-lg p-3 border text-center">
            <div className="text-2xl font-bold text-gray-900">
              {data.pipeline[stage] ?? 0}
            </div>
            <div className="text-xs text-gray-500 capitalize mt-1">
              {stage.replace(/_/g, ' ')}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Projects */}
      <h2 className="text-lg font-semibold mb-3">Recent Projects</h2>
      <div className="bg-white rounded-lg border divide-y">
        {data.recent_projects.length === 0 ? (
          <p className="px-4 py-6 text-center text-gray-400">No projects yet. The scanner will discover projects automatically.</p>
        ) : (
          data.recent_projects.map(project => (
            <div key={project.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium text-gray-900">{project.title}</div>
                <div className="text-sm text-gray-500 capitalize">{project.category?.replace(/_/g, ' ')}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Score: {project.fit_score?.total ?? '—'}</span>
                <StatusBadge status={project.status} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    discovered:  'bg-gray-100 text-gray-700',
    bid_sent:    'bg-blue-100 text-blue-800',
    shortlisted: 'bg-yellow-100 text-yellow-800',
    won:         'bg-green-100 text-green-800',
    lost:        'bg-red-100 text-red-800',
    building:    'bg-purple-100 text-purple-800',
    deployed:    'bg-indigo-100 text-indigo-800',
    delivered:   'bg-teal-100 text-teal-800',
  };
  const cls = colours[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
