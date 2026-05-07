import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchClientProjects, analyzeClientBids } from '../../api/client';
import type { ClientProject } from '../../types/api';
import { PageLoader } from '../Dashboard';

export default function ClientProjects() {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [queued, setQueued] = useState<string | null>(null);

  useEffect(() => {
    fetchClientProjects().then(r => setProjects(r.data.projects)).finally(() => setLoading(false));
  }, []);

  const handleAnalyze = async (id: string) => {
    setAnalyzing(id);
    try {
      await analyzeClientBids(id);
      setQueued(id);
    } finally {
      setAnalyzing(null);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Projects</h1>
        <p className="text-sm text-slate-500 mt-1">Review bids and analyze vendor fit for your active projects.</p>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 text-sm text-slate-400 bg-white rounded-xl border border-slate-200">
          No active projects found.
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(p => (
            <div key={p.freelancer_id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-150 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Link
                  to={`/client/projects/${p.freelancer_id}`}
                  className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors text-sm"
                >
                  {p.title}
                </Link>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                  <span className="font-medium text-slate-600">
                    ${(p.budget_range.min ?? 0).toLocaleString()}–${(p.budget_range.max ?? 0).toLocaleString()} {p.budget_range.currency}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span>{p.bid_count} {p.bid_count === 1 ? 'bid' : 'bids'}</span>
                </div>
              </div>

              <div className="shrink-0">
                {queued === p.freelancer_id ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Analysis queued
                  </span>
                ) : (
                  <button
                    onClick={() => handleAnalyze(p.freelancer_id)}
                    disabled={analyzing === p.freelancer_id || p.bid_count === 0}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {analyzing === p.freelancer_id ? (
                      <span className="flex items-center gap-1.5">
                        <span className="animate-spin h-3 w-3 border-2 border-white/40 border-t-white rounded-full" />
                        Queuing…
                      </span>
                    ) : 'Analyze Bids'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
