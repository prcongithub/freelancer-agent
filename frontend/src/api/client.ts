import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' }
});

export const fetchDashboard = () => api.get('/dashboard');
export const fetchProjects = (status?: string) =>
  api.get('/projects', { params: status ? { status } : {} });
export const fetchBids = (status?: string) =>
  api.get('/bids', { params: status ? { status } : {} });
export const approveBid = (projectId: string) =>
  api.post(`/projects/${projectId}/approve_bid`);
export const rejectProject = (projectId: string) =>
  api.post(`/projects/${projectId}/reject`);
export const fetchSettings = () => api.get('/settings');
export const updateSettings = (data: Record<string, unknown>) =>
  api.patch('/settings', data);

export default api;
