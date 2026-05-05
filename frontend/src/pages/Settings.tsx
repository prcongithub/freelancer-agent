import { useEffect, useRef, useState } from 'react';
import { fetchSettings, updateSettings } from '../api/client';
import type { Settings } from '../types/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchSettings()
      .then(res => setSettings(res.data.settings))
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const res = await updateSettings(settings);
      setSettings(res.data.settings);
      setSaved(true);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-10 text-gray-500">Loading...</div>;
  if (error)   return <div className="text-center py-10 text-red-600">{error}</div>;
  if (!settings) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="bg-white rounded-lg border p-6 max-w-2xl space-y-6">

        {/* Thresholds */}
        <section>
          <h2 className="text-base font-semibold mb-4">Bidding Thresholds</h2>
          <div className="space-y-4">
            <ThresholdField
              label="Auto-Bid Threshold"
              hint="Projects scoring above this are bid automatically without approval"
              value={settings.auto_bid_threshold}
              onChange={v => setSettings({ ...settings, auto_bid_threshold: v })}
            />
            <ThresholdField
              label="Approval Threshold"
              hint="Projects scoring below this are discarded"
              value={settings.approval_threshold}
              onChange={v => setSettings({ ...settings, approval_threshold: v })}
            />
          </div>
        </section>

        {/* Pricing Floors */}
        <section>
          <h2 className="text-base font-semibold mb-4">Pricing Floors ($/hr)</h2>
          <div className="space-y-2">
            {Object.entries(settings.pricing_floors).map(([category, rates]) => (
              <div key={category} className="flex items-center gap-3">
                <span className="text-sm w-36 capitalize text-gray-700">
                  {category.replace(/_/g, ' ')}
                </span>
                <input
                  type="number"
                  value={rates.min}
                  onChange={e => setSettings({
                    ...settings,
                    pricing_floors: {
                      ...settings.pricing_floors,
                      [category]: { ...rates, min: Number(e.target.value) }
                    }
                  })}
                  className="border rounded px-2 py-1 w-20 text-sm"
                  min={0}
                />
                <span className="text-gray-400">–</span>
                <input
                  type="number"
                  value={rates.max}
                  onChange={e => setSettings({
                    ...settings,
                    pricing_floors: {
                      ...settings.pricing_floors,
                      [category]: { ...rates, max: Number(e.target.value) }
                    }
                  })}
                  className="border rounded px-2 py-1 w-20 text-sm"
                  min={0}
                />
                <span className="text-xs text-gray-400">/hr</span>
              </div>
            ))}
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && <span className="text-green-600 text-sm">Saved!</span>}
        </div>
      </div>
    </div>
  );
}

function ThresholdField({
  label,
  hint,
  value,
  onChange
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="border rounded px-3 py-2 w-24 text-sm"
        min={0}
        max={100}
      />
      <p className="text-xs text-gray-500 mt-1">{hint}</p>
    </div>
  );
}
