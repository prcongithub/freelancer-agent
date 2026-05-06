import axios from 'axios';
import type { Project, Bid, DashboardData, Settings, ClientProject, ClientAnalysisResult, AdminUser, AdminStats, Prototype } from '../types/api';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Existing freelancer API (unchanged)
export const fetchDashboard = () => api.get<DashboardData>('/dashboard');
export const fetchProjects = (status?: string) =>
  api.get<{ projects: Project[] }>('/projects', { params: status ? { status } : {} });
export const fetchProject = (id: string) => api.get<{ project: Project }>(`/projects/${id}`);
export const fetchBids = (status?: string) =>
  api.get<{ bids: Bid[] }>('/bids', { params: status ? { status } : {} });
export const approveBid = (projectId: string) =>
  api.post<{ message: string }>(`/projects/${projectId}/approve_bid`);
export const rejectProject = (projectId: string) =>
  api.post<{ project: Project }>(`/projects/${projectId}/reject`);
export const analyzeProject = (projectId: string) =>
  api.post<{ message: string }>(`/projects/${projectId}/analyze`);

export const generatePrototype = (projectId: string) =>
  api.post<{ prototype: Prototype }>(`/projects/${projectId}/prototype`);

export const fetchPrototype = (projectId: string) =>
  api.get<{ prototype: Prototype }>(`/projects/${projectId}/prototype`);

export const approvePrototype = (prototypeId: string) =>
  api.post<{ prototype: Prototype }>(`/prototypes/${prototypeId}/approve`);

export const rejectPrototype = (prototypeId: string) =>
  api.post<{ prototype: Prototype }>(`/prototypes/${prototypeId}/reject`);
export const fetchSettings = () => api.get<{ settings: Settings }>('/settings');
export const updateSettings = (data: Partial<Settings>) =>
  api.patch<{ settings: Settings }>('/settings', data);

// Auth
export const getOAuthUrl = (role: 'freelancer' | 'client') =>
  api.get<{ url: string }>(`/auth/freelancer/authorize?role=${role}`);

// Client API
export const fetchClientProjects = () =>
  api.get<{ projects: ClientProject[] }>('/client/projects');
export const analyzeClientBids = (projectId: string) =>
  api.post<{ message: string }>(`/client/projects/${projectId}/analyze_bids`);
export const fetchAnalysis = (analysisId: string) =>
  api.get<{ analysis: ClientAnalysisResult }>(`/client/analyses/${analysisId}`);

// Admin API
export const fetchAdminUsers = () =>
  api.get<{ users: AdminUser[] }>('/admin/users');
export const updateUserRole = (userId: string, role: string) =>
  api.patch<{ user: AdminUser }>(`/admin/users/${userId}`, { role });
export const fetchAdminStats = () =>
  api.get<{ stats: AdminStats }>('/admin/stats');

export default api;
