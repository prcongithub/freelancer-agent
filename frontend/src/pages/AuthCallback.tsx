import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      navigate('/login?error=' + error);
      return;
    }

    if (token) {
      login(token);
    } else {
      navigate('/login?error=no_token');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'client') navigate('/client/projects');
    else if (user.role === 'super_admin') navigate('/admin/users');
    else navigate('/');
  }, [user]);

  return <div className="flex items-center justify-center min-h-screen text-gray-500">Signing you in...</div>;
}
