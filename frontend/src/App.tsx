import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Bids from './pages/Bids';
import Settings from './pages/Settings';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import ClientProjects from './pages/client/ClientProjects';
import ClientProjectDetail from './pages/client/ClientProjectDetail';
import ClientAnalysis from './pages/client/ClientAnalysis';
import AdminUsers from './pages/admin/AdminUsers';
import AdminStats from './pages/admin/AdminStats';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="p-8 text-gray-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function FreelancerNav() {
  const { logout } = useAuth();
  const links: [string, string, boolean][] = [['/', 'Dashboard', true], ['/projects', 'Projects', false], ['/bids', 'Bids', false], ['/settings', 'Settings', false]];
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
        <span className="font-bold text-gray-900 mr-4">PitchSignal</span>
        {links.map(([to, label, end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'font-semibold text-blue-600' : 'text-gray-600 hover:text-gray-900'}>{label}</NavLink>
        ))}
        <button onClick={logout} className="ml-auto text-sm text-gray-500 hover:text-gray-900">Logout</button>
      </div>
    </nav>
  );
}

function ClientNav() {
  const { logout } = useAuth();
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
        <span className="font-bold text-gray-900 mr-4">PitchSignal</span>
        <NavLink to="/client/projects" className={({ isActive }) => isActive ? 'font-semibold text-blue-600' : 'text-gray-600 hover:text-gray-900'}>My Projects</NavLink>
        <button onClick={logout} className="ml-auto text-sm text-gray-500 hover:text-gray-900">Logout</button>
      </div>
    </nav>
  );
}

function AdminNav() {
  const { logout } = useAuth();
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
        <span className="font-bold text-gray-900 mr-4">PitchSignal — Admin</span>
        <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'font-semibold text-blue-600' : 'text-gray-600 hover:text-gray-900'}>Users</NavLink>
        <NavLink to="/admin/stats" className={({ isActive }) => isActive ? 'font-semibold text-blue-600' : 'text-gray-600 hover:text-gray-900'}>Stats</NavLink>
        <button onClick={logout} className="ml-auto text-sm text-gray-500 hover:text-gray-900">Logout</button>
      </div>
    </nav>
  );
}

function AppLayout({ nav, children }: { nav: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {nav}
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route path="/" element={<ProtectedRoute roles={['freelancer', 'super_admin']}><AppLayout nav={<FreelancerNav />}><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/projects" element={<ProtectedRoute roles={['freelancer', 'super_admin']}><AppLayout nav={<FreelancerNav />}><Projects /></AppLayout></ProtectedRoute>} />
        <Route path="/projects/:id" element={<ProtectedRoute roles={['freelancer', 'super_admin']}><AppLayout nav={<FreelancerNav />}><ProjectDetail /></AppLayout></ProtectedRoute>} />
        <Route path="/bids" element={<ProtectedRoute roles={['freelancer', 'super_admin']}><AppLayout nav={<FreelancerNav />}><Bids /></AppLayout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute roles={['freelancer', 'super_admin']}><AppLayout nav={<FreelancerNav />}><Settings /></AppLayout></ProtectedRoute>} />

        <Route path="/client/projects" element={<ProtectedRoute roles={['client', 'super_admin']}><AppLayout nav={<ClientNav />}><ClientProjects /></AppLayout></ProtectedRoute>} />
        <Route path="/client/projects/:id" element={<ProtectedRoute roles={['client', 'super_admin']}><AppLayout nav={<ClientNav />}><ClientProjectDetail /></AppLayout></ProtectedRoute>} />
        <Route path="/client/analyses/:id" element={<ProtectedRoute roles={['client', 'super_admin']}><AppLayout nav={<ClientNav />}><ClientAnalysis /></AppLayout></ProtectedRoute>} />

        <Route path="/admin/users" element={<ProtectedRoute roles={['super_admin']}><AppLayout nav={<AdminNav />}><AdminUsers /></AppLayout></ProtectedRoute>} />
        <Route path="/admin/stats" element={<ProtectedRoute roles={['super_admin']}><AppLayout nav={<AdminNav />}><AdminStats /></AppLayout></ProtectedRoute>} />

        <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
