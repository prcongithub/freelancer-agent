import { useEffect, useState, useCallback } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import { fetchAgentConfig, updateAgentConfig } from '../../api/client';

const AGENTS = [
  { key: 'scanner',       label: 'Scanner' },
  { key: 'analyzer',      label: 'Analyzer' },
  { key: 'bidder',        label: 'Bidder' },
  { key: 'prototyper',    label: 'Prototyper' },
  { key: 'tracker',       label: 'Tracker' },
  { key: 'client_portal', label: 'Client Portal' },
];

type FieldDef =
  | { key: string; label: string; type: 'markdown'; hint?: string }
  | { key: string; label: string; type: 'json';     hint?: string }
  | { key: string; label: string; type: 'number';   hint?: string; min?: number; max?: number; step?: number }
  | { key: string; label: string; type: 'text';     hint?: string };

const AGENT_FIELDS: Record<string, FieldDef[]> = {
  scanner: [
    { key: 'threshold',           label: 'Score Threshold',     type: 'number', min: 0, max: 100, hint: 'Min fit score to store a project (default: 65)' },
    { key: 'skill_match_minimum', label: 'Skill Match Minimum', type: 'number', min: 0, max: 100, hint: 'Min skill overlap score (default: 25)' },
    { key: 'keyword_groups',      label: 'Keyword Groups',      type: 'json',   hint: 'JSON object: category → array of keyword strings' },
  ],
  analyzer: [
    { key: 'skill_profile', label: 'Skill Profile',  type: 'markdown', hint: 'Developer profile sent to Claude for project analysis' },
    { key: 'model_id',      label: 'Model ID',       type: 'text',     hint: 'Bedrock model ID (e.g. global.anthropic.claude-haiku-4-5-...)' },
    { key: 'max_tokens',    label: 'Max Tokens',     type: 'number',   min: 100, max: 16000 },
    { key: 'temperature',   label: 'Temperature',    type: 'number',   min: 0,   max: 1, step: 0.05 },
  ],
  bidder: [
    { key: 'category_rates',           label: 'Category Rates',           type: 'json',     hint: 'JSON: { "aws_devops": { "min": 75, "max": 100 }, ... }' },
    { key: 'agent_discount_threshold', label: 'Agent Discount Threshold', type: 'number',   min: 0, max: 100, hint: 'Agent-buildable score ≥ this gets 25% discount (default: 70)' },
    { key: 'proposal_system_prompt',   label: 'Proposal System Prompt',   type: 'markdown', hint: 'System prompt for bid proposal generation' },
    { key: 'proposal_max_tokens',      label: 'Proposal Max Tokens',      type: 'number',   min: 100, max: 4000 },
    { key: 'proposal_temperature',     label: 'Proposal Temperature',     type: 'number',   min: 0, max: 1, step: 0.05 },
  ],
  prototyper: [
    { key: 'system_prompt',  label: 'System Prompt',  type: 'markdown', hint: 'Opening instruction sent to Claude for prototype generation' },
    { key: 'category_hints', label: 'Category Hints', type: 'json',   hint: 'JSON: { "frontend": "...", "fullstack": "...", ... }' },
    { key: 'max_tokens',     label: 'Max Tokens',     type: 'number', min: 1000, max: 16000 },
    { key: 'temperature',    label: 'Temperature',    type: 'number', min: 0, max: 1, step: 0.05 },
  ],
  tracker: [
    { key: 'auto_bid_threshold', label: 'Auto-Bid Threshold', type: 'number', min: 0, max: 100, hint: 'Projects scoring above this are auto-bid (default: 80)' },
  ],
  client_portal: [
    { key: 'ranking_criteria', label: 'Ranking Criteria', type: 'markdown', hint: 'Instructions for how to rank bids' },
    { key: 'max_tokens',       label: 'Max Tokens',       type: 'number',   min: 100, max: 8000 },
  ],
};

export default function AdminAgentConfig() {
  const { agent = 'scanner' } = useParams<{ agent: string }>();

  const [config, setConfig]         = useState<Record<string, unknown>>({});
  const [draft, setDraft]           = useState<Record<string, unknown>>({});
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

  const fields = AGENT_FIELDS[agent] ?? [];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAgentConfig(agent);
      setConfig(res.data.agent.config);
      setDraft(res.data.agent.config);
    } catch {
      setError('Failed to load agent config.');
    } finally {
      setLoading(false);
    }
  }, [agent]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const isDirty = JSON.stringify(draft) !== JSON.stringify(config);
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [draft, config]);

  const setField = (key: string, value: unknown) => {
    setDraft(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const validateJson = (key: string, raw: string): boolean => {
    try {
      JSON.parse(raw);
      setJsonErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
      return true;
    } catch {
      setJsonErrors(prev => ({ ...prev, [key]: 'Invalid JSON' }));
      return false;
    }
  };

  const handleSave = async () => {
    for (const field of fields) {
      if (field.type === 'json') {
        const raw = typeof draft[field.key] === 'string'
          ? draft[field.key] as string
          : JSON.stringify(draft[field.key] ?? {}, null, 2);
        if (!validateJson(field.key, raw)) return;
      }
    }

    const finalConfig: Record<string, unknown> = { ...draft };
    for (const field of fields) {
      if (field.type === 'json' && typeof finalConfig[field.key] === 'string') {
        finalConfig[field.key] = JSON.parse(finalConfig[field.key] as string);
      }
    }

    setSaving(true);
    setError(null);
    try {
      const res = await updateAgentConfig(agent, finalConfig);
      setConfig(res.data.agent.config);
      setDraft(res.data.agent.config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isDirty = JSON.stringify(draft) !== JSON.stringify(config);

  return (
    <div className="flex gap-6">
      <aside className="w-44 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 px-2">Agents</p>
        <nav className="flex flex-col gap-0.5">
          {AGENTS.map(a => (
            <NavLink
              key={a.key}
              to={`/admin/agents/${a.key}`}
              className={({ isActive }) =>
                isActive
                  ? 'px-3 py-2 rounded-lg text-sm font-semibold text-indigo-600 bg-indigo-50'
                  : 'px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors'
              }
            >
              {a.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight capitalize">
            {agent.replace(/_/g, ' ')} Agent
          </h1>
          <p className="text-sm text-slate-500 mt-1">Changes take effect on the next job run.</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 py-8 text-slate-400">
            <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <div className="space-y-6">
            {fields.map(field => (
              <FieldRow
                key={field.key}
                field={field}
                value={draft[field.key]}
                jsonError={jsonErrors[field.key]}
                onChange={(val) => setField(field.key, val)}
                onJsonChange={(raw) => {
                  setField(field.key, raw);
                  validateJson(field.key, raw);
                }}
              />
            ))}

            <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              {saved && <span className="text-sm text-green-600 font-medium">&#10003; Saved</span>}
              {isDirty && !saving && <span className="text-xs text-slate-400">Unsaved changes</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldRow({
  field, value, jsonError, onChange, onJsonChange
}: {
  field: FieldDef;
  value: unknown;
  jsonError?: string;
  onChange: (val: unknown) => void;
  onJsonChange: (raw: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1">{field.label}</label>
      {field.hint && <p className="text-xs text-slate-400 mb-2">{field.hint}</p>}

      {field.type === 'markdown' && (
        <div data-color-mode="light">
          <MDEditor
            value={typeof value === 'string' ? value : ''}
            onChange={(val) => onChange(val ?? '')}
            height={300}
            preview="live"
          />
        </div>
      )}

      {field.type === 'json' && (
        <div>
          <textarea
            className={`w-full font-mono text-xs rounded-lg border px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y ${
              jsonError ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
            }`}
            rows={10}
            value={
              typeof value === 'string'
                ? value
                : JSON.stringify(value ?? {}, null, 2)
            }
            onChange={e => onJsonChange(e.target.value)}
            spellCheck={false}
          />
          {jsonError && <p className="mt-1 text-xs text-red-600">{jsonError}</p>}
        </div>
      )}

      {field.type === 'number' && (
        <input
          type="number"
          className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={typeof value === 'number' ? value : Number(value) || 0}
          min={'min' in field ? field.min : undefined}
          max={'max' in field ? field.max : undefined}
          step={'step' in field ? field.step : 1}
          onChange={e => onChange(Number(e.target.value))}
        />
      )}

      {field.type === 'text' && (
        <input
          type="text"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={typeof value === 'string' ? value : String(value ?? '')}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
