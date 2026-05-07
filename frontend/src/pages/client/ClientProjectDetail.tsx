import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchClientProjects, analyzeClientBids } from '../../api/client';
import type { ClientProject } from '../../types/api';
import { PageLoader } from '../Dashboard';

export default function ClientProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ClientProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    fetchClientProjects().then(r => {
      const p = r.data.projects.find(p => p.freelancer_id === id);
      setProject(p ?? null);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleAnalyze = async () => {
    if (!id) return;
    setAnalyzing(true);
    await analyzeClientBids(id);
    setAnalyzing(false);
    setQueued(true);
  };

  if (loading) return <PageLoader />;
  if (!project) return (
    <div className="text-center py-16 text-sm text-slate-400">Project not found.</div>
  );

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-5 text-sm font-medium text-slate-400 hover:text-slate-700 flex items-center gap-1.5 transition-colors"
      >
        ← Back to Projects
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900 mb-2">{project.title}</h1>
        {project.description && (
          <p className="text-sm text-slate-500 leading-relaxed mb-4">{project.description}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="font-semibold text-slate-600">
            ${(project.budget_range.min ?? 0).toLocaleString()}–${(project.budget_range.max ?? 0).toLocaleString()} {project.budget_range.currency}
          </span>
          <span className="text-slate-300">·</span>
          <span>{project.bid_count} {project.bid_count === 1 ? 'bid' : 'bids'} received</span>
        </div>
      </div>

      {/* Action */}
      {queued ? (
        <div className="flex items-center gap-3 px-5 py-4 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Analysis queued — check back shortly.
        </div>
      ) : (
        <button
          onClick={handleAnalyze}
          disabled={analyzing || project.bid_count === 0}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {analyzing ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full" />
              Queuing…
            </span>
          ) : 'Analyze Bids'}
        </button>
      )}

      {project.bid_count === 0 && !queued && (
        <p className="mt-3 text-xs text-slate-400">No bids received yet — analysis is not available.</p>
      )}
    </div>
  );
}
