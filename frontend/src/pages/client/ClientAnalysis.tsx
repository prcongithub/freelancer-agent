import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchAnalysis } from '../../api/client';
import type { ClientAnalysisResult, BidShortlistItem } from '../../types/api';

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-100 text-green-800' : score >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>{score}/100</span>;
}

function BidCard({ item }: { item: BidShortlistItem }) {
  return (
    <div className="bg-white border rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-gray-400">#{item.rank}</span>
          <span className="font-semibold text-gray-900">{item.bidder_name}</span>
          <ScoreBadge score={item.score} />
        </div>
        <span className="font-semibold text-gray-900">${item.bid_amount}</span>
      </div>
      <p className="text-gray-600 text-sm mb-3">{item.summary}</p>
      {item.strengths.length > 0 && (
        <div className="mb-2">
          <span className="text-xs font-medium text-green-700 uppercase">Strengths</span>
          <ul className="mt-1">{item.strengths.map((s, i) => <li key={i} className="text-sm text-gray-600">+ {s}</li>)}</ul>
        </div>
      )}
      {item.concerns.length > 0 && (
        <div>
          <span className="text-xs font-medium text-red-700 uppercase">Concerns</span>
          <ul className="mt-1">{item.concerns.map((c, i) => <li key={i} className="text-sm text-gray-600">- {c}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

export default function ClientAnalysis() {
  const { id } = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<ClientAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchAnalysis(id).then(r => setAnalysis(r.data.analysis)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-gray-500">Loading analysis...</div>;
  if (!analysis) return <div className="text-gray-500">Analysis not found.</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Bid Analysis</h1>
      <p className="text-gray-500 mb-6">Top {analysis.shortlist.length} recommended bids</p>
      <div className="space-y-4">
        {analysis.shortlist.map(item => <BidCard key={item.rank} item={item} />)}
      </div>
    </div>
  );
}
