import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchAnalysis } from '../../api/client';
import type { ClientAnalysisResult, BidShortlistItem } from '../../types/api';
import { PageLoader } from '../Dashboard';

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
    score >= 50 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  'bg-red-50 text-red-600 border-red-100';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {score}/100
    </span>
  );
}

function BidCard({ item }: { item: BidShortlistItem }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-150">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-slate-200 leading-none">#{item.rank}</span>
          <div>
            <div className="font-semibold text-slate-900 text-sm">{item.bidder_name}</div>
            <ScoreBadge score={item.score} />
          </div>
        </div>
        <span className="font-bold text-slate-900 text-base shrink-0">${item.bid_amount.toLocaleString()}</span>
      </div>

      <p className="text-sm text-slate-500 leading-relaxed mb-4">{item.summary}</p>

      <div className="grid sm:grid-cols-2 gap-3">
        {item.strengths.length > 0 && (
          <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2">Strengths</p>
            <ul className="space-y-1">
              {item.strengths.map((s, i) => (
                <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                  <span className="text-emerald-500 shrink-0 mt-0.5">+</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {item.concerns.length > 0 && (
          <div className="bg-red-50/60 border border-red-100 rounded-lg p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-2">Concerns</p>
            <ul className="space-y-1">
              {item.concerns.map((c, i) => (
                <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                  <span className="text-red-400 shrink-0 mt-0.5">–</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientAnalysis() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<ClientAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchAnalysis(id).then(r => setAnalysis(r.data.analysis)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoader />;
  if (!analysis) return (
    <div className="text-center py-16 text-sm text-slate-400">Analysis not found.</div>
  );

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-5 text-sm font-medium text-slate-400 hover:text-slate-700 flex items-center gap-1.5 transition-colors"
      >
        ← Back
      </button>

      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bid Analysis</h1>
        <p className="text-sm text-slate-500 mt-1">
          Top {analysis.shortlist.length} recommended {analysis.shortlist.length === 1 ? 'bid' : 'bids'} ranked by fit.
        </p>
      </div>

      <div className="space-y-4">
        {analysis.shortlist.map(item => <BidCard key={item.rank} item={item} />)}
      </div>
    </div>
  );
}
