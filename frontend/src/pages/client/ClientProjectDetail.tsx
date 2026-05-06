import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchClientProjects, analyzeClientBids } from '../../api/client';
import type { ClientProject } from '../../types/api';

export default function ClientProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ClientProject | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    fetchClientProjects().then(r => {
      const p = r.data.projects.find(p => p.freelancer_id === id);
      setProject(p ?? null);
    });
  }, [id]);

  const handleAnalyze = async () => {
    if (!id) return;
    setAnalyzing(true);
    await analyzeClientBids(id);
    setAnalyzing(false);
    setQueued(true);
  };

  if (!project) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{project.title}</h1>
      <p className="text-gray-600 mb-4">{project.description}</p>
      <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
        <span>{project.bid_count} bids received</span>
        <span>Budget: ${project.budget_range.min}–${project.budget_range.max} {project.budget_range.currency}</span>
      </div>
      {queued
        ? <div className="p-4 bg-green-50 text-green-700 rounded-lg">Analysis queued — check back shortly.</div>
        : <button onClick={handleAnalyze} disabled={analyzing || project.bid_count === 0}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {analyzing ? 'Queuing...' : 'Analyze Bids'}
          </button>
      }
    </div>
  );
}
