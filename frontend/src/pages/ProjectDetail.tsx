import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchProject, approveBid, rejectProject, analyzeProject, generatePrototype, fetchPrototype, approvePrototype, rejectPrototype } from '../api/client';
import type { Project, ProjectAnalysis, BidRecommendation, BidStats, Prototype } from '../types/api';

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [prototype, setPrototype] = useState<Prototype | null>(null);
  const [protoLoading, setProtoLoading] = useState(false);
  const [protoPollInterval, setProtoPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchProject(id)
      .then(res => {
        setProject(res.data.project);
        // Also fetch prototype status
        fetchPrototype(id).then(r => setPrototype(r.data.prototype)).catch(() => {});
      })
      .catch(() => setError('Project not found'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    return () => { if (protoPollInterval) clearInterval(protoPollInterval); };
  }, [protoPollInterval]);

  const handleApprove = async () => {
    if (!project) return;
    setPending(true);
    setActionError(null);
    try {
      await approveBid(project.id);
      const res = await fetchProject(project.id);
      setProject(res.data.project);
    } catch {
      setActionError('Failed to approve bid. Please try again.');
    } finally {
      setPending(false);
    }
  };

  const handleAnalyze = async () => {
    if (!project) return;
    setAnalyzing(true);
    setActionError(null);
    try {
      await analyzeProject(project.id);
      // Poll until analysis arrives (job is async)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const res = await fetchProject(project.id);
        if (res.data.project.analysis || attempts >= 20) {
          clearInterval(poll);
          setProject(res.data.project);
          setAnalyzing(false);
        }
      }, 2000);
    } catch {
      setActionError('Analysis failed. Please try again.');
      setAnalyzing(false);
    }
  };

  const handleGeneratePrototype = async () => {
    if (!project) return;
    setProtoLoading(true);
    try {
      const res = await generatePrototype(project.id);
      setPrototype(res.data.prototype);
      // Poll until ready/failed
      const interval = setInterval(async () => {
        const r = await fetchPrototype(project.id);
        const p = r.data.prototype;
        setPrototype(p);
        if (p.status !== 'generating') {
          clearInterval(interval);
          setProtoPollInterval(null);
          setProtoLoading(false);
        }
      }, 3000);
      setProtoPollInterval(interval);
    } catch {
      setProtoLoading(false);
      setActionError('Failed to start prototype generation.');
    }
  };

  const handleApprovePrototype = async () => {
    if (!prototype) return;
    const res = await approvePrototype(prototype.id);
    setPrototype(res.data.prototype);
  };

  const handleRejectPrototype = async () => {
    if (!prototype) return;
    const res = await rejectPrototype(prototype.id);
    setPrototype(res.data.prototype);
  };

  const handleReject = async () => {
    if (!project) return;
    setPending(true);
    setActionError(null);
    try {
      await rejectProject(project.id);
      navigate('/projects');
    } catch {
      setActionError('Failed to reject project. Please try again.');
    } finally {
      setPending(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-gray-500">Loading...</div>;
  if (error || !project) return <div className="text-center py-20 text-red-600">{error ?? 'Not found'}</div>;

  const fs = project.fit_score;

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
      >
        ← Back
      </button>

      {/* Header */}
      <div className="bg-white rounded-lg border p-6 mb-4">
        <div className="flex justify-between items-start gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 leading-snug">{project.title}</h1>
            {project.freelancer_url && (
              <a
                href={project.freelancer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:text-blue-700 hover:underline mt-0.5 inline-block"
              >
                View on Freelancer.com ↗
              </a>
            )}
          </div>
          <span className={`shrink-0 px-2.5 py-1 rounded text-xs font-semibold capitalize ${statusColor(project.status)}`}>
            {project.status.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
          {project.budget_range && (
            <span>
              💰 {formatBudget(project.budget_range.min, project.budget_range.max, project.budget_range.currency)}
            </span>
          )}
          {project.category && (
            <span className="capitalize">🏷 {project.category.replace(/_/g, ' ')}</span>
          )}
          {project.discovered_at && (
            <span>🕐 Discovered {new Date(project.discovered_at).toLocaleDateString()}</span>
          )}
          {project.bid_at && (
            <span>📤 Bid sent {new Date(project.bid_at).toLocaleDateString()}</span>
          )}
          {project.won_at && (
            <span>🏆 Won {new Date(project.won_at).toLocaleDateString()}</span>
          )}
        </div>

        {/* Skills */}
        {project.skills_required && project.skills_required.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {project.skills_required.map(skill => (
              <span key={skill} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700">
                {skill}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {project.description && (
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {project.description}
          </p>
        )}
      </div>

      {/* Competition & flags */}
      {(project.bid_stats?.bid_count != null || project.upgrades) && (
        <div className="bg-white rounded-lg border p-4 mb-4 flex flex-wrap gap-6 items-center">
          {project.bid_stats?.bid_count != null && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Competition</p>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${
                  (project.bid_stats.bid_count ?? 0) > 100 ? 'text-red-600' :
                  (project.bid_stats.bid_count ?? 0) > 40  ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {project.bid_stats.bid_count}
                </span>
                <span className="text-sm text-gray-500">bids</span>
              </div>
              {project.bid_stats.bid_avg != null && (
                <p className="text-xs text-gray-500 mt-0.5">
                  avg bid ${project.bid_stats.bid_avg.toLocaleString()}
                  {project.budget_range && (
                    <span className={`ml-1 ${
                      project.bid_stats.bid_avg > (project.budget_range.max ?? 0)
                        ? 'text-red-500' : 'text-green-600'
                    }`}>
                      ({project.bid_stats.bid_avg > (project.budget_range.max ?? 0) ? 'above' : 'within'} budget)
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
          {project.upgrades && (
            <div className="flex flex-wrap gap-2">
              {project.upgrades.urgent   && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">Urgent</span>}
              {project.upgrades.featured && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">Featured</span>}
              {project.upgrades.nda      && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">NDA required</span>}
              {project.upgrades.sealed   && <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">Sealed bids</span>}
            </div>
          )}
        </div>
      )}

      {/* Fit Score */}
      {fs && (
        <div className="bg-white rounded-lg border p-6 mb-4">
          <h2 className="font-semibold text-gray-800 mb-4">Fit Score</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className={`text-4xl font-bold ${scoreColor(fs.total)}`}>{fs.total}</div>
            <div className="text-gray-400 text-sm">/ 100</div>
            <ScoreBar value={fs.total} className="flex-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              ['Skill Match',     fs.skill_match],
              ['Budget',         fs.budget],
              ['Scope Clarity',  fs.scope_clarity],
              ['Agent Buildable',fs.agent_buildable],
              ['Client Quality', fs.client_quality],
            ] as [string, number][]).map(([label, val]) => (
              <div key={label}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{label}</span>
                  <span className="font-medium">{val}</span>
                </div>
                <ScoreBar value={val} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client */}
      {project.client && (
        <div className="bg-white rounded-lg border p-6 mb-4">
          <h2 className="font-semibold text-gray-800 mb-3">Client</h2>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span>ID: {project.client.id}</span>
            {project.client.rating != null && (
              <span>⭐ {project.client.rating.toFixed(1)} / 5.0</span>
            )}
            {project.client.payment_verified && (
              <span className="text-green-700">✓ Payment verified</span>
            )}
            {!project.client.payment_verified && (
              <span className="text-gray-400">✗ Payment not verified</span>
            )}
          </div>
        </div>
      )}

      {/* Bid recommendation */}
      {project.bid_recommendation && (
        <BidPanel
          rec={project.bid_recommendation}
          bidStats={project.bid_stats}
          aiAdvantage={project.analysis?.ai_advantage}
        />
      )}

      {/* Analysis */}
      {project.analysis
        ? <AnalysisPanel analysis={project.analysis} analyzedAt={project.analyzed_at} />
        : (
          <div className="bg-white rounded-lg border border-dashed p-6 mb-4 text-center">
            {analyzing ? (
              <p className="text-sm text-gray-500">Analyzing project… this takes ~10 seconds</p>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-3">No analysis yet</p>
                <button
                  onClick={handleAnalyze}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
                >
                  Run AI Analysis
                </button>
              </>
            )}
          </div>
        )
      }

      {/* Prototype */}
      <PrototypePanel
        prototype={prototype}
        loading={protoLoading}
        onGenerate={handleGeneratePrototype}
        onApprove={handleApprovePrototype}
        onReject={handleRejectPrototype}
      />

      {/* Actions */}
      {actionError && (
        <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {actionError}
        </div>
      )}
      <div className="flex gap-3 flex-wrap">
        {project.analysis && (
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="px-5 py-2 bg-purple-100 text-purple-700 text-sm rounded hover:bg-purple-200 transition-colors disabled:opacity-50"
          >
            {analyzing ? 'Re-analyzing…' : 'Re-analyze'}
          </button>
        )}
        {project.status === 'discovered' && (
          <>
            <button
              onClick={handleApprove}
              disabled={pending}
              className="px-5 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Approve Bid
            </button>
            <button
              onClick={handleReject}
              disabled={pending}
              className="px-5 py-2 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
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

function BidPanel({ rec, bidStats, aiAdvantage }: { rec: BidRecommendation; bidStats?: BidStats; aiAdvantage?: string }) {
  const avgBid = bidStats?.bid_avg;
  const aiHours = rec.estimated_hours;
  const aiDays  = Math.ceil(aiHours / 6);

  return (
    <div className="bg-white rounded-lg border p-6 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-semibold text-gray-800">What to Bid</h2>
        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">Claude Code estimate</span>
      </div>

      {/* AI advantage callout */}
      {(aiAdvantage || rec.ai_speedup) && (
        <div className="mb-4 px-3 py-2 bg-purple-50 border border-purple-100 rounded-lg text-sm text-purple-800">
          {rec.ai_speedup && rec.traditional_days && (
            <span className="font-semibold">{rec.ai_speedup}× faster with AI — {rec.traditional_days}d traditional → {aiDays}d with Claude Code. </span>
          )}
          {aiAdvantage && <span>{aiAdvantage}</span>}
        </div>
      )}

      <div className="flex flex-wrap gap-8 items-start mb-4">
        {/* Recommended amount */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Recommended bid</p>
          {rec.currency !== 'USD' ? (
            <>
              <p className="text-4xl font-bold text-gray-900">
                {rec.currency} {rec.amount.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">(≈ ${rec.amount_usd.toLocaleString()} USD)</p>
            </>
          ) : (
            <p className="text-4xl font-bold text-gray-900">${rec.amount_usd.toLocaleString()}</p>
          )}
          {!rec.within_budget && (
            <p className="text-xs text-orange-600 mt-1">
              Our rate (${rec.full_amount_usd.toLocaleString()}) exceeds budget — capped at max
            </p>
          )}
        </div>

        {/* Breakdown */}
        <div className="text-sm text-gray-600 space-y-1.5">
          <p>
            <span className="text-gray-400">Rate:</span>{' '}
            <strong>${rec.hourly_rate}/hr</strong>
            <span className="text-gray-400 ml-1">(range ${rec.rate_range.min}–${rec.rate_range.max}/hr)</span>
          </p>
          <p>
            <span className="text-gray-400">AI-assisted effort:</span>{' '}
            <strong>{aiHours}h</strong> / <strong>{aiDays}d</strong>
            {rec.traditional_days && (
              <span className="text-gray-400 ml-1">(vs ~{rec.traditional_days}d traditional)</span>
            )}
          </p>
          {rec.discount_applied > 0 && (
            <p className="text-green-600 text-xs">
              ✓ {(rec.discount_applied * 100).toFixed(0)}% agent-buildable discount applied
            </p>
          )}
          {avgBid != null && (
            <p>
              <span className="text-gray-400">Avg competitor bid:</span>{' '}
              <strong className={rec.amount_usd < avgBid ? 'text-green-600' : 'text-orange-600'}>
                ${avgBid.toLocaleString()}
              </strong>
              <span className="text-gray-400 ml-1">
                — we're {rec.amount_usd < avgBid ? 'below' : 'above'} market avg
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Visual bars */}
      <div className="space-y-2 text-xs text-gray-500">
        {(() => {
          const max = Math.max(rec.full_amount_usd, avgBid ?? 0) * 1.15;
          return (
            <>
              <BidBar label="Our bid" value={rec.amount_usd} max={max} color="bg-blue-500" />
              {avgBid != null && <BidBar label="Avg bid" value={avgBid} max={max} color="bg-gray-300" />}
            </>
          );
        })()}
      </div>
    </div>
  );
}

function BidBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
      </div>
      <span className="w-20 shrink-0">${value.toLocaleString()}</span>
    </div>
  );
}

function AnalysisPanel({ analysis, analyzedAt }: { analysis: ProjectAnalysis; analyzedAt?: string }) {
  const recColor = {
    take:  'bg-green-100 text-green-800 border-green-200',
    maybe: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    skip:  'bg-red-100 text-red-800 border-red-200',
  }[analysis.recommendation] ?? 'bg-gray-100 text-gray-700';

  return (
    <div className="bg-white rounded-lg border p-6 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-gray-800">AI Analysis</h2>
        {analyzedAt && (
          <span className="text-xs text-gray-400">{new Date(analyzedAt).toLocaleString()}</span>
        )}
      </div>

      {/* Recommendation banner */}
      <div className={`flex items-center gap-4 border rounded-lg px-4 py-3 mb-4 ${recColor}`}>
        <span className="text-2xl font-bold capitalize">{analysis.recommendation}</span>
        <div className="flex-1">
          <p className="text-sm font-medium">{analysis.reasoning}</p>
          <p className="text-xs mt-0.5 opacity-75">Confidence: {analysis.confidence}%</p>
        </div>
      </div>

      {/* Scope & effort */}
      <div className="mb-4">
        <p className="text-sm text-gray-700 leading-relaxed mb-3">{analysis.scope}</p>
        <div className="flex gap-6 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{analysis.effort_days}</div>
            <div className="text-xs text-gray-500">working days</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{analysis.calendar_weeks}</div>
            <div className="text-xs text-gray-500">calendar weeks</div>
          </div>
        </div>
      </div>

      {/* Skill gaps */}
      {analysis.skill_gaps.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Skill gaps</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.skill_gaps.map(gap => (
              <span key={gap} className="px-2 py-0.5 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">{gap}</span>
            ))}
          </div>
        </div>
      )}

      {/* Unknowns */}
      {analysis.unknowns.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Unknowns / needs clarification</p>
          <ul className="space-y-1">
            {analysis.unknowns.map(u => (
              <li key={u} className="text-sm text-gray-600 flex gap-2"><span className="text-gray-400 shrink-0">?</span>{u}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Red flags */}
      {analysis.red_flags.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Red flags</p>
          <ul className="space-y-1">
            {analysis.red_flags.map(f => (
              <li key={f} className="text-sm text-red-600 flex gap-2"><span className="shrink-0">⚠</span>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PrototypePanel({
  prototype, loading, onGenerate, onApprove, onReject
}: {
  prototype: Prototype | null;
  loading: boolean;
  onGenerate: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border p-6 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-800">Prototype</h2>
        {(!prototype || prototype.status === 'rejected' || prototype.status === 'failed') && (
          <button
            onClick={onGenerate}
            disabled={loading}
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Generating…' : prototype ? 'Regenerate' : 'Generate Prototype'}
          </button>
        )}
      </div>

      {!prototype && !loading && (
        <p className="text-sm text-gray-400">No prototype yet. Generate one to include a live demo in your bid.</p>
      )}

      {(loading || prototype?.status === 'generating') && (
        <div className="flex items-center gap-3 py-4">
          <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
          <p className="text-sm text-gray-500">Building prototype… ~30 seconds</p>
        </div>
      )}

      {prototype?.status === 'failed' && (
        <p className="text-sm text-red-500">Generation failed. Try again.</p>
      )}

      {prototype?.status === 'ready' && prototype.public_url && (
        <div>
          <div className="rounded border overflow-hidden mb-3" style={{ height: 320 }}>
            <iframe
              src={prototype.public_url}
              className="w-full h-full"
              title="Prototype preview"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </div>
          <div className="flex items-center gap-3">
            <a
              href={prototype.public_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-600 hover:underline"
            >
              View live ↗
            </a>
            <button
              onClick={onApprove}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
            >
              Approve — include in bid
            </button>
            <button
              onClick={onReject}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {prototype?.status === 'approved' && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">Approved</span>
            <span className="text-xs text-gray-400">Will be included in bid proposal</span>
          </div>
          {prototype.public_url && (
            <a
              href={prototype.public_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-600 hover:underline"
            >
              {prototype.public_url}
            </a>
          )}
        </div>
      )}

      {prototype?.status === 'rejected' && (
        <p className="text-sm text-gray-400">Prototype rejected. Generate a new one.</p>
      )}
    </div>
  );
}

function ScoreBar({ value, className = '' }: { value: number; className?: string }) {
  const color = value >= 75 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className={`h-1.5 bg-gray-100 rounded-full overflow-hidden ${className}`}>
      <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-green-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-red-500';
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
