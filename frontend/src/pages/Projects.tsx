import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProjects, approveBid, rejectProject } from '../api/client';
import type { Project } from '../types/api';
import { StatusBadge, PageLoader, PageError } from './Dashboard';

const STATUSES = ['', 'discovered', 'bid_sent', 'shortlisted', 'won', 'lost'];

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const load = (status: string) => {
    setLoading(true);
    fetchProjects(status || undefined)
      .then(res => setProjects(res.data.projects))
      .catch(() => setError('Failed to load projects'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(filter); }, [filter]);

  const handleApprove = async (projectId: string) => {
    setPendingAction(projectId);
    setActionError(null);
    try {
      await approveBid(projectId);
      load(filter);
    } catch {
      setActionError('Failed to approve bid. Please try again.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleReject = async (projectId: string) => {
    setPendingAction(projectId);
    setActionError(null);
    try {
      await rejectProject(projectId);
      load(filter);
    } catch {
      setActionError('Failed to reject project. Please try again.');
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-7">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">Opportunities discovered and in your pipeline.</p>
        </div>
        <select
          aria-label="Filter by status"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>
              {s ? s.replace(/_/g, ' ') : 'All statuses'}
            </option>
          ))}
        </select>
      </div>

      {actionError && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {actionError}
        </div>
      )}

      {loading && <PageLoader />}
      {error   && <PageError message={error} />}

      {!loading && !error && (
        <div className="space-y-3">
          {projects.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
              No projects found.
            </div>
          ) : (
            projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onApprove={handleApprove}
                onReject={handleReject}
                pendingAction={pendingAction}
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
  onReject,
  pendingAction
}: {
  project: Project;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
  pendingAction: string | null;
}) {
  const isPending = pendingAction === project.id;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-150">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <Link
            to={`/projects/${project.id}`}
            className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors text-sm leading-snug"
          >
            {project.title}
          </Link>
          {project.description && (
            <p className="text-sm text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{project.description}</p>
          )}
          {project.skills_required && project.skills_required.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {project.skills_required.slice(0, 6).map(skill => (
                <span key={skill} className="px-2 py-0.5 bg-slate-100 rounded-full text-xs text-slate-600 font-medium">
                  {skill}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-4 mt-2.5 text-xs text-slate-400">
            {project.budget_range && (
              <span className="font-medium text-slate-600">
                {formatBudget(project.budget_range.min, project.budget_range.max, project.budget_range.currency)}
              </span>
            )}
            {project.category && (
              <span className="capitalize">{project.category.replace(/_/g, ' ')}</span>
            )}
            {project.fit_score && (
              <span>
                Score:{' '}
                <strong className={`font-semibold ${scoreCls(project.fit_score.total)}`}>
                  {project.fit_score.total}
                </strong>
                /100
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2.5 shrink-0">
          <StatusBadge status={project.status} />
          {project.status === 'discovered' && (
            <div className="flex gap-2">
              <button
                onClick={() => onApprove(project.id)}
                disabled={isPending}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? '…' : 'Approve'}
              </button>
              <button
                onClick={() => onReject(project.id)}
                disabled={isPending}
                className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 text-xs font-semibold rounded-lg border border-slate-200 hover:border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

function formatBudget(min: number | undefined, max: number | undefined, currency: string | undefined): string {
  const cur = currency ?? 'USD';
  const symbol = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : null;
  const prefix = symbol ?? '';
  const suffix = symbol ? ` ${cur}` : ` ${cur}`;
  return `${prefix}${(min ?? 0).toLocaleString()}–${prefix}${(max ?? 0).toLocaleString()}${suffix}`;
}

function scoreCls(score: number): string {
  if (score >= 75) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-500';
}
