import { useEffect, useRef, useState } from 'react';
import { fetchSettings, updateSettings, getProfile, updateProfile } from '../api/client';
import type { Settings, UserProfile } from '../types/api';
import { PageLoader, PageError } from './Dashboard';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [apiToken, setApiToken] = useState('');
  const [flUserId, setFlUserId] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchSettings(), getProfile()])
      .then(([settingsRes, profileRes]) => {
        setSettings(settingsRes.data.settings);
        setProfile(profileRes.data.profile);
        setFlUserId(profileRes.data.profile.freelancer_user_id || '');
      })
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setError(null); setSaving(true); setSaved(false);
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

  const handleProfileSave = async () => {
    setProfileError(null); setProfileSaving(true); setProfileSaved(false);
    try {
      const payload: { oauth_token?: string; freelancer_user_id?: string } = {
        freelancer_user_id: flUserId,
      };
      if (apiToken) payload.oauth_token = apiToken;
      const res = await updateProfile(payload);
      setProfile(res.data.profile);
      setApiToken('');
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch {
      setProfileError('Failed to save connection');
    } finally {
      setProfileSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error && !settings) return <PageError message={error} />;
  if (!settings) return null;

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure bidding thresholds and pricing floors.</p>
      </div>

      <div className="max-w-2xl space-y-5">

        {/* Bidding Thresholds */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-5">Bidding Thresholds</h2>
          <div className="space-y-5">
            <ThresholdField
              label="Auto-Bid Threshold"
              hint="Projects scoring above this are bid automatically without manual approval."
              value={settings.auto_bid_threshold}
              onChange={v => setSettings({ ...settings, auto_bid_threshold: v })}
            />
            <ThresholdField
              label="Approval Threshold"
              hint="Projects scoring below this are automatically discarded."
              value={settings.approval_threshold}
              onChange={v => setSettings({ ...settings, approval_threshold: v })}
            />
          </div>
        </div>

        {/* Pricing Floors */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-5">Pricing Floors ($/hr)</h2>
          <div className="space-y-3">
            {Object.entries(settings.pricing_floors).map(([category, rates]) => (
              <div key={category} className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-600 w-40 capitalize shrink-0">
                  {category.replace(/_/g, ' ')}
                </span>
                <input
                  type="number"
                  value={rates.min}
                  onChange={e => setSettings({
                    ...settings,
                    pricing_floors: { ...settings.pricing_floors, [category]: { ...rates, min: Number(e.target.value) } }
                  })}
                  className="border border-slate-200 rounded-lg px-3 py-2 w-24 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  min={0}
                />
                <span className="text-slate-300 font-light">–</span>
                <input
                  type="number"
                  value={rates.max}
                  onChange={e => setSettings({
                    ...settings,
                    pricing_floors: { ...settings.pricing_floors, [category]: { ...rates, max: Number(e.target.value) } }
                  })}
                  className="border border-slate-200 rounded-lg px-3 py-2 w-24 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  min={0}
                />
                <span className="text-xs text-slate-400">/hr</span>
              </div>
            ))}
          </div>
        </div>

        {/* Freelancer Connection */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Freelancer.com Connection</h2>
            {profile?.has_api_token && (
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                ✓ Connected
              </span>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">API Token</label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={apiToken}
                  onChange={e => setApiToken(e.target.value)}
                  placeholder={profile?.has_api_token ? '••••••••••••••• (token saved — paste to update)' : 'Paste your Freelancer.com API token'}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 pr-16 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  {showToken ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Get your token from <span className="font-mono">freelancer.com/settings/api</span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Freelancer User ID</label>
              <input
                type="text"
                value={flUserId}
                onChange={e => setFlUserId(e.target.value)}
                placeholder="e.g. 2870829"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-400 mt-1">Your numeric user ID from your Freelancer.com profile URL.</p>
            </div>
          </div>
          {profileError && (
            <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {profileError}
            </div>
          )}
          <div className="flex items-center gap-4 mt-5">
            <button
              onClick={handleProfileSave}
              disabled={profileSaving}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {profileSaving ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full" />
                  Saving…
                </span>
              ) : 'Save Connection'}
            </button>
            {profileSaved && <span className="text-sm font-medium text-emerald-600">✓ Saved</span>}
          </div>
        </div>

        {/* Save row */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full" />
                Saving…
              </span>
            ) : 'Save Settings'}
          </button>
          {saved && (
            <span className="text-sm font-medium text-emerald-600">
              ✓ Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ThresholdField({
  label, hint, value, onChange
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="border border-slate-200 rounded-lg px-3 py-2 w-24 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          min={0}
          max={100}
        />
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${value}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-slate-700 w-10 text-right">{value}%</span>
      </div>
      <p className="text-xs text-slate-400 mt-1.5">{hint}</p>
    </div>
  );
}
