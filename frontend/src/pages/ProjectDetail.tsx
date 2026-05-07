import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchProject, approveBid, rejectProject, analyzeProject, generatePrototype, fetchPrototype, approvePrototype, rejectPrototype } from '../api/client';
import type { Project, ProjectAnalysis, BidRecommendation, BidStats, Prototype } from '../types/api';
import { StatusBadge, PageLoader, PageError, scoreColor } from './Dashboard';

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
  const protoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchProject(id)
      .then(res => {
        setProject(res.data.project);
        fetchPrototype(id).then(r => setPrototype(r.data.prototype)).catch(() => {});
      })
      .catch(() => setError('Project not found'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    return () => { if (protoPollRef.current) clearInterval(protoPollRef.current); };
  }, []);

  const handleApprove = async () => {
    if (!project) return;
    setPending(true); setActionError(null);
    try {
      await approveBid(project.id);
      const res = await fetchProject(project.id);
      setProject(res.data.project);
    } catch { setActionError('Failed to approve bid. Please try again.'); }
    finally   { setPending(false); }
  };

  const handleAnalyze = async () => {
    if (!project) return;
    setAnalyzing(true); setActionError(null);
    try {
      await analyzeProject(project.id);
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
    } catch { setActionError('Analysis failed. Please try again.'); setAnalyzing(false); }
  };

  const handleGeneratePrototype = async () => {
    if (!project) return;
    setProtoLoading(true);
    try {
      const res = await generatePrototype(project.id);
      setPrototype(res.data.prototype);
      const interval = setInterval(async () => {
        const r = await fetchPrototype(project.id);
        const p = r.data.prototype;
        setPrototype(p);
        if (p.status !== 'generating') {
          clearInterval(interval);
          protoPollRef.current = null;
          setProtoLoading(false);
        }
      }, 3000);
      protoPollRef.current = interval;
    } catch { setProtoLoading(false); setActionError('Failed to start prototype generation.'); }
  };

  const handleApprovePrototype = async () => {
    if (!prototype) return;
    try { const res = await approvePrototype(prototype.id); setPrototype(res.data.prototype); }
    catch { setActionError('Failed to approve prototype.'); }
  };

  const handleRejectPrototype = async () => {
    if (!prototype) return;
    try { const res = await rejectPrototype(prototype.id); setPrototype(res.data.prototype); }
    catch { setActionError('Failed to reject prototype.'); }
  };

  const handleReject = async () => {
    if (!project) return;
    setPending(true); setActionError(null);
    try { await rejectProject(project.id); navigate('/projects'); }
    catch { setActionError('Failed to reject project. Please try again.'); }
    finally { setPending(false); }
  };

  if (loading) return <PageLoader />;
  if (error || !project) return <PageError message={error ?? 'Not found'} />;

  const fs = project.fit_score;

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="mb-5 text-sm font-medium text-slate-400 hover:text-slate-700 flex items-center gap-1.5 transition-colors"
      >
        ← Back to Projects
      </button>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4 shadow-sm">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-900 leading-snug">{project.title}</h1>
            {project.freelancer_url && (
              <a
                href={project.freelancer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline mt-1 inline-block"
              >
                View on Freelancer.com ↗
              </a>
            )}
          </div>
          <StatusBadge status={project.status} />
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500 mb-4">
          {project.budget_range && (
            <span className="font-semibold text-slate-700">
              {formatBudget(project.budget_range.min, project.budget_range.max, project.budget_range.currency)}
            </span>
          )}
          {project.category && (
            <span className="capitalize">{project.category.replace(/_/g, ' ')}</span>
          )}
          {project.discovered_at && (
            <span>Discovered {new Date(project.discovered_at).toLocaleDateString()}</span>
          )}
          {project.bid_at && (
            <span>Bid sent {new Date(project.bid_at).toLocaleDateString()}</span>
          )}
          {project.won_at && (
            <span className="text-emerald-600 font-medium">Won {new Date(project.won_at).toLocaleDateString()}</span>
          )}
        </div>

        {/* Skills */}
        {project.skills_required && project.skills_required.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {project.skills_required.map(skill => (
              <span key={skill} className="px-2.5 py-0.5 bg-slate-100 rounded-full text-xs font-medium text-slate-600">
                {skill}
              </span>
            ))}
          </div>
        )}

        {project.description && (
          <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
            {project.description}
          </p>
        )}
      </div>

      {/* Competition & upgrades */}
      {(project.bid_stats?.bid_count != null || project.upgrades) && (
        <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 mb-4 shadow-sm flex flex-wrap gap-6 items-center">
          {project.bid_stats?.bid_count != null && (
            <div>
              <p className="text-xs text-slate-400 font-medium mb-1">Competition</p>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl font-bold ${
                  (project.bid_stats.bid_count ?? 0) > 100 ? 'text-red-500' :
                  (project.bid_stats.bid_count ?? 0) > 40  ? 'text-amber-500' : 'text-emerald-600'
                }`}>
                  {project.bid_stats.bid_count}
                </span>
                <span className="text-sm text-slate-400">bids</span>
              </div>
              {project.bid_stats.bid_avg != null && (
                <p className="text-xs text-slate-400 mt-0.5">
                  avg bid ${project.bid_stats.bid_avg.toLocaleString()}
                  {project.budget_range && (
                    <span className={`ml-1 font-medium ${
                      project.bid_stats.bid_avg > (project.budget_range.max ?? 0)
                        ? 'text-red-500' : 'text-emerald-600'
                    }`}>
                      ({project.bid_stats.bid_avg > (project.budget_range.max ?? 0) ? 'above' : 'within'} budget)
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
          {project.upgrades && (
            <div className="flex flex-wrap gap-1.5">
              {project.upgrades.urgent   && <span className="px-2.5 py-0.5 bg-red-50 text-red-600 border border-red-100 text-xs font-semibold rounded-full">Urgent</span>}
              {project.upgrades.featured && <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 text-xs font-semibold rounded-full">Featured</span>}
              {project.upgrades.nda      && <span className="px-2.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 text-xs font-semibold rounded-full">NDA required</span>}
              {project.upgrades.sealed   && <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold rounded-full">Sealed bids</span>}
            </div>
          )}
        </div>
      )}

      {/* Fit Score */}
      {fs && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Fit Score</h2>
          <div className="flex items-center gap-4 mb-5">
            <div className={`text-4xl font-bold tracking-tight ${scoreColor(fs.total)}`}>{fs.total}</div>
            <div className="text-slate-300 text-xl font-light">/</div>
            <div className="text-slate-400 text-sm">100</div>
            <ScoreBar value={fs.total} className="flex-1" />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {([
              ['Skill Match',      fs.skill_match],
              ['Budget',           fs.budget],
              ['Scope Clarity',    fs.scope_clarity],
              ['Agent Buildable',  fs.agent_buildable],
              ['Client Quality',   fs.client_quality],
            ] as [string, number][]).map(([label, val]) => (
              <div key={label}>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{label}</span>
                  <span className={`font-semibold ${scoreColor(val)}`}>{val}</span>
                </div>
                <ScoreBar value={val} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client */}
      {project.client && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Client</h2>
          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <span>ID: {project.client.id}</span>
            {project.client.rating != null && (
              <span className="text-amber-600 font-medium">★ {project.client.rating.toFixed(1)} / 5.0</span>
            )}
            {project.client.payment_verified ? (
              <span className="text-emerald-600 font-medium">✓ Payment verified</span>
            ) : (
              <span className="text-slate-400">✗ Payment not verified</span>
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
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 mb-4 text-center">
            {analyzing ? (
              <div className="flex items-center justify-center gap-3 text-slate-400">
                <div className="animate-spin h-4 w-4 border-2 border-violet-500 border-t-transparent rounded-full" />
                <span className="text-sm">Analyzing project… ~10 seconds</span>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-400 mb-4">No analysis yet</p>
                <button
                  onClick={handleAnalyze}
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                >
                  Run Signal Analysis
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

      {/* Action error */}
      {actionError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {actionError}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 flex-wrap pb-8">
        {project.analysis && (
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="px-5 py-2.5 bg-violet-50 hover:bg-violet-100 text-violet-700 text-sm font-semibold rounded-xl border border-violet-100 transition-colors disabled:opacity-50"
          >
            {analyzing ? 'Re-analyzing…' : 'Re-analyze'}
          </button>
        )}
        {project.status === 'discovered' && (
          <>
            <button
              onClick={handleApprove}
              disabled={pending}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              Approve Bid
            </button>
            <button
              onClick={handleReject}
              disabled={pending}
              className="px-5 py-2.5 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 text-sm font-semibold rounded-xl border border-slate-200 hover:border-red-200 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBudget(min: number | undefined, max: number | undefined, currency: string | undefined): string {
  const cur = currency ?? 'USD';
  const symbol = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : null;
  const prefix = symbol ?? '';
  const suffix = symbol ? ` ${cur}` : ` ${cur}`;
  return `${prefix}${(min ?? 0).toLocaleString()}–${prefix}${(max ?? 0).toLocaleString()}${suffix}`;
}

function ScoreBar({ value, className = '' }: { value: number; className?: string }) {
  const color = value >= 75 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className={`h-1.5 bg-slate-100 rounded-full overflow-hidden ${className}`}>
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${value}%` }} />
    </div>
  );
}

// ─── Sub-panels ─────────────────────────────────────────────────────────────

function BidPanel({ rec, bidStats, aiAdvantage }: { rec: BidRecommendation; bidStats?: BidStats; aiAdvantage?: string }) {
  const avgBid = bidStats?.bid_avg;
  const aiHours = rec.estimated_hours;
  const aiDays  = Math.ceil(aiHours / 6);
  const maxBar  = Math.max(rec.full_amount_usd, avgBid ?? 0) * 1.15;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">What to Bid</h2>
        <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 bg-violet-50 text-violet-600 border border-violet-100 rounded-full">
          Claude Code estimate
        </span>
      </div>

      {(aiAdvantage || rec.ai_speedup) && (
        <div className="mb-5 px-4 py-3 bg-violet-50 border border-violet-100 rounded-xl text-sm text-violet-800">
          {rec.ai_speedup && rec.traditional_days && (
            <span className="font-semibold">{rec.ai_speedup}× faster with AI — {rec.traditional_days}d traditional → {aiDays}d with Claude Code. </span>
          )}
          {aiAdvantage && <span className="text-violet-700">{aiAdvantage}</span>}
        </div>
      )}

      <div className="flex flex-wrap gap-8 items-start mb-5">
        <div>
          <p className="text-xs text-slate-400 font-medium mb-1.5">Recommended bid</p>
          {rec.currency !== 'USD' ? (
            <>
              <p className="text-4xl font-bold text-slate-900 tracking-tight">
                {rec.currency} {rec.amount.toLocaleString()}
              </p>
              <p className="text-sm text-slate-400 mt-0.5">≈ ${rec.amount_usd.toLocaleString()} USD</p>
            </>
          ) : (
            <p className="text-4xl font-bold text-slate-900 tracking-tight">${rec.amount_usd.toLocaleString()}</p>
          )}
          {!rec.within_budget && (
            <p className="text-xs text-amber-600 mt-1.5 font-medium">
              Our rate (${rec.full_amount_usd.toLocaleString()}) exceeds budget — capped at max
            </p>
          )}
        </div>

        <div className="text-sm text-slate-500 space-y-1.5">
          <p>
            <span className="text-slate-400">Rate:</span>{' '}
            <strong className="text-slate-700 font-semibold">${rec.hourly_rate}/hr</strong>
            <span className="text-slate-400 ml-1 text-xs">(range ${rec.rate_range.min}–${rec.rate_range.max}/hr)</span>
          </p>
          <p>
            <span className="text-slate-400">AI-assisted effort:</span>{' '}
            <strong className="text-slate-700 font-semibold">{aiHours}h / {aiDays}d</strong>
            {rec.traditional_days && (
              <span className="text-slate-400 ml-1 text-xs">(vs ~{rec.traditional_days}d traditional)</span>
            )}
          </p>
          {rec.discount_applied > 0 && (
            <p className="text-emerald-600 text-xs font-medium">
              ✓ {(rec.discount_applied * 100).toFixed(0)}% agent-buildable discount applied
            </p>
          )}
          {avgBid != null && (
            <p>
              <span className="text-slate-400">Avg competitor bid:</span>{' '}
              <strong className={rec.amount_usd < avgBid ? 'text-emerald-600' : 'text-amber-600'}>
                ${avgBid.toLocaleString()}
              </strong>
              <span className="text-slate-400 ml-1 text-xs">
                — we&apos;re {rec.amount_usd < avgBid ? 'below' : 'above'} market avg
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <BidBar label="Our bid" value={rec.amount_usd} max={maxBar} color="bg-indigo-500" />
        {avgBid != null && <BidBar label="Avg bid" value={avgBid} max={maxBar} color="bg-slate-300" />}
      </div>
    </div>
  );
}

function BidBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-500">
      <span className="w-14 shrink-0 text-right font-medium">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min((value / max) * 100, 100)}%` }} />
      </div>
      <span className="w-20 shrink-0 font-medium text-slate-700">${value.toLocaleString()}</span>
    </div>
  );
}

function AnalysisPanel({ analysis, analyzedAt }: { analysis: ProjectAnalysis; analyzedAt?: string }) {
  const recStyles = {
    take:  'bg-emerald-50 border-emerald-200 text-emerald-800',
    maybe: 'bg-amber-50 border-amber-200 text-amber-800',
    skip:  'bg-red-50 border-red-200 text-red-700',
  }[analysis.recommendation] ?? 'bg-slate-50 border-slate-200 text-slate-700';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Signal Analysis</h2>
        {analyzedAt && (
          <span className="text-xs text-slate-400">{new Date(analyzedAt).toLocaleString()}</span>
        )}
      </div>

      <div className={`flex items-start gap-4 border rounded-xl px-4 py-3.5 mb-5 ${recStyles}`}>
        <span className="text-xl font-bold capitalize shrink-0 mt-0.5">{analysis.recommendation}</span>
        <div>
          <p className="text-sm font-medium leading-snug">{analysis.reasoning}</p>
          <p className="text-xs mt-1 opacity-70">Confidence: {analysis.confidence}%</p>
        </div>
      </div>

      <p className="text-sm text-slate-600 leading-relaxed mb-4">{analysis.scope}</p>

      <div className="flex gap-6 mb-5">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">{analysis.effort_days}</div>
          <div className="text-xs text-slate-400 mt-0.5">working days</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">{analysis.calendar_weeks}</div>
          <div className="text-xs text-slate-400 mt-0.5">calendar weeks</div>
        </div>
      </div>

      {analysis.skill_gaps.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Skill gaps</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.skill_gaps.map(gap => (
              <span key={gap} className="px-2.5 py-0.5 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700 font-medium">{gap}</span>
            ))}
          </div>
        </div>
      )}

      {analysis.unknowns.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Needs clarification</p>
          <ul className="space-y-1">
            {analysis.unknowns.map(u => (
              <li key={u} className="text-sm text-slate-600 flex gap-2">
                <span className="text-slate-300 shrink-0">?</span>{u}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.red_flags.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Red flags</p>
          <ul className="space-y-1">
            {analysis.red_flags.map(f => (
              <li key={f} className="text-sm text-red-500 flex gap-2">
                <span className="shrink-0">⚠</span>{f}
              </li>
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
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Prototype</h2>
        {(!prototype || prototype.status === 'rejected' || prototype.status === 'failed') && (
          <button
            onClick={onGenerate}
            disabled={loading}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Generating…' : prototype ? 'Regenerate' : 'Generate Prototype'}
          </button>
        )}
      </div>

      {!prototype && !loading && (
        <p className="text-sm text-slate-400">No prototype yet. Generate one to include a live demo in your bid.</p>
      )}

      {(loading || prototype?.status === 'generating') && (
        <div className="flex items-center gap-3 py-4">
          <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
          <p className="text-sm text-slate-400">Building prototype… ~30 seconds</p>
        </div>
      )}

      {prototype?.status === 'failed' && (
        <p className="text-sm text-red-500">Generation failed. Try again.</p>
      )}

      {prototype?.status === 'ready' && prototype.public_url && (
        <div>
          <div className="rounded-xl border border-slate-200 overflow-hidden mb-4" style={{ height: 320 }}>
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
              className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
            >
              View live ↗
            </a>
            <button
              onClick={onApprove}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Approve — include in bid
            </button>
            <button
              onClick={onReject}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {prototype?.status === 'approved' && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-semibold rounded-full">Approved</span>
            <span className="text-xs text-slate-400">Will be included in bid proposal</span>
          </div>
          {prototype.public_url && (
            <a href={prototype.public_url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-indigo-600 hover:underline">
              {prototype.public_url}
            </a>
          )}
        </div>
      )}

      {prototype?.status === 'rejected' && (
        <p className="text-sm text-slate-400">Prototype rejected. Generate a new one.</p>
      )}
    </div>
  );
}
