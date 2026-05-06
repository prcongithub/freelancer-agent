import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getOAuthUrl } from '../api/client';

export default function Login() {
  const [loading, setLoading] = useState<'freelancer' | 'client' | null>(null);
  const [params] = useSearchParams();
  const error = params.get('error');

  const handleLogin = async (role: 'freelancer' | 'client') => {
    setLoading(role);
    try {
      const { data } = await getOAuthUrl(role);
      window.location.href = data.url;
    } catch {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm border p-10 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Freelancing Agent</h1>
        <p className="text-gray-500 mb-8">Connect your Freelancer.com account to get started</p>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            Login failed. Please try again.
          </div>
        )}

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

        <p className="mt-6 text-xs text-gray-400">
          You will be redirected to Freelancer.com to authorize access
        </p>
      </div>
    </div>
  );
}
