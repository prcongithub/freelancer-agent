import { useEffect, useState } from 'react';
import { fetchAdminStats } from '../../api/client';
import type { AdminStats } from '../../types/api';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border rounded-lg p-5">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function AdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    fetchAdminStats().then(r => setStats(r.data.stats));
  }, []);

  if (!stats) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Platform Stats</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Users" value={stats.users.total} />
        <StatCard label="Freelancers" value={stats.users.freelancers} />
        <StatCard label="Clients" value={stats.users.clients} />
        <StatCard label="Bid Analyses Run" value={stats.analyses.total} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Projects by Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(stats.projects.by_status).map(([status, count]) => (
            <StatCard key={status} label={status.replace('_', ' ')} value={count} />
          ))}
        </div>
      </div>
    </div>
  );
}
