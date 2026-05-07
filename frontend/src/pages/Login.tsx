import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getOAuthUrl, adminLogin, registerUser } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const [loading, setLoading] = useState<'freelancer' | 'client' | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regRole, setRegRole] = useState<'freelancer' | 'client'>('freelancer');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [params] = useSearchParams();
  const error = params.get('error');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (role: 'freelancer' | 'client') => {
    setLoading(role);
    try {
      const { data } = await getOAuthUrl(role);
      window.location.href = data.url;
    } catch {
      setLoading(null);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminLoading(true);
    try {
      const { data } = await adminLogin(adminEmail, adminPassword);
      login(data.token);
      const dest = data.role === 'super_admin' ? '/admin/users' : data.role === 'client' ? '/client/projects' : '/';
      navigate(dest, { replace: true });
    } catch {
      setAdminError('Invalid email or password');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (regPassword !== regConfirm) {
      setRegError('Passwords do not match');
      return;
    }
    setRegLoading(true);
    try {
      const { data } = await registerUser({
        email: regEmail,
        password: regPassword,
        password_confirmation: regConfirm,
        role: regRole,
        name: regName || undefined,
      });
      login(data.token);
      navigate(data.role === 'client' ? '/client/projects' : '/', { replace: true });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setRegError(axiosErr.response?.data?.error || 'Registration failed');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4" style={{
      backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 60%)`,
    }}>
      {/* Subtle grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
      }} />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-4">
            <svg className="w-6 h-6 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 11 L6 6 L9 9 L13 3" />
              <circle cx="13" cy="3" r="1.5" fill="white" stroke="none" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">PitchSignal</h1>
          <p className="text-sm text-slate-400 mt-1 text-center">Revenue intelligence for expert freelancers and boutique agencies</p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur border border-slate-700/60 rounded-2xl p-7 shadow-2xl shadow-black/40">
          {error && (
            <div className="mb-5 px-4 py-3 bg-red-900/40 border border-red-700/40 text-red-300 rounded-xl text-sm">
              Login failed. Please try again.
            </div>
          )}

          {showRegister ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="text-sm font-semibold text-slate-200 mb-1">Create Account</div>

              {/* Role selector */}
              <div className="flex gap-2">
                {(['freelancer', 'client'] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRegRole(r)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                      regRole === r
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-slate-900/40 border-slate-600 text-slate-400 hover:border-slate-400'
                    }`}
                  >
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Name (optional)</label>
                <input
                  type="text"
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  value={regConfirm}
                  onChange={e => setRegConfirm(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
              {regError && <p className="text-xs text-red-400">{regError}</p>}
              <button
                type="submit"
                disabled={regLoading}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {regLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full" />
                    Creating account…
                  </span>
                ) : 'Create Account'}
              </button>
              <button
                type="button"
                onClick={() => { setShowRegister(false); setRegError(''); }}
                className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
              >
                ← Back
              </button>
            </form>
          ) : !showAdmin ? (
            <>
              <div className="space-y-3">
                <button
                  onClick={() => handleLogin('freelancer')}
                  disabled={loading !== null}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading === 'freelancer' ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full" />
                      Redirecting…
                    </span>
                  ) : 'Continue as Freelancer'}
                </button>
                <button
                  onClick={() => handleLogin('client')}
                  disabled={loading !== null}
                  className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading === 'client' ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full" />
                      Redirecting…
                    </span>
                  ) : 'Continue as Client'}
                </button>
              </div>

              <p className="mt-5 text-xs text-slate-500 text-center">
                You will be redirected to Freelancer.com to authorize access.
              </p>

              <div className="flex justify-center gap-4 mt-4">
                <button
                  onClick={() => setShowRegister(true)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  Create account
                </button>
                <span className="text-slate-700 text-xs">·</span>
                <button
                  onClick={() => setShowAdmin(true)}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
                >
                  Login with password
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="text-sm font-semibold text-slate-200 mb-1">Login with Password</div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  required
                  placeholder="admin@company.com"
                  className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
              {adminError && (
                <p className="text-xs text-red-400">{adminError}</p>
              )}
              <button
                type="submit"
                disabled={adminLoading}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {adminLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full" />
                    Logging in…
                  </span>
                ) : 'Login as Admin'}
              </button>
              <button
                type="button"
                onClick={() => { setShowAdmin(false); setAdminError(''); }}
                className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
              >
                ← Back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
