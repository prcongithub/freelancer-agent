import { useEffect, useState } from 'react';
import { fetchBids } from '../api/client';
import type { Bid } from '../types/api';

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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Bid History</h1>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm bg-white"
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>{s || 'All statuses'}</option>
          ))}
        </select>
      </div>

      {loading && <div className="text-center py-10 text-gray-500">Loading...</div>}
      {error   && <div className="text-center py-10 text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Project', 'Amount', 'Rate', 'Hours', 'Status', 'Submitted'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-700">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {bids.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No bids yet.</td>
                </tr>
              ) : (
                bids.map(bid => (
                  <tr key={bid.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{bid.project_title}</td>
                    <td className="px-4 py-3">${bid.amount}</td>
                    <td className="px-4 py-3">${bid.pricing_breakdown?.hourly_rate ?? '—'}/hr</td>
                    <td className="px-4 py-3">{bid.pricing_breakdown?.estimated_hours ?? '—'}h</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${bidStatusColor(bid.status)}`}>
                        {bid.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {bid.submitted_at
                        ? new Date(bid.submitted_at).toLocaleDateString()
                        : '—'}
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

function bidStatusColor(status: string): string {
  const map: Record<string, string> = {
    won:         'bg-green-100 text-green-800',
    lost:        'bg-red-100 text-red-800',
    shortlisted: 'bg-yellow-100 text-yellow-800',
    submitted:   'bg-blue-100 text-blue-800',
    viewed:      'bg-indigo-100 text-indigo-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
}
