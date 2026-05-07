import { useEffect, useState } from 'react';
import { fetchAdminUsers, updateUserRole } from '../../api/client';
import type { AdminUser } from '../../types/api';

const ROLES = ['freelancer', 'client', 'super_admin'];

const ROLE_STYLES: Record<string, string> = {
  super_admin: 'bg-violet-50 text-violet-700 border border-violet-100',
  freelancer:  'bg-indigo-50 text-indigo-700 border border-indigo-100',
  client:      'bg-sky-50 text-sky-700 border border-sky-100',
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminUsers().then(r => setUsers(r.data.users)).finally(() => setLoading(false));
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    await updateUserRole(userId, newRole);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  if (loading) return (
    <div className="flex items-center gap-3 py-8 text-slate-400">
      <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
      <span className="text-sm">Loading…</span>
    </div>
  );

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Users
          <span className="ml-2 text-base font-normal text-slate-400">({users.length})</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">Manage user roles and access.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Name', 'Email', 'Role', 'Joined'].map(h => (
                <th key={h} scope="col" className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3.5 font-medium text-slate-900">{u.name}</td>
                <td className="px-5 py-3.5 text-slate-500">{u.email}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${ROLE_STYLES[u.role] ?? 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                      {u.role.replace('_', ' ')}
                    </span>
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-slate-400 text-xs">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
