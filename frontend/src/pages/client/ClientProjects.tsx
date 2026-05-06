import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchClientProjects, analyzeClientBids } from '../../api/client';
import type { ClientProject } from '../../types/api';

export default function ClientProjects() {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  useEffect(() => {
    fetchClientProjects().then(r => setProjects(r.data.projects)).finally(() => setLoading(false));
  }, []);

  const handleAnalyze = async (id: string) => {
    setAnalyzing(id);
    try {
      await analyzeClientBids(id);
      alert('Analysis queued — refresh in a moment to see results.');
    } finally {
      setAnalyzing(null);
    }
  };

  if (loading) return <div className="text-gray-500">Loading projects...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Projects</h1>
      {projects.length === 0 && <p className="text-gray-500">No active projects found.</p>}
      <div className="space-y-4">
        {projects.map(p => (
          <div key={p.freelancer_id} className="bg-white border rounded-lg p-5 flex items-center justify-between">
            <div>
              <Link to={`/client/projects/${p.freelancer_id}`} className="font-semibold text-gray-900 hover:text-blue-600">{p.title}</Link>
              <div className="text-sm text-gray-500 mt-1">{p.bid_count} bids · ${p.budget_range.min}–${p.budget_range.max} {p.budget_range.currency}</div>
            </div>
            <button onClick={() => handleAnalyze(p.freelancer_id)} disabled={analyzing === p.freelancer_id || p.bid_count === 0}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {analyzing === p.freelancer_id ? 'Queuing...' : 'Analyze Bids'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
