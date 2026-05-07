import { useEffect, useState } from 'react';
import { fetchBids } from '../api/client';
import type { Bid } from '../types/api';
import { PageLoader, PageError } from './Dashboard';

const STATUSES = ['', 'draft', 'submitted', 'viewed', 'shortlisted', 'won', 'lost'];

export default function Bids() {
  const [bids, setBids]       = useState<Bid[]>([]);
  const [filter, setFilter]   = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchBids(filter || undefined)
      .then(res => setBids(res.data.bids))
      .catch(() => setError('Failed to load bids'))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div>
      <div className="flex justify-between items-center mb-7">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bid History</h1>
          <p className="text-sm text-slate-500 mt-1">All proposals sent and their outcomes.</p>
        </div>
        <select
          aria-label="Filter by status"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>{s || 'All statuses'}</option>
          ))}
        </select>
      </div>

      {loading && <PageLoader />}
      {error   && <PageError message={error} />}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Project', 'Amount', 'Rate', 'Hours', 'Status', 'Submitted'].map(h => (
                  <th key={h} scope="col" className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bids.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">
                    No bids yet.
                  </td>
                </tr>
              ) : (
                bids.map(bid => (
                  <tr key={bid.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-900">{bid.project_title}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-700">${bid.amount.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-slate-500">${bid.pricing_breakdown?.hourly_rate ?? '—'}/hr</td>
                    <td className="px-5 py-3.5 text-slate-500">{bid.pricing_breakdown?.estimated_hours ?? '—'}h</td>
                    <td className="px-5 py-3.5">
                      <BidStatusBadge status={bid.status} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">
                      {bid.submitted_at ? new Date(bid.submitted_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BidStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    won:         'bg-emerald-50 text-emerald-700',
    lost:        'bg-red-50 text-red-600',
    shortlisted: 'bg-amber-50 text-amber-700',
    submitted:   'bg-indigo-50 text-indigo-700',
    viewed:      'bg-violet-50 text-violet-700',
    draft:       'bg-slate-100 text-slate-500',
  };
  const cls = map[status] ?? 'bg-slate-100 text-slate-500';
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}
