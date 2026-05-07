import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react'

type Status = 'yes' | 'no' | 'partial'

interface Column {
  name: string
  subtitle: string
  highlight: boolean
}

interface Row {
  label: string
  values: Status[]
}

const columns: Column[] = [
  { name: 'Generic AI Writers', subtitle: 'ChatGPT / Jasper etc.', highlight: false },
  { name: 'Traditional CRMs', subtitle: 'Salesforce / HubSpot', highlight: false },
  { name: 'Marketplace Bidding Tools', subtitle: 'Auto-bidders etc.', highlight: false },
  { name: 'PitchSignal', subtitle: 'Revenue Intelligence', highlight: true },
]

const rows: Row[] = [
  {
    label: 'Cross-channel opportunity capture',
    values: ['no', 'partial', 'partial', 'yes'],
  },
  {
    label: 'Buyer intent scoring',
    values: ['no', 'no', 'no', 'yes'],
  },
  {
    label: 'Case study & proof matching',
    values: ['no', 'no', 'no', 'yes'],
  },
  {
    label: 'Pitch grounded in past work',
    values: ['no', 'no', 'no', 'yes'],
  },
  {
    label: 'Follow-up tracking',
    values: ['no', 'yes', 'partial', 'yes'],
  },
  {
    label: 'Revenue analytics',
    values: ['no', 'partial', 'no', 'yes'],
  },
  {
    label: 'Useful to both sellers and buyers',
    values: ['no', 'no', 'no', 'yes'],
  },
  {
    label: 'Built for expert service businesses',
    values: ['no', 'no', 'no', 'yes'],
  },
  {
    label: 'Avoids spammy auto-bidding',
    values: ['partial', 'yes', 'no', 'yes'],
  },
]

function StatusIcon({ status, highlight }: { status: Status; highlight: boolean }) {
  if (status === 'yes') {
    return (
      <CheckCircle2
        className={`w-5 h-5 mx-auto ${highlight ? 'text-emerald-400' : 'text-emerald-500'}`}
      />
    )
  }
  if (status === 'no') {
    return <XCircle className="w-5 h-5 mx-auto text-slate-300" />
  }
  return <MinusCircle className="w-5 h-5 mx-auto text-amber-400" />
}

export default function Comparison() {
  return (
    <section id="comparison" className="py-20 sm:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span className="section-label mb-4">Why PitchSignal</span>
          <h2 className="section-title mb-5">
            No existing tool was built for this problem.
          </h2>
          <p className="section-subtitle mx-auto">
            Generic tools solve pieces of the puzzle. PitchSignal is the only workspace that
            connects buyer signals, past proof, and pitch quality in a single workflow.
          </p>
        </div>

        <div className="max-w-5xl mx-auto overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 rounded-2xl overflow-hidden shadow-sm border border-slate-200">
            {/* Header */}
            <thead>
              <tr>
                <th className="text-left px-5 py-4 text-sm font-medium text-slate-500 bg-slate-100 border-b border-slate-200 w-1/3">
                  Feature
                </th>
                {columns.map((col) => (
                  <th
                    key={col.name}
                    className={`px-4 py-4 text-center border-b ${
                      col.highlight
                        ? 'bg-brand-600 border-brand-500 text-white'
                        : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className={`text-sm font-semibold ${col.highlight ? 'text-white' : ''}`}>
                      {col.name}
                    </div>
                    <div
                      className={`text-xs mt-0.5 font-normal ${
                        col.highlight ? 'text-brand-200' : 'text-slate-400'
                      }`}
                    >
                      {col.subtitle}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.label} className="group">
                  <td
                    className={`px-5 py-3.5 text-sm text-slate-700 font-medium border-b border-slate-200 ${
                      i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                    }`}
                  >
                    {row.label}
                  </td>
                  {row.values.map((status, j) => (
                    <td
                      key={j}
                      className={`px-4 py-3.5 text-center border-b ${
                        columns[j].highlight
                          ? i % 2 === 0
                            ? 'bg-brand-50 border-brand-100'
                            : 'bg-brand-50/70 border-brand-100'
                          : i % 2 === 0
                          ? 'bg-white border-slate-200'
                          : 'bg-slate-50/60 border-slate-200'
                      }`}
                    >
                      <StatusIcon status={status} highlight={columns[j].highlight} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Legend */}
          <div className="flex items-center gap-5 mt-4 justify-end">
            {[
              { icon: CheckCircle2, color: 'text-emerald-500', label: 'Yes' },
              { icon: MinusCircle, color: 'text-amber-400', label: 'Partial' },
              { icon: XCircle, color: 'text-slate-300', label: 'No' },
            ].map(({ icon: Icon, color, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
                <Icon className={`w-4 h-4 ${color}`} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
