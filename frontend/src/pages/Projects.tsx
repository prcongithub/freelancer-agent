import { useEffect, useState } from 'react';
import { fetchProjects, approveBid, rejectProject } from '../api/client';
import type { Project } from '../types/api';

const STATUSES = ['', 'discovered', 'bid_sent', 'shortlisted', 'won', 'lost'];

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const load = (status: string) => {
    setLoading(true);
    fetchProjects(status || undefined)
      .then(res => setProjects(res.data.projects))
      .catch(() => setError('Failed to load projects'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(filter); }, [filter]);

  const handleApprove = async (projectId: string) => {
    await approveBid(projectId);
    load(filter);
  };

  const handleReject = async (projectId: string) => {
    await rejectProject(projectId);
    load(filter);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm bg-white"
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>
              {s ? s.replace('_', ' ') : 'All statuses'}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="text-center py-10 text-gray-500">Loading...</div>}
      {error   && <div className="text-center py-10 text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="space-y-4">
          {projects.length === 0 ? (
            <div className="text-center py-10 text-gray-400">No projects found.</div>
          ) : (
            projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onApprove,
  onReject
}: {
  project: Project;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">{project.title}</h3>
          {project.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{project.description}</p>
          )}
          {project.skills_required && project.skills_required.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {project.skills_required.slice(0, 6).map(skill => (
                <span key={skill} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700">
                  {skill}
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-4 mt-2 text-sm text-gray-500">
            {project.budget_range && (
              <span>
                ${project.budget_range.min}–${project.budget_range.max} {project.budget_range.currency}
              </span>
            )}
            {project.category && (
              <span className="capitalize">{project.category.replace('_', ' ')}</span>
            )}
            {project.fit_score && (
              <span>Score: <strong className="text-gray-700">{project.fit_score.total}</strong>/100</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${statusColor(project.status)}`}>
            {project.status.replace('_', ' ')}
          </span>
          {project.status === 'discovered' && (
            <div className="flex gap-2">
              <button
                onClick={() => onApprove(project.id)}
                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
              >
                Approve Bid
              </button>
              <button
                onClick={() => onReject(project.id)}
                className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200 transition-colors"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    discovered:  'bg-gray-100 text-gray-700',
    bid_sent:    'bg-blue-100 text-blue-800',
    shortlisted: 'bg-yellow-100 text-yellow-800',
    won:         'bg-green-100 text-green-800',
    lost:        'bg-red-100 text-red-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
}
