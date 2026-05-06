import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getOAuthUrl, adminLogin } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const [loading, setLoading] = useState<'freelancer' | 'client' | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
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
      navigate('/admin/users', { replace: true });
    } catch {
      setAdminError('Invalid email or password');
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm border p-10 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">PitchSignal</h1>
        <p className="text-gray-500 mb-8">Revenue intelligence for expert freelancers and boutique agencies</p>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            Login failed. Please try again.
          </div>
        )}

        {!showAdmin ? (
          <>
            <div className="space-y-3">
              <button
                onClick={() => handleLogin('freelancer')}
                disabled={loading !== null}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading === 'freelancer' ? 'Redirecting...' : 'Login as Freelancer'}
              </button>
              <button
                onClick={() => handleLogin('client')}
                disabled={loading !== null}
                className="w-full py-3 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {loading === 'client' ? 'Redirecting...' : 'Login as Client'}
              </button>
            </div>
            <button
              onClick={() => setShowAdmin(true)}
              className="mt-6 text-xs text-gray-400 hover:text-gray-600"
            >
              Admin login
            </button>
          </>
        ) : (
          <form onSubmit={handleAdminLogin} className="space-y-3 text-left">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {adminError && (
              <p className="text-sm text-red-600">{adminError}</p>
            )}
            <button
              type="submit"
              disabled={adminLoading}
              className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50"
            >
              {adminLoading ? 'Logging in...' : 'Login as Admin'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAdmin(false); setAdminError(''); }}
              className="w-full text-sm text-gray-400 hover:text-gray-600 pt-1"
            >
              Back
            </button>
          </form>
        )}

        <p className="mt-6 text-xs text-gray-400">
          You will be redirected to Freelancer.com to authorize access
        </p>
      </div>
    </div>
  );
}
