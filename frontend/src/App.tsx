import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Bids from './pages/Bids';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
            <span className="font-bold text-gray-900 mr-4">Freelancing Agent</span>
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? 'font-semibold text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/projects"
              className={({ isActive }) =>
                isActive ? 'font-semibold text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }
            >
              Projects
            </NavLink>
            <NavLink
              to="/bids"
              className={({ isActive }) =>
                isActive ? 'font-semibold text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }
            >
              Bids
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                isActive ? 'font-semibold text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }
            >
              Settings
            </NavLink>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/bids" element={<Bids />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
