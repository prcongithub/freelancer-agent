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
import AdminAgentConfig from './pages/admin/AdminAgentConfig';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex items-center gap-3 text-slate-400">
        <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
        <span className="text-sm font-medium">Loading…</span>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-sm">
        <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 11 L6 6 L9 9 L13 3" />
          <circle cx="13" cy="3" r="1.5" fill="white" stroke="none" />
        </svg>
      </div>
      <span className="font-bold text-sm text-slate-900 tracking-tight">PitchSignal</span>
    </div>
  );
}

function NavItem({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        isActive
          ? 'px-3 py-1.5 rounded-lg text-sm font-semibold text-indigo-600 bg-indigo-50'
          : 'px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors'
      }
    >
      {label}
    </NavLink>
  );
}

function FreelancerNav() {
  const { logout } = useAuth();
  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-2">
        <Logo />
        <div className="w-px h-5 bg-slate-200 mx-2" />
        <div className="flex items-center gap-0.5">
          <NavItem to="/" label="Dashboard" end />
          <NavItem to="/projects" label="Projects" />
          <NavItem to="/bids" label="Bids" />
          <NavItem to="/settings" label="Settings" />
        </div>
        <button
          onClick={logout}
          className="ml-auto text-xs font-medium text-slate-400 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

function ClientNav() {
  const { logout } = useAuth();
  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-2">
        <Logo />
        <div className="w-px h-5 bg-slate-200 mx-2" />
        <NavItem to="/client/projects" label="My Projects" />
        <button
          onClick={logout}
          className="ml-auto text-xs font-medium text-slate-400 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

function AdminNav() {
  const { logout } = useAuth();
  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-2">
        <Logo />
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 ml-1">
          Admin
        </span>
        <div className="w-px h-5 bg-slate-200 mx-2" />
        <NavItem to="/admin/users" label="Users" />
        <NavItem to="/admin/stats" label="Stats" />
        <NavItem to="/admin/agents" label="Agents" />
        <button
          onClick={logout}
          className="ml-auto text-xs font-medium text-slate-400 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

function AppLayout({ nav, children }: { nav: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {nav}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
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
        <Route path="/admin/agents" element={<ProtectedRoute roles={['super_admin']}><AppLayout nav={<AdminNav />}><AdminAgentConfig /></AppLayout></ProtectedRoute>} />
        <Route path="/admin/agents/:agent" element={<ProtectedRoute roles={['super_admin']}><AppLayout nav={<AdminNav />}><AdminAgentConfig /></AppLayout></ProtectedRoute>} />

        <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
